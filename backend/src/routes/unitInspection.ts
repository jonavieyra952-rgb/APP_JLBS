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

const uploadDir = path.join(process.cwd(), "uploads", "inspecciones_unidad");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const userId = (req as any).user?.id || "user";
    const ext = path.extname(file.originalname || "") || ".jpg";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    cb(null, `inspeccion-${userId}-${stamp}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Solo se permiten imágenes"));
  },
});

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

router.post("/", upload.single("foto"), async (req: AuthRequest, res) => {
  const uploadedFile = (req as any).file;

  try {
    const userId = req.user?.id;

    if (!userId) {
      if (uploadedFile?.path) fs.unlink(uploadedFile.path, () => {});
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
      !observaciones
    ) {
      if (uploadedFile?.path) fs.unlink(uploadedFile.path, () => {});
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
    const observacionesNorm = String(observaciones).trim();

    if (!TURNOS_VALIDOS.includes(turnoNorm)) {
      if (uploadedFile?.path) fs.unlink(uploadedFile.path, () => {});
      return res.status(400).json({
        success: false,
        error: "Turno inválido",
      });
    }

    if (!SERVICIOS_VALIDOS.includes(servicioNorm)) {
      if (uploadedFile?.path) fs.unlink(uploadedFile.path, () => {});
      return res.status(400).json({
        success: false,
        error: "Servicio inválido",
      });
    }

    if (!GOLPES_VALIDOS.includes(golpesNorm)) {
      if (uploadedFile?.path) fs.unlink(uploadedFile.path, () => {});
      return res.status(400).json({
        success: false,
        error: "Valor inválido en golpes_estado",
      });
    }

    if (!GASOLINA_VALIDOS.includes(gasolinaNorm)) {
      if (uploadedFile?.path) fs.unlink(uploadedFile.path, () => {});
      return res.status(400).json({
        success: false,
        error: "Valor inválido en gasolina_nivel",
      });
    }

    if (!ACEITE_VALIDOS.includes(aceiteNorm)) {
      if (uploadedFile?.path) fs.unlink(uploadedFile.path, () => {});
      return res.status(400).json({
        success: false,
        error: "Valor inválido en aceite_estado",
      });
    }

    if (!FRENOS_VALIDOS.includes(frenosNorm)) {
      if (uploadedFile?.path) fs.unlink(uploadedFile.path, () => {});
      return res.status(400).json({
        success: false,
        error: "Valor inválido en liquido_frenos_estado",
      });
    }

    if (!LLANTAS_VALIDOS.includes(llantasNorm)) {
      if (uploadedFile?.path) fs.unlink(uploadedFile.path, () => {});
      return res.status(400).json({
        success: false,
        error: "Valor inválido en llantas_estado",
      });
    }

    if (observacionesNorm.length < 3) {
      if (uploadedFile?.path) fs.unlink(uploadedFile.path, () => {});
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
      if (uploadedFile?.path) fs.unlink(uploadedFile.path, () => {});
      return res.status(404).json({
        success: false,
        error: "Usuario no encontrado",
      });
    }

    const unidadAsignada = String(user.unidad_asignada || "").trim();

    if (!unidadAsignada) {
      if (uploadedFile?.path) fs.unlink(uploadedFile.path, () => {});
      return res.status(400).json({
        success: false,
        error: "No tienes una unidad asignada. Contacta al administrador.",
      });
    }

    if (!UNIDADES_VALIDAS.includes(unidadAsignada)) {
      if (uploadedFile?.path) fs.unlink(uploadedFile.path, () => {});
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
      llantasNorm === "Revisar";

    if (hayIncidencia && !uploadedFile) {
      return res.status(400).json({
        success: false,
        error:
          "Debes adjuntar una foto cuando exista una incidencia en la unidad.",
      });
    }

    const now = new Date();
    const fecha = now.toISOString().slice(0, 10);
    const foto_url = uploadedFile
      ? `/uploads/inspecciones_unidad/${uploadedFile.filename}`
      : null;

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
        observaciones,
        foto_url,
        fecha,
        hora
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        observacionesNorm,
        foto_url,
        fecha,
        now,
      ]
    );

    return res.json({
      success: true,
      item: {
        id: result.insertId,
        user_id: userId,
        unidad: unidadAsignada,
        turno: turnoNorm,
        servicio: servicioNorm,
        golpes_estado: golpesNorm,
        gasolina_nivel: gasolinaNorm,
        aceite_estado: aceiteNorm,
        liquido_frenos_estado: frenosNorm,
        llantas_estado: llantasNorm,
        observaciones: observacionesNorm,
        foto_url,
        fecha,
        hora: now,
      },
    });
  } catch (err: any) {
    if (uploadedFile?.path) fs.unlink(uploadedFile.path, () => {});
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

    return res.json({
      success: true,
      items: rows,
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