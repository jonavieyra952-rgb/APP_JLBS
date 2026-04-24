import { Response } from "express";
import { pool } from "../db";
import { AuthRequest } from "../middleware/authMiddleware";

// Helper para combinar fecha + hora y validar si es pasada
function isPastDateTime(fecha: string, hora: string) {
  const assignedDate = new Date(`${fecha}T${hora}`);
  const now = new Date();
  return assignedDate.getTime() < now.getTime();
}

// Crear supervisión programada
export const createScheduledSupervision = async (req: AuthRequest, res: Response) => {
  try {
    const {
      supervisor_id,
      servicio_id,
      fecha,
      hora,
      hora_fin,
      observaciones,
    } = req.body;

    const creado_por = req.user?.id || null;

    if (!supervisor_id || !servicio_id || !fecha || !hora) {
      return res.status(400).json({
        ok: false,
        message: "supervisor_id, servicio_id, fecha y hora son obligatorios",
      });
    }

    if (isPastDateTime(fecha, hora)) {
      return res.status(400).json({
        ok: false,
        message: "No puedes programar una supervisión en una fecha/hora pasada",
      });
    }

    const [supervisorRows]: any = await pool.query(
      "SELECT id, nombre, role, activo FROM usuarios WHERE id = ? LIMIT 1",
      [supervisor_id]
    );

    if (!supervisorRows.length) {
      return res.status(404).json({
        ok: false,
        message: "Supervisor no encontrado",
      });
    }

    const supervisor = supervisorRows[0];

    if (supervisor.role !== "supervisor") {
      return res.status(400).json({
        ok: false,
        message: "El usuario seleccionado no tiene rol de supervisor",
      });
    }

    if (Number(supervisor.activo) !== 1) {
      return res.status(400).json({
        ok: false,
        message: "El supervisor seleccionado no está activo",
      });
    }

    const [serviceRows]: any = await pool.query(
      "SELECT id, nombre, activo FROM servicios WHERE id = ? LIMIT 1",
      [servicio_id]
    );

    if (!serviceRows.length) {
      return res.status(404).json({
        ok: false,
        message: "Servicio no encontrado",
      });
    }

    const service = serviceRows[0];

    if (service.activo !== undefined && Number(service.activo) !== 1) {
      return res.status(400).json({
        ok: false,
        message: "El servicio seleccionado no está activo",
      });
    }

    const [duplicateRows]: any = await pool.query(
      `SELECT id
       FROM supervision_programada
       WHERE supervisor_id = ? AND fecha = ? AND hora = ?
       LIMIT 1`,
      [supervisor_id, fecha, hora]
    );

    if (duplicateRows.length) {
      return res.status(409).json({
        ok: false,
        message: "Ese supervisor ya tiene una supervisión asignada en esa fecha y hora",
      });
    }

    const [result]: any = await pool.query(
      `INSERT INTO supervision_programada
       (supervisor_id, servicio_id, fecha, hora, hora_fin, observaciones, estado, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?)`,
      [
        supervisor_id,
        servicio_id,
        fecha,
        hora,
        hora_fin || null,
        observaciones || null,
        creado_por,
      ]
    );

    return res.status(201).json({
      ok: true,
      message: "Supervisión programada creada correctamente",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Error createScheduledSupervision:", error);
    return res.status(500).json({
      ok: false,
      message: "Error interno del servidor",
    });
  }
};

export const getAllScheduledSupervisions = async (req: AuthRequest, res: Response) => {
  try {
    const { supervisor_id, servicio_id, fecha, estado } = req.query;

    let sql = `
      SELECT
        sp.id,
        sp.supervisor_id,
        u.nombre AS supervisor_nombre,
        u.email AS supervisor_email,
        sp.servicio_id,
        s.nombre AS servicio_nombre,
        s.direccion AS servicio_direccion,
        sp.fecha,
        sp.hora,
        sp.hora_fin,
        sp.observaciones,
        sp.estado,
        sp.creado_por,
        creador.nombre AS creado_por_nombre,
        sp.created_at,
        sp.updated_at
      FROM supervision_programada sp
      INNER JOIN usuarios u ON sp.supervisor_id = u.id
      INNER JOIN servicios s ON sp.servicio_id = s.id
      LEFT JOIN usuarios creador ON sp.creado_por = creador.id
      WHERE 1 = 1
    `;

    const params: any[] = [];

    if (supervisor_id) {
      sql += " AND sp.supervisor_id = ?";
      params.push(supervisor_id);
    }

    if (servicio_id) {
      sql += " AND sp.servicio_id = ?";
      params.push(servicio_id);
    }

    if (fecha) {
      sql += " AND sp.fecha = ?";
      params.push(fecha);
    }

    if (estado) {
      sql += " AND sp.estado = ?";
      params.push(estado);
    }

    sql += " ORDER BY sp.fecha ASC, sp.hora ASC";

    const [rows]: any = await pool.query(sql, params);

    return res.status(200).json({
      ok: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error getAllScheduledSupervisions:", error);
    return res.status(500).json({
      ok: false,
      message: "Error interno del servidor",
    });
  }
};

export const getMyScheduledSupervisions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { fecha, estado } = req.query;

    let sql = `
      SELECT
        sp.id,
        sp.fecha,
        sp.hora,
        sp.hora_fin,
        sp.observaciones,
        sp.estado,
        s.id AS servicio_id,
        s.nombre AS servicio_nombre,
        s.direccion AS servicio_direccion,
        sp.created_at,
        sp.updated_at
      FROM supervision_programada sp
      INNER JOIN servicios s ON sp.servicio_id = s.id
      WHERE sp.supervisor_id = ?
    `;

    const params: any[] = [userId];

    if (fecha) {
      sql += " AND sp.fecha = ?";
      params.push(fecha);
    }

    if (estado) {
      sql += " AND sp.estado = ?";
      params.push(estado);
    }

    sql += " ORDER BY sp.fecha ASC, sp.hora ASC";

    const [rows]: any = await pool.query(sql, params);

    return res.status(200).json({
      ok: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error getMyScheduledSupervisions:", error);
    return res.status(500).json({
      ok: false,
      message: "Error interno del servidor",
    });
  }
};

export const updateScheduledSupervision = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      supervisor_id,
      servicio_id,
      fecha,
      hora,
      hora_fin,
      observaciones,
      estado,
    } = req.body;

    const [existingRows]: any = await pool.query(
      "SELECT * FROM supervision_programada WHERE id = ? LIMIT 1",
      [id]
    );

    if (!existingRows.length) {
      return res.status(404).json({
        ok: false,
        message: "Supervisión programada no encontrada",
      });
    }

    const current = existingRows[0];

    const newSupervisorId = supervisor_id ?? current.supervisor_id;
    const newServicioId = servicio_id ?? current.servicio_id;
    const newFecha = fecha ?? current.fecha;
    const newHora = hora ?? current.hora;
    const newHoraFin =
      hora_fin !== undefined ? hora_fin : current.hora_fin;
    const newObservaciones =
      observaciones !== undefined ? observaciones : current.observaciones;
    const newEstado = estado ?? current.estado;

    if (isPastDateTime(newFecha, newHora) && newEstado === "pendiente") {
      return res.status(400).json({
        ok: false,
        message: "No puedes dejar una supervisión pendiente en fecha/hora pasada",
      });
    }

    const [supervisorRows]: any = await pool.query(
      "SELECT id, role, activo FROM usuarios WHERE id = ? LIMIT 1",
      [newSupervisorId]
    );

    if (!supervisorRows.length) {
      return res.status(404).json({
        ok: false,
        message: "Supervisor no encontrado",
      });
    }

    if (supervisorRows[0].role !== "supervisor") {
      return res.status(400).json({
        ok: false,
        message: "El usuario seleccionado no tiene rol de supervisor",
      });
    }

    if (Number(supervisorRows[0].activo) !== 1) {
      return res.status(400).json({
        ok: false,
        message: "El supervisor seleccionado no está activo",
      });
    }

    const [serviceRows]: any = await pool.query(
      "SELECT id, activo FROM servicios WHERE id = ? LIMIT 1",
      [newServicioId]
    );

    if (!serviceRows.length) {
      return res.status(404).json({
        ok: false,
        message: "Servicio no encontrado",
      });
    }

    if (serviceRows[0].activo !== undefined && Number(serviceRows[0].activo) !== 1) {
      return res.status(400).json({
        ok: false,
        message: "El servicio seleccionado no está activo",
      });
    }

    const [duplicateRows]: any = await pool.query(
      `SELECT id
       FROM supervision_programada
       WHERE supervisor_id = ? AND fecha = ? AND hora = ? AND id <> ?
       LIMIT 1`,
      [newSupervisorId, newFecha, newHora, id]
    );

    if (duplicateRows.length) {
      return res.status(409).json({
        ok: false,
        message: "Ese supervisor ya tiene otra supervisión asignada en esa fecha y hora",
      });
    }

    await pool.query(
      `UPDATE supervision_programada
       SET supervisor_id = ?, servicio_id = ?, fecha = ?, hora = ?, hora_fin = ?,
           observaciones = ?, estado = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        newSupervisorId,
        newServicioId,
        newFecha,
        newHora,
        newHoraFin || null,
        newObservaciones,
        newEstado,
        id,
      ]
    );

    return res.status(200).json({
      ok: true,
      message: "Supervisión programada actualizada correctamente",
    });
  } catch (error) {
    console.error("Error updateScheduledSupervision:", error);
    return res.status(500).json({
      ok: false,
      message: "Error interno del servidor",
    });
  }
};

export const deleteScheduledSupervision = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [existingRows]: any = await pool.query(
      "SELECT id FROM supervision_programada WHERE id = ? LIMIT 1",
      [id]
    );

    if (!existingRows.length) {
      return res.status(404).json({
        ok: false,
        message: "Supervisión programada no encontrada",
      });
    }

    await pool.query("DELETE FROM supervision_programada WHERE id = ?", [id]);

    return res.status(200).json({
      ok: true,
      message: "Supervisión programada eliminada correctamente",
    });
  } catch (error) {
    console.error("Error deleteScheduledSupervision:", error);
    return res.status(500).json({
      ok: false,
      message: "Error interno del servidor",
    });
  }
};