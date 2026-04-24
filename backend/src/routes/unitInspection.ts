import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { pool } from "../db";
import type { AuthRequest } from "../middleware/authMiddleware";

const router = Router();

const UNIDADES_VALIDAS = [
  "Unidad 01",
  "Unidad 02",
  "Unidad 03",
  "Unidad 04",
  "Motocicleta 01",
];

const TURNOS_VALIDOS = ["Matutino", "Nocturno"];

const SERVICIOS_VALIDOS = [
  "Notaria 190",
  "Electro Motor Service",
  "Tubos Tollocan",
  "La Peninsular (Tramo Atarasquillo)",
  "La Peninsular (Tramo Xona)",
];

const GOLPES_VALIDOS = ["Sin novedad", "Con detalle"];
const GASOLINA_VALIDOS = ["Alto", "Medio", "Bajo"];
const ACEITE_VALIDOS = ["Correcto", "Bajo"];
const FRENOS_VALIDOS = ["Correcto", "Bajo"];
const LLANTAS_VALIDOS = ["Correctas", "Revisar"];
const LUCES_VALIDOS = ["Correctas", "Revisar"];
const PARABRISAS_VALIDOS = ["Correcto", "Revisar"];
const ESPEJOS_VALIDOS = ["Correctos", "Revisar"];
const LIMPIEZA_VALIDOS = ["Buena", "Regular", "Mala"];
const NIVEL_AGUA_VALIDOS = ["Correcto", "Bajo"];

const uploadDir = path.join(process.cwd(), "uploads", "inspecciones_unidad");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const userId = (req as any).user?.id || "user";
    const ext = path.extname(file.originalname || "") || ".jpg";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const random = Math.random().toString(36).slice(2, 8);
    cb(null, `inspeccion-${userId}-${stamp}-${random}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 6,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Solo se permiten imágenes"));
  },
});

function safeUnlink(filePath?: string) {
  if (!filePath) return;
  fs.unlink(filePath, () => {});
}

function safeUnlinkMany(files?: Express.Multer.File[]) {
  if (!files?.length) return;
  files.forEach((file) => safeUnlink(file.path));
}

router.get("/my-assigned-unit", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "No autorizado",
      });
    }

    const [rows]: any = await pool.query(
      `
      SELECT id, nombre, email, turno, unidad_asignada
      FROM usuarios
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    );

    const user = rows?.[0];

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Usuario no encontrado",
      });
    }

    return res.json({
      success: true,
      unit: user.unidad_asignada
        ? {
            nombre: String(user.unidad_asignada).trim(),
          }
        : null,
    });
  } catch (err: any) {
    console.error("[MY ASSIGNED UNIT ERROR]", err?.message || err);
    return res.status(500).json({
      success: false,
      error: "Error al obtener la unidad asignada",
    });
  }
});

