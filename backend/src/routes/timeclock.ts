import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { pool } from "../db";
import type { AuthRequest } from "../middleware/authMiddleware";

const router = Router();

const SERVICIOS_VALIDOS = [
  "Notaria 190",
  "Electro Motor Service",
  "Tubos Tollocan",
  "La Peninsular (Tramo Atarasquillo)",
  "La Peninsular (Tramo Xona)",
];

const JORNADAS_VALIDAS = ["12x12", "24x24", "48x48"];

const uploadDir = path.join(process.cwd(), "uploads", "fichajes");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const userId = (req as any).user?.id || "user";
    const ext = path.extname(file.originalname || "") || ".jpg";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    cb(null, `fichaje-${userId}-${stamp}${ext}`);
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

router.post("/punch", upload.single("foto"), async (req: AuthRequest, res) => {
  const uploadedFile = (req as any).file;

  try {
    console.log("=== NUEVO FICHAJE CON FOTO ===");
    console.log("BODY:", req.body);
    console.log("FILE:", uploadedFile ? uploadedFile.filename : "SIN ARCHIVO");

    const userId = req.user?.id;
    if (!userId) {
      if (uploadedFile?.path) fs.unlink(uploadedFile.path, () => {});
      return res.status(401).json({ success: false, error: "No autorizado" });
    }

    const { tipo, turno, lugar_trabajo, jornada, lat, lng } = req.body || {};

    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        error: "La foto es obligatoria para registrar entrada o salida.",
      });
    }

    if (!tipo || !turno || !lugar_trabajo || !jornada) {
      fs.unlink(uploadedFile.path, () => {});
      return res.status(400).json({
        success: false,
        error: "Faltan datos (tipo, turno, lugar_trabajo, jornada)",
      });
    }

    const tipoNorm = String(tipo).toUpperCase();
    const turnoNorm = String(turno);
    const servicioNorm = String(lugar_trabajo);
    const jornadaNorm = String(jornada);

    if (!["IN", "OUT"].includes(tipoNorm)) {
      fs.unlink(uploadedFile.path, () => {});
      return res
        .status(400)
        .json({ success: false, error: "Tipo inválido (IN/OUT)" });
    }

    if (!["Matutino", "Nocturno"].includes(turnoNorm)) {
      fs.unlink(uploadedFile.path, () => {});
      return res
        .status(400)
        .json({ success: false, error: "Turno inválido" });
    }

    if (!SERVICIOS_VALIDOS.includes(servicioNorm)) {
      fs.unlink(uploadedFile.path, () => {});
      return res
        .status(400)
        .json({ success: false, error: "Servicio inválido" });
    }

    if (!JORNADAS_VALIDAS.includes(jornadaNorm)) {
      fs.unlink(uploadedFile.path, () => {});
      return res
        .status(400)
        .json({ success: false, error: "Jornada inválida" });
    }

    const [lastRows]: any = await pool.query(
      `SELECT id, tipo, hora
       FROM fichajes
       WHERE user_id = ?
       ORDER BY hora DESC
       LIMIT 1`,
      [userId]
    );

    const lastPunch = lastRows.length > 0 ? lastRows[0] : null;
    const lastTipo = lastPunch ? String(lastPunch.tipo).toUpperCase() : null;

    if (tipoNorm === "IN" && lastTipo === "IN") {
      fs.unlink(uploadedFile.path, () => {});
      return res.status(409).json({
        success: false,
        error:
          "Ya tienes una entrada registrada sin salida. Primero registra la salida.",
      });
    }

    if (tipoNorm === "OUT") {
      if (!lastTipo) {
        fs.unlink(uploadedFile.path, () => {});
        return res.status(409).json({
          success: false,
          error:
            "No puedes registrar salida sin haber registrado una entrada antes.",
        });
      }

      if (lastTipo !== "IN") {
        fs.unlink(uploadedFile.path, () => {});
        return res.status(409).json({
          success: false,
          error:
            "La última acción no es una entrada válida. No puedes registrar otra salida.",
        });
      }
    }

    const latNum = lat !== undefined && lat !== "" ? Number(lat) : null;
    const lngNum = lng !== undefined && lng !== "" ? Number(lng) : null;

    const latFinal = Number.isFinite(latNum as number) ? latNum : null;
    const lngFinal = Number.isFinite(lngNum as number) ? lngNum : null;

    const now = new Date();
    const fecha = now.toISOString().slice(0, 10);
    const foto_url = `/uploads/fichajes/${uploadedFile.filename}`;

    console.log("INSERTANDO EN BD:", {
      userId,
      tipoNorm,
      turnoNorm,
      servicioNorm,
      jornadaNorm,
      fecha,
      latFinal,
      lngFinal,
      foto_url,
    });

    const [result]: any = await pool.query(
      `INSERT INTO fichajes (
        user_id, tipo, turno, lugar_trabajo, jornada, fecha, hora, lat, lng, foto_url
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        tipoNorm,
        turnoNorm,
        servicioNorm,
        jornadaNorm,
        fecha,
        now,
        latFinal,
        lngFinal,
        foto_url,
      ]
    );

    console.log("FICHAJE GUARDADO:", result.insertId);

    return res.json({
      success: true,
      item: {
        id: result.insertId,
        user_id: userId,
        tipo: tipoNorm,
        turno: turnoNorm,
        lugar_trabajo: servicioNorm,
        jornada: jornadaNorm,
        fecha,
        hora: now,
        lat: latFinal,
        lng: lngFinal,
        foto_url,
      },
    });
  } catch (err: any) {
    if (uploadedFile?.path) fs.unlink(uploadedFile.path, () => {});
    console.error("[TIMECLOCK PUNCH ERROR]", err?.message || err);
    console.error(err);

    return res.status(500).json({
      success: false,
      error: "Error al registrar fichaje",
      detail: err?.message || String(err),
    });
  }
});

router.get("/history", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "No autorizado" });
    }

    const rawLimit = Number(req.query.limit || 3);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(rawLimit, 20))
      : 3;

    const [rows]: any = await pool.query(
      `SELECT
         id,
         tipo,
         turno,
         lugar_trabajo AS servicio,
         jornada,
         fecha,
         hora
       FROM fichajes
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
    console.error("[TIMECLOCK HISTORY ERROR]", err?.message || err);
    return res.status(500).json({
      success: false,
      error: "Error al obtener historial",
    });
  }
});

export default router;