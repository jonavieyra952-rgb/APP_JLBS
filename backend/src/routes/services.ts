import { Router } from "express";
import { pool } from "../db";
import { requireAuth, requireRole, AuthRequest } from "../middleware/authMiddleware";

const router = Router();

/**
 * ============================
 * RUTAS ADMIN (solo admin)
 * ============================
 */

// Listar todos los servicios
router.get("/admin/services", requireAuth, requireRole("admin"), async (_req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT id, nombre, direccion, responsable_cliente, telefono_contacto, guardias_requeridos, activo, created_at
       FROM servicios
       ORDER BY id DESC`
    );

    return res.json({ success: true, services: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al obtener servicios" });
  }
});

// Crear servicio
router.post("/admin/services", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const {
      nombre,
      direccion,
      responsable_cliente,
      telefono_contacto,
      guardias_requeridos,
      activo,
    } = req.body;

    if (!nombre) {
      return res.status(400).json({ success: false, error: "El nombre es obligatorio" });
    }

    const nombreNorm = String(nombre).trim();
    const direccionNorm = direccion ? String(direccion).trim() : null;
    const responsableNorm = responsable_cliente ? String(responsable_cliente).trim() : null;
    const telefonoNorm = telefono_contacto ? String(telefono_contacto).trim() : null;

    const guardiasNum = Number(guardias_requeridos);
    const guardiasFinal = Number.isFinite(guardiasNum) && guardiasNum > 0 ? guardiasNum : 1;

    const activoNorm = Number(activo) === 0 ? 0 : 1;

    const [exists]: any = await pool.query(
      "SELECT id FROM servicios WHERE nombre = ? LIMIT 1",
      [nombreNorm]
    );

    if (exists.length > 0) {
      return res.status(409).json({ success: false, error: "Ese servicio ya existe" });
    }

    const [result]: any = await pool.query(
      `INSERT INTO servicios (nombre, direccion, responsable_cliente, telefono_contacto, guardias_requeridos, activo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nombreNorm, direccionNorm, responsableNorm, telefonoNorm, guardiasFinal, activoNorm]
    );

    return res.json({
      success: true,
      message: "Servicio creado correctamente",
      service: {
        id: result.insertId,
        nombre: nombreNorm,
        direccion: direccionNorm,
        responsable_cliente: responsableNorm,
        telefono_contacto: telefonoNorm,
        guardias_requeridos: guardiasFinal,
        activo: activoNorm,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al crear servicio" });
  }
});

// Editar servicio
router.put("/admin/services/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const serviceId = Number(req.params.id);
    const {
      nombre,
      direccion,
      responsable_cliente,
      telefono_contacto,
      guardias_requeridos,
      activo,
    } = req.body;

    if (!serviceId || Number.isNaN(serviceId)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    if (!nombre) {
      return res.status(400).json({ success: false, error: "El nombre es obligatorio" });
    }

    const nombreNorm = String(nombre).trim();
    const direccionNorm = direccion ? String(direccion).trim() : null;
    const responsableNorm = responsable_cliente ? String(responsable_cliente).trim() : null;
    const telefonoNorm = telefono_contacto ? String(telefono_contacto).trim() : null;

    const guardiasNum = Number(guardias_requeridos);
    const guardiasFinal = Number.isFinite(guardiasNum) && guardiasNum > 0 ? guardiasNum : 1;

    const activoNorm = Number(activo) === 0 ? 0 : 1;

    const [rows]: any = await pool.query(
      "SELECT id FROM servicios WHERE id = ? LIMIT 1",
      [serviceId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Servicio no encontrado" });
    }

    const [duplicate]: any = await pool.query(
      "SELECT id FROM servicios WHERE nombre = ? AND id <> ? LIMIT 1",
      [nombreNorm, serviceId]
    );

    if (duplicate.length > 0) {
      return res.status(409).json({ success: false, error: "Ya existe otro servicio con ese nombre" });
    }

    await pool.query(
      `UPDATE servicios
       SET nombre = ?, direccion = ?, responsable_cliente = ?, telefono_contacto = ?, guardias_requeridos = ?, activo = ?
       WHERE id = ?`,
      [nombreNorm, direccionNorm, responsableNorm, telefonoNorm, guardiasFinal, activoNorm, serviceId]
    );

    return res.json({ success: true, message: "Servicio actualizado correctamente" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al actualizar servicio" });
  }
});

// Activar / desactivar servicio
router.patch("/admin/services/:id/status", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const serviceId = Number(req.params.id);
    const { activo } = req.body;

    if (!serviceId || Number.isNaN(serviceId)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    const activoNorm = Number(activo) === 1 ? 1 : 0;

    const [rows]: any = await pool.query(
      "SELECT id FROM servicios WHERE id = ? LIMIT 1",
      [serviceId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Servicio no encontrado" });
    }

    await pool.query(
      "UPDATE servicios SET activo = ? WHERE id = ?",
      [activoNorm, serviceId]
    );

    return res.json({
      success: true,
      message: activoNorm === 1 ? "Servicio activado" : "Servicio desactivado",
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al actualizar estado del servicio" });
  }
});

// Eliminar servicio
router.delete("/admin/services/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const serviceId = Number(req.params.id);

    if (!serviceId || Number.isNaN(serviceId)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    const [rows]: any = await pool.query(
      "SELECT id, nombre FROM servicios WHERE id = ? LIMIT 1",
      [serviceId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Servicio no encontrado" });
    }

    await pool.query("DELETE FROM servicios WHERE id = ?", [serviceId]);

    return res.json({
      success: true,
      message: "Servicio eliminado correctamente",
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al eliminar servicio" });
  }
});

/**
 * ============================
 * RUTA PÚBLICA / APP
 * ============================
 */

// Listar servicios activos
router.get("/services", async (_req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT id, nombre, direccion, responsable_cliente, telefono_contacto, guardias_requeridos
       FROM servicios
       WHERE activo = 1
       ORDER BY nombre ASC`
    );

    return res.json({ success: true, services: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al obtener servicios activos" });
  }
});

export default router;