router.post("/", upload.array("fotos", 6), async (req: AuthRequest, res) => {
  const uploadedFiles = ((req as any).files || []) as Express.Multer.File[];

  try {
    const userId = req.user?.id;

    if (!userId) {
      safeUnlinkMany(uploadedFiles);
      return res.status(401).json({
        success: false,
        error: "No autorizado",
      });
    }

    const {
      turno,
      servicio,
      golpes_estado,
      gasolina_nivel,
      aceite_estado,
      liquido_frenos_estado,
      llantas_estado,
      luces_estado,
      parabrisas_estado,
      espejos_estado,
      limpieza_estado,
      nivel_agua_estado,
      observaciones,
    } = req.body || {};

    if (
      !turno ||
      !servicio ||
      !golpes_estado ||
      !gasolina_nivel ||
      !aceite_estado ||
      !liquido_frenos_estado ||
      !llantas_estado ||
      !luces_estado ||
      !parabrisas_estado ||
      !espejos_estado ||
      !limpieza_estado ||
      !nivel_agua_estado ||
      !observaciones
    ) {
      safeUnlinkMany(uploadedFiles);
      return res.status(400).json({
        success: false,
        error: "Faltan campos obligatorios",
      });
    }

    const turnoNorm = String(turno).trim();
    const servicioNorm = String(servicio).trim();
    const golpesNorm = String(golpes_estado).trim();
    const gasolinaNorm = String(gasolina_nivel).trim();
    const aceiteNorm = String(aceite_estado).trim();
    const frenosNorm = String(liquido_frenos_estado).trim();
    const llantasNorm = String(llantas_estado).trim();
    const lucesNorm = String(luces_estado).trim();
    const parabrisasNorm = String(parabrisas_estado).trim();
    const espejosNorm = String(espejos_estado).trim();
    const limpiezaNorm = String(limpieza_estado).trim();
    const nivelAguaNorm = String(nivel_agua_estado).trim();
    const observacionesNorm = String(observaciones).trim();

    if (!TURNOS_VALIDOS.includes(turnoNorm)) {
      safeUnlinkMany(uploadedFiles);
      return res.status(400).json({
        success: false,
        error: "Turno inválido",
      });
    }

    if (!SERVICIOS_VALIDOS.includes(servicioNorm)) {
      safeUnlinkMany(uploadedFiles);
      return res.status(400).json({
        success: false,
        error: "Servicio inválido",
      });
    }

    if (!GOLPES_VALIDOS.includes(golpesNorm)) {
      safeUnlinkMany(uploadedFiles);
      return res.status(400).json({
        success: false,
        error: "Valor inválido en golpes_estado",
      });
    }

    if (!GASOLINA_VALIDOS.includes(gasolinaNorm)) {
      safeUnlinkMany(uploadedFiles);
      return res.status(400).json({
        success: false,
        error: "Valor inválido en gasolina_nivel",
      });
    }

    if (!ACEITE_VALIDOS.includes(aceiteNorm)) {
      safeUnlinkMany(uploadedFiles);
      return res.status(400).json({
        success: false,
        error: "Valor inválido en aceite_estado",
      });
    }

    if (!FRENOS_VALIDOS.includes(frenosNorm)) {
      safeUnlinkMany(uploadedFiles);
      return res.status(400).json({
        success: false,
        error: "Valor inválido en liquido_frenos_estado",
      });
    }

    if (!LLANTAS_VALIDOS.includes(llantasNorm)) {
      safeUnlinkMany(uploadedFiles);
      return res.status(400).json({
        success: false,
        error: "Valor inválido en llantas_estado",
      });
    }

    if (!LUCES_VALIDOS.includes(lucesNorm)) {
      safeUnlinkMany(uploadedFiles);
      return res.status(400).json({
        success: false,
        error: "Valor inválido en luces_estado",
      });
    }

    if (!PARABRISAS_VALIDOS.includes(parabrisasNorm)) {
      safeUnlinkMany(uploadedFiles);
      return res.status(400).json({
        success: false,
        error: "Valor inválido en parabrisas_estado",
      });
    }

    if (!ESPEJOS_VALIDOS.includes(espejosNorm)) {
      safeUnlinkMany(uploadedFiles);
      return res.status(400).json({
        success: false,
        error: "Valor inválido en espejos_estado",
      });
    }

    if (!LIMPIEZA_VALIDOS.includes(limpiezaNorm)) {
      safeUnlinkMany(uploadedFiles);
      return res.status(400).json({
        success: false,
        error: "Valor inválido en limpieza_estado",
      });
    }

    if (!NIVEL_AGUA_VALIDOS.includes(nivelAguaNorm)) {
      safeUnlinkMany(uploadedFiles);
      return res.status(400).json({
        success: false,
        error: "Valor inválido en nivel_agua_estado",
      });
    }

    if (observacionesNorm.length < 3) {
      safeUnlinkMany(uploadedFiles);
      return res.status(400).json({
        success: false,
        error: "Las observaciones son demasiado cortas",
      });
    }

    const [userRows]: any = await pool.query(
      `
      SELECT id, nombre, turno, unidad_asignada
      FROM usuarios
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    );

    const user = userRows?.[0];

    if (!user) {
      safeUnlinkMany(uploadedFiles);
      return res.status(404).json({
        success: false,
        error: "Usuario no encontrado",
      });
    }

    const unidadAsignada = String(user.unidad_asignada || "").trim();

    if (!unidadAsignada) {
      safeUnlinkMany(uploadedFiles);
      return res.status(400).json({
        success: false,
        error: "No tienes una unidad asignada. Contacta al administrador.",
      });
    }

    if (!UNIDADES_VALIDAS.includes(unidadAsignada)) {
      safeUnlinkMany(uploadedFiles);
      return res.status(400).json({
        success: false,
        error: "La unidad asignada del usuario no es válida.",
      });
    }

    const hayIncidencia =
      golpesNorm === "Con detalle" ||
      gasolinaNorm === "Bajo" ||
      aceiteNorm === "Bajo" ||
      frenosNorm === "Bajo" ||
      llantasNorm === "Revisar" ||
      lucesNorm === "Revisar" ||
      parabrisasNorm === "Revisar" ||
      espejosNorm === "Revisar" ||
      limpiezaNorm === "Mala" ||
      nivelAguaNorm === "Bajo";

    if (hayIncidencia && uploadedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Debes adjuntar al menos una foto cuando exista una incidencia en la unidad.",
      });
    }

    const now = new Date();
    const fecha = now.toISOString().slice(0, 10);

    const [result]: any = await pool.query(
      `INSERT INTO inspecciones_unidad (
        user_id,
        unidad,
        turno,
        servicio,
        golpes_estado,
        gasolina_nivel,
        aceite_estado,
        liquido_frenos_estado,
        llantas_estado,
        luces_estado,
        parabrisas_estado,
        espejos_estado,
        limpieza_estado,
        nivel_agua_estado,
        observaciones,
        foto_url,
        fecha,
        hora
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        unidadAsignada,
        turnoNorm,
        servicioNorm,
        golpesNorm,
        gasolinaNorm,
        aceiteNorm,
        frenosNorm,
        llantasNorm,
        lucesNorm,
        parabrisasNorm,
        espejosNorm,
        limpiezaNorm,
        nivelAguaNorm,
        observacionesNorm,
        uploadedFiles[0]
          ? `/uploads/inspecciones_unidad/${uploadedFiles[0].filename}`
          : null,
        fecha,
        now,
      ]
    );

    const inspeccionId = result.insertId;

    if (uploadedFiles.length > 0) {
      const values = uploadedFiles.map((file) => [
        inspeccionId,
        `/uploads/inspecciones_unidad/${file.filename}`,
      ]);

      await pool.query(
        `INSERT INTO inspecciones_unidad_fotos (inspeccion_id, foto_url)
         VALUES ?`,
        [values]
      );
    }

    return res.json({
      success: true,
      item: {
        id: inspeccionId,
        user_id: userId,
        unidad: unidadAsignada,
        turno: turnoNorm,
        servicio: servicioNorm,
        golpes_estado: golpesNorm,
        gasolina_nivel: gasolinaNorm,
        aceite_estado: aceiteNorm,
        liquido_frenos_estado: frenosNorm,
        llantas_estado: llantasNorm,
        luces_estado: lucesNorm,
        parabrisas_estado: parabrisasNorm,
        espejos_estado: espejosNorm,
        limpieza_estado: limpiezaNorm,
        nivel_agua_estado: nivelAguaNorm,
        observaciones: observacionesNorm,
        fotos: uploadedFiles.map(
          (file) => `/uploads/inspecciones_unidad/${file.filename}`
        ),
        fecha,
        hora: now,
      },
    });
  } catch (err: any) {
    safeUnlinkMany(uploadedFiles);
    console.error("[UNIT INSPECTION POST ERROR]", err?.message || err);
    return res.status(500).json({
      success: false,
      error: "Error al guardar inspección de unidad",
      detail: err?.message || String(err),
    });
  }
});

