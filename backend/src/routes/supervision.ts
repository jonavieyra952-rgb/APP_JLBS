import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { pool } from "../db";
import { requireAuth, requireRole, AuthRequest } from "../middleware/authMiddleware";

const router = Router();

const uploadDir = path.join(process.cwd(), "uploads", "supervisiones");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const userId = (req as any).user?.id || "user";
    const ext = path.extname(file.originalname || "") || ".jpg";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    cb(null, `supervision-${userId}-${stamp}${ext}`);
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

/**
 * Crear supervisión
 * Solo supervisor o admin
 */
router.post(
  "/supervision/report",
  requireAuth,
  requireRole("supervisor", "admin"),
  upload.single("foto"),
  async (req: AuthRequest, res) => {
    const uploadedFile = (req as any).file;

    try {
      const userId = req.user?.id;
      if (!userId) {
        if (uploadedFile?.path) fs.unlink(uploadedFile.path, () => {});
        return res.status(401).json({ success: false, error: "No autorizado" });
      }

      const { servicio_id, turno, novedades, lat, lng, tipo } = req.body || {};

      if (!uploadedFile) {
        return res.status(400).json({
          success: false,
          error: "La foto es obligatoria para registrar la supervisión.",
        });
      }

      if (!servicio_id || !turno || !tipo) {
        fs.unlink(uploadedFile.path, () => {});
        return res.status(400).json({
          success: false,
          error: "Faltan datos (servicio_id, turno, tipo)",
        });
      }

      const tipoNorm = String(tipo).toUpperCase().trim();

      if (!["IN", "OUT"].includes(tipoNorm)) {
        fs.unlink(uploadedFile.path, () => {});
        return res.status(400).json({
          success: false,
          error: "Tipo inválido. Usa IN o OUT.",
        });
      }

      if (!["Matutino", "Nocturno"].includes(String(turno))) {
        fs.unlink(uploadedFile.path, () => {});
        return res.status(400).json({
          success: false,
          error: "Turno inválido",
        });
      }

      const servicioIdNum = Number(servicio_id);
      if (!Number.isFinite(servicioIdNum)) {
        fs.unlink(uploadedFile.path, () => {});
        return res.status(400).json({
          success: false,
          error: "Servicio inválido",
        });
      }

      const [serviceRows]: any = await pool.query(
        `SELECT id, nombre, activo
         FROM servicios
         WHERE id = ?
         LIMIT 1`,
        [servicioIdNum]
      );

      if (serviceRows.length === 0) {
        fs.unlink(uploadedFile.path, () => {});
        return res.status(404).json({
          success: false,
          error: "Servicio no encontrado",
        });
      }

      const servicio = serviceRows[0];

      if (servicio.activo !== 1) {
        fs.unlink(uploadedFile.path, () => {});
        return res.status(400).json({
          success: false,
          error: "El servicio está inactivo",
        });
      }

      const [lastRows]: any = await pool.query(
        `SELECT id, tipo, hora
         FROM supervisiones
         WHERE user_id = ? AND servicio_id = ?
         ORDER BY hora DESC, id DESC
         LIMIT 1`,
        [userId, servicio.id]
      );

      const lastMove = lastRows.length > 0 ? lastRows[0] : null;
      const lastTipo = lastMove ? String(lastMove.tipo || "").toUpperCase().trim() : null;

      if (tipoNorm === "IN") {
        if (lastTipo === "IN") {
          fs.unlink(uploadedFile.path, () => {});
          return res.status(409).json({
            success: false,
            error: "Ya tienes una entrada de supervisión abierta en este servicio. Primero registra la salida.",
          });
        }
      }

      if (tipoNorm === "OUT") {
        if (!lastTipo) {
          fs.unlink(uploadedFile.path, () => {});
          return res.status(409).json({
            success: false,
            error: "No puedes registrar salida sin haber registrado una entrada antes.",
          });
        }

        if (lastTipo !== "IN") {
          fs.unlink(uploadedFile.path, () => {});
          return res.status(409).json({
            success: false,
            error: "Ya no hay una entrada abierta para este servicio. No puedes registrar otra salida.",
          });
        }
      }

      const latNum = lat !== undefined && lat !== "" ? Number(lat) : null;
      const lngNum = lng !== undefined && lng !== "" ? Number(lng) : null;

      const latFinal = Number.isFinite(latNum as number) ? latNum : null;
      const lngFinal = Number.isFinite(lngNum as number) ? lngNum : null;

      const now = new Date();
      const fecha = now.toISOString().slice(0, 10);
      const foto_url = `/uploads/supervisiones/${uploadedFile.filename}`;

      const [result]: any = await pool.query(
        `INSERT INTO supervisiones (
          user_id,
          servicio_id,
          servicio_nombre,
          tipo,
          turno,
          novedades,
          lat,
          lng,
          foto_url,
          fecha,
          hora
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          servicio.id,
          servicio.nombre,
          tipoNorm,
          String(turno),
          novedades ? String(novedades).trim() : null,
          latFinal,
          lngFinal,
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
          servicio_id: servicio.id,
          servicio_nombre: servicio.nombre,
          tipo: tipoNorm,
          turno: String(turno),
          novedades: novedades ? String(novedades).trim() : null,
          lat: latFinal,
          lng: lngFinal,
          foto_url,
          fecha,
          hora: now,
        },
      });
    } catch (err: any) {
      if (uploadedFile?.path) fs.unlink(uploadedFile.path, () => {});
      console.error("[SUPERVISION REPORT ERROR]", err?.message || err);
      return res.status(500).json({
        success: false,
        error: "Error al registrar supervisión",
        detail: err?.message || String(err),
      });
    }
  }
);

/**
 * Historial del supervisor logueado
 */
router.get(
  "/supervision/history",
  requireAuth,
  requireRole("supervisor", "admin"),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: "No autorizado" });
      }

      const limit = Math.min(Number(req.query.limit || 20), 100);

      const [rows]: any = await pool.query(
        `SELECT
          id,
          servicio_id,
          servicio_nombre,
          tipo,
          turno,
          novedades,
          lat,
          lng,
          foto_url,
          fecha,
          hora
         FROM supervisiones
         WHERE user_id = ?
         ORDER BY hora DESC
         LIMIT ?`,
        [userId, limit]
      );

      return res.json({ success: true, items: rows });
    } catch (err: any) {
      console.error("[SUPERVISION HISTORY ERROR]", err?.message || err);
      return res.status(500).json({
        success: false,
        error: "Error al obtener historial de supervisión",
      });
    }
  }
);

/**
 * Historial de fichajes de guardias para supervisor/admin
 */
router.get(
  "/supervision/guards/history",
  requireAuth,
  requireRole("supervisor", "admin"),
  async (req: AuthRequest, res) => {
    try {
      const limit = Math.min(Number(req.query.limit || 50), 200);
      const fecha = req.query.fecha ? String(req.query.fecha).trim() : "";
      const turno = req.query.turno ? String(req.query.turno).trim() : "";
      const servicio = req.query.servicio ? String(req.query.servicio).trim() : "";
      const guardiaId = req.query.guardia_id ? Number(req.query.guardia_id) : null;

      let sql = `
        SELECT
          f.id,
          f.user_id,
          u.nombre AS guardia_nombre,
          u.email AS guardia_email,
          f.tipo,
          f.turno,
          f.lugar_trabajo,
          f.jornada,
          f.fecha,
          f.hora,
          f.lat,
          f.lng,
          f.foto_url
        FROM fichajes f
        INNER JOIN usuarios u ON u.id = f.user_id
        WHERE u.role = 'guard'
      `;

      const params: any[] = [];

      if (fecha) {
        sql += ` AND f.fecha = ?`;
        params.push(fecha);
      }

      if (turno) {
        sql += ` AND f.turno = ?`;
        params.push(turno);
      }

      if (servicio) {
        sql += ` AND f.lugar_trabajo = ?`;
        params.push(servicio);
      }

      if (guardiaId && Number.isFinite(guardiaId)) {
        sql += ` AND f.user_id = ?`;
        params.push(guardiaId);
      }

      sql += ` ORDER BY f.hora DESC LIMIT ?`;
      params.push(limit);

      const [rows]: any = await pool.query(sql, params);

      return res.json({
        success: true,
        items: rows,
      });
    } catch (err: any) {
      console.error("[SUPERVISION GUARDS HISTORY ERROR]", err?.message || err);
      return res.status(500).json({
        success: false,
        error: "Error al obtener fichajes de guardias",
      });
    }
  }
);

/**
 * Historial general para admin
 */
router.get(
  "/admin/supervision/history",
  requireAuth,
  requireRole("admin"),
  async (_req, res) => {
    try {
      const [rows]: any = await pool.query(
        `SELECT
          s.id,
          s.user_id,
          u.nombre AS supervisor_nombre,
          s.servicio_id,
          s.servicio_nombre,
          s.tipo,
          s.turno,
          s.novedades,
          s.lat,
          s.lng,
          s.foto_url,
          s.fecha,
          s.hora
         FROM supervisiones s
         INNER JOIN usuarios u ON u.id = s.user_id
         ORDER BY s.hora DESC
         LIMIT 200`
      );

      return res.json({ success: true, items: rows });
    } catch (err: any) {
      console.error("[ADMIN SUPERVISION HISTORY ERROR]", err?.message || err);
      return res.status(500).json({
        success: false,
        error: "Error al obtener supervisiones",
      });
    }
  }
);

export default router;