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
      `SELECT
        s.id,
        s.nombre,
        s.direccion,
        s.responsable_cliente,
        s.telefono_contacto,
        s.guardias_requeridos,
        s.turno_id,
        ct.nombre AS turno,
        s.activo,
        s.created_at
       FROM servicios s
       LEFT JOIN catalogo_turnos ct ON ct.id = s.turno_id
       ORDER BY s.id DESC`
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
      turno_id,
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

    const turnoIdNorm =
      turno_id === null || turno_id === "" || typeof turno_id === "undefined"
        ? null
        : Number(turno_id);

    if (turnoIdNorm === null || !Number.isFinite(turnoIdNorm)) {
      return res.status(400).json({ success: false, error: "Debes seleccionar un turno válido" });
    }

    const [shiftRows]: any = await pool.query(
      "SELECT id, nombre, activo FROM catalogo_turnos WHERE id = ? LIMIT 1",
      [turnoIdNorm]
    );

    if (shiftRows.length === 0) {
      return res.status(400).json({ success: false, error: "El turno seleccionado no existe" });
    }

    if (Number(shiftRows[0].activo) !== 1) {
      return res.status(400).json({ success: false, error: "El turno seleccionado está inactivo" });
    }

    const [exists]: any = await pool.query(
      "SELECT id FROM servicios WHERE nombre = ? LIMIT 1",
      [nombreNorm]
    );

    if (exists.length > 0) {
      return res.status(409).json({ success: false, error: "Ese servicio ya existe" });
    }

    const [result]: any = await pool.query(
      `INSERT INTO servicios (
        nombre,
        direccion,
        responsable_cliente,
        telefono_contacto,
        guardias_requeridos,
        turno_id,
        activo
      )
      VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [nombreNorm, direccionNorm, responsableNorm, telefonoNorm, guardiasFinal, turnoIdNorm]
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
        turno_id: turnoIdNorm,
        turno: String(shiftRows[0].nombre),
        activo: 1,
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
      turno_id,
      activo,
      created_at,
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

    const fechaAltaNorm =
      created_at && String(created_at).trim() ? `${String(created_at).trim()} 00:00:00` : null;

    const turnoIdNorm =
      turno_id === null || turno_id === "" || typeof turno_id === "undefined"
        ? null
        : Number(turno_id);

    if (turnoIdNorm === null || !Number.isFinite(turnoIdNorm)) {
      return res.status(400).json({ success: false, error: "Debes seleccionar un turno válido" });
    }

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
      return res
        .status(409)
        .json({ success: false, error: "Ya existe otro servicio con ese nombre" });
    }

    const [shiftRows]: any = await pool.query(
      "SELECT id, nombre, activo FROM catalogo_turnos WHERE id = ? LIMIT 1",
      [turnoIdNorm]
    );

    if (shiftRows.length === 0) {
      return res.status(400).json({ success: false, error: "El turno seleccionado no existe" });
    }

    if (Number(shiftRows[0].activo) !== 1) {
      return res.status(400).json({ success: false, error: "El turno seleccionado está inactivo" });
    }

    await pool.query(
      `UPDATE servicios
       SET
         nombre = ?,
         direccion = ?,
         responsable_cliente = ?,
         telefono_contacto = ?,
         guardias_requeridos = ?,
         turno_id = ?,
         activo = ?,
         created_at = COALESCE(?, created_at)
       WHERE id = ?`,
      [
        nombreNorm,
        direccionNorm,
        responsableNorm,
        telefonoNorm,
        guardiasFinal,
        turnoIdNorm,
        activoNorm,
        fechaAltaNorm,
        serviceId,
      ]
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

    await pool.query("UPDATE servicios SET activo = ? WHERE id = ?", [activoNorm, serviceId]);

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
      `SELECT
        s.id,
        s.nombre,
        s.direccion,
        s.responsable_cliente,
        s.telefono_contacto,
        s.guardias_requeridos,
        s.turno_id,
        ct.nombre AS turno
       FROM servicios s
       LEFT JOIN catalogo_turnos ct ON ct.id = s.turno_id
       WHERE s.activo = 1
       ORDER BY s.nombre ASC`
    );

    return res.json({ success: true, services: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al obtener servicios activos" });
  }
});

export default router;