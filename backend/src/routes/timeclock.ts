import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { pool } from "../db";
import type { AuthRequest } from "../middleware/authMiddleware";

const router = Router();

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

function safeUnlink(filePath?: string) {
  if (!filePath) return;
  fs.unlink(filePath, () => {});
}

router.get("/my-assigned-service", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: "No autorizado" });
    }

    const [rows]: any = await pool.query(
      `SELECT
         u.id,
         u.role,
         u.servicio_id,
         s.nombre AS servicio_nombre,
         s.activo AS servicio_activo
       FROM usuarios u
       LEFT JOIN servicios s ON s.id = u.servicio_id
       WHERE u.id = ?
       LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Usuario no encontrado" });
    }

    const user = rows[0];

    return res.json({
      success: true,
      service:
        user.servicio_id && user.servicio_nombre
          ? {
              id: Number(user.servicio_id),
              nombre: String(user.servicio_nombre),
              activo: Number(user.servicio_activo) === 1 ? 1 : 0,
            }
          : null,
    });
  } catch (err: any) {
    console.error("[MY ASSIGNED SERVICE ERROR]", err?.message || err);
    return res.status(500).json({
      success: false,
      error: "Error al obtener el servicio asignado",
    });
  }
});

router.get("/my-assigned-shift", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: "No autorizado" });
    }

    const [rows]: any = await pool.query(
      `SELECT
         u.id,
         u.role,
         u.turno_id,
         ct.nombre AS turno_nombre,
         ct.activo AS turno_activo
       FROM usuarios u
       LEFT JOIN catalogo_turnos ct ON ct.id = u.turno_id
       WHERE u.id = ?
       LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Usuario no encontrado" });
    }

    const user = rows[0];

    return res.json({
      success: true,
      shift:
        user.turno_id && user.turno_nombre
          ? {
              id: Number(user.turno_id),
              nombre: String(user.turno_nombre),
              activo: Number(user.turno_activo) === 1 ? 1 : 0,
            }
          : null,
    });
  } catch (err: any) {
    console.error("[MY ASSIGNED SHIFT ERROR]", err?.message || err);
    return res.status(500).json({
      success: false,
      error: "Error al obtener el turno asignado",
    });
  }
});

