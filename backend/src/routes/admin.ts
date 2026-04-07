import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db";
import { requireAuth, requireRole, AuthRequest } from "../middleware/authMiddleware";

const router = Router();

const ROLES_VALIDOS = ["guard", "supervisor", "admin"] as const;
const TURNOS_VALIDOS = ["Matutino", "Nocturno"] as const;
const UNIDADES_VALIDAS = [
  "Unidad 01",
  "Unidad 02",
  "Unidad 03",
  "Unidad 04",
  "Motocicleta 01",
] as const;

router.use(requireAuth, requireRole("admin"));

router.get("/users", async (_req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT
        id,
        nombre,
        email,
        turno,
        role,
        activo,
        verificado,
        unidad_asignada
       FROM usuarios
       ORDER BY id DESC`
    );

    return res.json({ success: true, users: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al obtener usuarios" });
  }
});

router.post("/users", async (req: AuthRequest, res) => {
  try {
    const { nombre, email, password, turno, role } = req.body;

    if (!nombre || !email || !password || !turno || !role) {
      return res.status(400).json({ success: false, error: "Faltan datos" });
    }

    const turnoNorm = String(turno).trim();
    const roleNorm = String(role).trim().toLowerCase();
    const emailNorm = String(email).trim().toLowerCase();

    if (!TURNOS_VALIDOS.includes(turnoNorm as (typeof TURNOS_VALIDOS)[number])) {
      return res.status(400).json({ success: false, error: "Turno inválido" });
    }

    if (!ROLES_VALIDOS.includes(roleNorm as (typeof ROLES_VALIDOS)[number])) {
      return res.status(400).json({ success: false, error: "Rol inválido" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNorm)) {
      return res.status(400).json({ success: false, error: "Correo inválido" });
    }

    const [exists]: any = await pool.query(
      "SELECT id FROM usuarios WHERE email = ? LIMIT 1",
      [emailNorm]
    );

    if (exists.length > 0) {
      return res.status(409).json({ success: false, error: "Ese correo ya existe" });
    }

    const password_hash = await bcrypt.hash(String(password), 10);

    const [result]: any = await pool.query(
      `INSERT INTO usuarios (
        nombre,
        email,
        password_hash,
        turno,
        role,
        activo,
        verificado,
        codigo_verificacion_hash,
        expiracion_codigo,
        unidad_asignada
      )
      VALUES (?, ?, ?, ?, ?, 1, 1, NULL, NULL, NULL)`,
      [nombre, emailNorm, password_hash, turnoNorm, roleNorm]
    );

    return res.json({
      success: true,
      message: "Usuario creado correctamente",
      user: {
        id: result.insertId,
        nombre,
        email: emailNorm,
        turno: turnoNorm,
        role: roleNorm,
        activo: 1,
        verificado: 1,
        unidad_asignada: null,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al crear usuario" });
  }
});

router.patch("/users/:id/role", async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    const { role } = req.body;

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    const roleNorm = String(role || "").trim().toLowerCase();

    if (!ROLES_VALIDOS.includes(roleNorm as (typeof ROLES_VALIDOS)[number])) {
      return res.status(400).json({ success: false, error: "Rol inválido" });
    }

    const [rows]: any = await pool.query(
      "SELECT id, role FROM usuarios WHERE id = ? LIMIT 1",
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Usuario no encontrado" });
    }

    if (req.user?.id === userId && roleNorm !== "admin") {
      return res.status(400).json({
        success: false,
        error: "No puedes quitarte a ti mismo el rol de administrador.",
      });
    }

    await pool.query("UPDATE usuarios SET role = ? WHERE id = ?", [roleNorm, userId]);

    return res.json({ success: true, message: "Rol actualizado correctamente" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al actualizar rol" });
  }
});

router.patch("/users/:id/status", async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    const { activo } = req.body;

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    const activoNorm = Number(activo) === 1 ? 1 : 0;

    const [rows]: any = await pool.query(
      "SELECT id, activo, role FROM usuarios WHERE id = ? LIMIT 1",
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Usuario no encontrado" });
    }

    if (req.user?.id === userId && activoNorm === 0) {
      return res.status(400).json({
        success: false,
        error: "No puedes desactivarte a ti mismo.",
      });
    }

    await pool.query("UPDATE usuarios SET activo = ? WHERE id = ?", [activoNorm, userId]);

    return res.json({
      success: true,
      message: activoNorm === 1 ? "Usuario activado" : "Usuario desactivado",
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al actualizar estado" });
  }
});

router.patch("/users/:id/assigned-unit", async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    const { unidad_asignada } = req.body;

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    const unidadNorm = String(unidad_asignada || "").trim();

    if (unidadNorm && !UNIDADES_VALIDAS.includes(unidadNorm as (typeof UNIDADES_VALIDAS)[number])) {
      return res.status(400).json({ success: false, error: "Unidad inválida" });
    }

    const [rows]: any = await pool.query(
      "SELECT id, role FROM usuarios WHERE id = ? LIMIT 1",
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Usuario no encontrado" });
    }

    await pool.query(
      "UPDATE usuarios SET unidad_asignada = ? WHERE id = ?",
      [unidadNorm || null, userId]
    );

    return res.json({
      success: true,
      message: unidadNorm
        ? "Unidad asignada correctamente"
        : "Unidad desasignada correctamente",
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al actualizar unidad asignada" });
  }
});

/**
 * ACTUALIZAR TURNO
 */
router.patch("/users/:id/shift", async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    const { turno } = req.body;

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    const turnoNorm = String(turno || "").trim();

    if (!TURNOS_VALIDOS.includes(turnoNorm as (typeof TURNOS_VALIDOS)[number])) {
      return res.status(400).json({ success: false, error: "Turno inválido. Debe ser Matutino o Nocturno." });
    }

    const [rows]: any = await pool.query(
      "SELECT id FROM usuarios WHERE id = ? LIMIT 1",
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Usuario no encontrado" });
    }

    await pool.query("UPDATE usuarios SET turno = ? WHERE id = ?", [turnoNorm, userId]);

    return res.json({ success: true, message: "Turno actualizado correctamente" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al actualizar el turno" });
  }
});

router.get("/unit-inspections/summary", async (_req, res) => {
  try {
    const [totalRows]: any = await pool.query(
      "SELECT COUNT(*) AS total FROM inspecciones_unidad"
    );

    const [incRows]: any = await pool.query(
      `SELECT COUNT(*) AS total
       FROM inspecciones_unidad
       WHERE golpes_estado = 'Con detalle'
          OR gasolina_nivel = 'Bajo'
          OR aceite_estado = 'Bajo'
          OR liquido_frenos_estado = 'Bajo'
          OR llantas_estado = 'Revisar'`
    );

    const [unitsRows]: any = await pool.query(
      "SELECT COUNT(DISTINCT unidad) AS total FROM inspecciones_unidad"
    );

    const [latestRows]: any = await pool.query(
      "SELECT MAX(hora) AS ultima_inspeccion FROM inspecciones_unidad"
    );

    return res.json({
      success: true,
      summary: {
        total: Number(totalRows?.[0]?.total || 0),
        incidencias: Number(incRows?.[0]?.total || 0),
        unidades: Number(unitsRows?.[0]?.total || 0),
        ultima_inspeccion: latestRows?.[0]?.ultima_inspeccion || null,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      success: false,
      error: "Error al obtener resumen de inspecciones",
    });
  }
});

router.get("/unit-inspections", async (req: AuthRequest, res) => {
  try {
    const unidad = String(req.query.unidad || "").trim();
    const guardia = String(req.query.guardia || "").trim();
    const fechaDesde = String(req.query.fecha_desde || "").trim();
    const fechaHasta = String(req.query.fecha_hasta || "").trim();
    const soloIncidencias = String(req.query.solo_incidencias || "").trim() === "1";
    const rawLimit = Number(req.query.limit || 100);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(rawLimit, 300))
      : 100;

    const where: string[] = [];
    const params: any[] = [];

    if (unidad) {
      where.push("i.unidad = ?");
      params.push(unidad);
    }

    if (guardia) {
      where.push("u.nombre LIKE ?");
      params.push(`%${guardia}%`);
    }

    if (fechaDesde) {
      where.push("i.fecha >= ?");
      params.push(fechaDesde);
    }

    if (fechaHasta) {
      where.push("i.fecha <= ?");
      params.push(fechaHasta);
    }

    if (soloIncidencias) {
      where.push(`(
        i.golpes_estado = 'Con detalle'
        OR i.gasolina_nivel = 'Bajo'
        OR i.aceite_estado = 'Bajo'
        OR i.liquido_frenos_estado = 'Bajo'
        OR i.llantas_estado = 'Revisar'
      )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows]: any = await pool.query(
      `SELECT
        i.id,
        i.user_id,
        i.unidad,
        i.turno,
        i.servicio,
        i.golpes_estado,
        i.gasolina_nivel,
        i.aceite_estado,
        i.liquido_frenos_estado,
        i.llantas_estado,
        i.observaciones,
        i.foto_url,
        i.fecha,
        i.hora,
        i.creado_en,
        u.nombre AS guardia_nombre,
        u.email AS guardia_email,
        CASE
          WHEN i.golpes_estado = 'Con detalle'
            OR i.gasolina_nivel = 'Bajo'
            OR i.aceite_estado = 'Bajo'
            OR i.liquido_frenos_estado = 'Bajo'
            OR i.llantas_estado = 'Revisar'
          THEN 1
          ELSE 0
        END AS hay_incidencia
      FROM inspecciones_unidad i
      INNER JOIN usuarios u ON u.id = i.user_id
      ${whereSql}
      ORDER BY i.hora DESC
      LIMIT ?`,
      [...params, limit]
    );

    return res.json({
      success: true,
      items: rows,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      success: false,
      error: "Error al obtener inspecciones de unidad",
    });
  }
});

export default router;