router.get("/history", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "No autorizado",
      });
    }

    const rawLimit = Number(req.query.limit || 3);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(rawLimit, 20))
      : 3;

    const [rows]: any = await pool.query(
      `SELECT
         id,
         unidad,
         turno,
         servicio,
         golpes_estado,
         gasolina_nivel,
         aceite_estado,
         liquido_frenos_estado,
         llantas_estado,
         luces_estado,
         parabrisas_estado,
         espejos_estado,
         limpieza_estado,
         nivel_agua_estado,
         observaciones,
         foto_url,
         fecha,
         hora
       FROM inspecciones_unidad
       WHERE user_id = ?
       ORDER BY hora DESC
       LIMIT ?`,
      [userId, limit]
    );

    const inspeccionIds = rows.map((row: any) => row.id);

    let fotosPorInspeccion = new Map<number, string[]>();

    if (inspeccionIds.length > 0) {
      const [fotoRows]: any = await pool.query(
        `SELECT inspeccion_id, foto_url
         FROM inspecciones_unidad_fotos
         WHERE inspeccion_id IN (?)`,
        [inspeccionIds]
      );

      fotosPorInspeccion = fotoRows.reduce(
        (acc: Map<number, string[]>, row: any) => {
          const key = Number(row.inspeccion_id);
          const current = acc.get(key) || [];
          current.push(row.foto_url);
          acc.set(key, current);
          return acc;
        },
        new Map<number, string[]>()
      );
    }

    const items = rows.map((row: any) => ({
      ...row,
      fotos: fotosPorInspeccion.get(Number(row.id)) || (row.foto_url ? [row.foto_url] : []),
    }));

    return res.json({
      success: true,
      items,
    });
  } catch (err: any) {
    console.error("[UNIT INSPECTION HISTORY ERROR]", err?.message || err);
    return res.status(500).json({
      success: false,
      error: "Error al obtener historial de inspecciones",
    });
  }
});

export default router;