router.post("/punch", upload.single("foto"), async (req: AuthRequest, res) => {
  const uploadedFile = (req as any).file;

  try {
    console.log("=== NUEVO FICHAJE CON FOTO ===");
    console.log("BODY:", req.body);
    console.log("FILE:", uploadedFile ? uploadedFile.filename : "SIN ARCHIVO");

    const userId = req.user?.id;
    if (!userId) {
      safeUnlink(uploadedFile?.path);
      return res.status(401).json({ success: false, error: "No autorizado" });
    }

    const { tipo, jornada, lat, lng } = req.body || {};

    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        error: "La foto es obligatoria para registrar entrada o salida.",
      });
    }

    if (!tipo) {
      safeUnlink(uploadedFile.path);
      return res.status(400).json({
        success: false,
        error: "Falta el tipo de movimiento.",
      });
    }

    const tipoNorm = String(tipo).toUpperCase().trim();
    let jornadaNorm = jornada ? String(jornada).trim() : "";

    if (!["IN", "OUT"].includes(tipoNorm)) {
      safeUnlink(uploadedFile.path);
      return res.status(400).json({ success: false, error: "Tipo inválido (IN/OUT)" });
    }

    const [lastRows]: any = await pool.query(
      `SELECT id, tipo, hora, turno, lugar_trabajo, jornada
       FROM fichajes
       WHERE user_id = ?
       ORDER BY hora DESC
       LIMIT 1`,
      [userId]
    );

    const lastPunch = lastRows.length > 0 ? lastRows[0] : null;
    const lastTipo = lastPunch ? String(lastPunch.tipo).toUpperCase() : null;

    if (tipoNorm === "IN" && lastTipo === "IN") {
      safeUnlink(uploadedFile.path);
      return res.status(409).json({
        success: false,
        error: "Ya tienes una entrada registrada sin salida. Primero registra la salida.",
      });
    }

    if (tipoNorm === "OUT") {
      if (!lastTipo) {
        safeUnlink(uploadedFile.path);
        return res.status(409).json({
          success: false,
          error: "No puedes registrar salida sin haber registrado una entrada antes.",
        });
      }

      if (lastTipo !== "IN") {
        safeUnlink(uploadedFile.path);
        return res.status(409).json({
          success: false,
          error: "La última acción no es una entrada válida. No puedes registrar otra salida.",
        });
      }
    }

    let servicioNorm = "";
    let turnoNorm = "";

    if (tipoNorm === "IN") {
      const [userRows]: any = await pool.query(
        `SELECT
           u.id,
           u.role,
           u.turno_id,
           ct.nombre AS turno_nombre,
           ct.activo AS turno_activo,
           u.servicio_id,
           s.nombre AS servicio_nombre,
           s.activo AS servicio_activo
         FROM usuarios u
         LEFT JOIN catalogo_turnos ct ON ct.id = u.turno_id
         LEFT JOIN servicios s ON s.id = u.servicio_id
         WHERE u.id = ?
         LIMIT 1`,
        [userId]
      );

      if (userRows.length === 0) {
        safeUnlink(uploadedFile.path);
        return res.status(404).json({ success: false, error: "Usuario no encontrado" });
      }

      const user = userRows[0];

      if (String(user.role) !== "guard") {
        safeUnlink(uploadedFile.path);
        return res.status(403).json({
          success: false,
          error: "Solo los guardias pueden registrar fichajes en este módulo.",
        });
      }

      if (!user.servicio_id || !user.servicio_nombre) {
        safeUnlink(uploadedFile.path);
        return res.status(400).json({
          success: false,
          error: "No tienes un servicio asignado. Contacta al administrador.",
        });
      }

      if (Number(user.servicio_activo) !== 1) {
        safeUnlink(uploadedFile.path);
        return res.status(400).json({
          success: false,
          error: "Tu servicio asignado está inactivo. Contacta al administrador.",
        });
      }

      if (!user.turno_id || !user.turno_nombre) {
        safeUnlink(uploadedFile.path);
        return res.status(400).json({
          success: false,
          error: "No tienes un turno asignado. Contacta al administrador.",
        });
      }

      if (Number(user.turno_activo) !== 1) {
        safeUnlink(uploadedFile.path);
        return res.status(400).json({
          success: false,
          error: "Tu turno asignado está inactivo. Contacta al administrador.",
        });
      }

      servicioNorm = String(user.servicio_nombre).trim();
      turnoNorm = String(user.turno_nombre).trim();
    } else {
      servicioNorm = String(lastPunch?.lugar_trabajo || "").trim();
      turnoNorm = String(lastPunch?.turno || "").trim();

      if (!servicioNorm || !turnoNorm) {
        const [userRows]: any = await pool.query(
          `SELECT
             u.id,
             u.role,
             u.turno_id,
             ct.nombre AS turno_nombre,
             ct.activo AS turno_activo,
             u.servicio_id,
             s.nombre AS servicio_nombre,
             s.activo AS servicio_activo
           FROM usuarios u
           LEFT JOIN catalogo_turnos ct ON ct.id = u.turno_id
           LEFT JOIN servicios s ON s.id = u.servicio_id
           WHERE u.id = ?
           LIMIT 1`,
          [userId]
        );

        const user = userRows.length > 0 ? userRows[0] : null;

        if (!servicioNorm) {
          servicioNorm = String(user?.servicio_nombre || "").trim();
        }

        if (!turnoNorm) {
          turnoNorm = String(user?.turno_nombre || "").trim();
        }
      }

      if (!servicioNorm) {
        safeUnlink(uploadedFile.path);
        return res.status(400).json({
          success: false,
          error: "No se pudo determinar el servicio de la entrada abierta.",
        });
      }

      if (!turnoNorm) {
        safeUnlink(uploadedFile.path);
        return res.status(400).json({
          success: false,
          error: "No se pudo determinar el turno de la entrada abierta.",
        });
      }
    }

    if (!jornadaNorm) {
      if (tipoNorm === "OUT") {
        jornadaNorm = String(lastPunch?.jornada || "").trim();
      }

      if (!jornadaNorm) {
        jornadaNorm = turnoNorm;
      }
    }

    if (!JORNADAS_VALIDAS.includes(jornadaNorm)) {
      safeUnlink(uploadedFile.path);
      return res.status(400).json({
        success: false,
        error: "No se pudo determinar una jornada válida para el fichaje.",
      });
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
        servicio: servicioNorm,
        jornada: jornadaNorm,
        fecha,
        hora: now,
        lat: latFinal,
        lng: lngFinal,
        foto_url,
      },
    });
  } catch (err: any) {
    safeUnlink(uploadedFile?.path);
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
      ? Math.max(1, Math.min(rawLimit, 30))
      : 3;

    const [rows]: any = await pool.query(
      `SELECT
         id,
         tipo,
         turno,
         lugar_trabajo,
         lugar_trabajo AS servicio,
         jornada,
         fecha,
         hora,
         lat,
         lng,
         foto_url
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
