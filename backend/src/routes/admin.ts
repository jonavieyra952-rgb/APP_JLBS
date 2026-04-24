import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db";
import { requireAuth, requireRole, AuthRequest } from "../middleware/authMiddleware";

const router = Router();

const ROLES_VALIDOS = ["guard", "supervisor", "admin"] as const;
const ROLES_CON_UNIDAD = ["guard", "supervisor"] as const;
const ROLES_CON_SERVICIO = ["guard"] as const;

const puedeTenerUnidad = (role: string) =>
  ROLES_CON_UNIDAD.includes(role as (typeof ROLES_CON_UNIDAD)[number]);

const puedeTenerServicio = (role: string) =>
  ROLES_CON_SERVICIO.includes(role as (typeof ROLES_CON_SERVICIO)[number]);

router.use(requireAuth, requireRole("admin"));

/**
 * ============================
 * USUARIOS
 * ============================
 */
router.get("/users", async (_req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT
        u.id,
        u.nombre,
        u.email,
        u.turno_id,
        ct.nombre AS turno,
        u.role,
        u.activo,
        u.verificado,
        u.unidad_id,
        un.nombre AS unidad_nombre,
        u.servicio_id,
        s.nombre AS servicio_nombre
       FROM usuarios u
       LEFT JOIN unidades un ON un.id = u.unidad_id
       LEFT JOIN servicios s ON s.id = u.servicio_id
       LEFT JOIN catalogo_turnos ct ON ct.id = u.turno_id
       ORDER BY u.id DESC`
    );

    return res.json({ success: true, users: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al obtener usuarios" });
  }
});

router.post("/users", async (req: AuthRequest, res) => {
  try {
    const { nombre, email, password, turno_id, role, unidad_id, servicio_id } = req.body;

    if (!nombre || !email || !password || !role) {
      return res.status(400).json({ success: false, error: "Faltan datos" });
    }

    const nombreNorm = String(nombre).trim();
    const roleNorm = String(role).trim().toLowerCase();
    const emailNorm = String(email).trim().toLowerCase();
    const turnoIdNorm =
      turno_id === null || turno_id === "" || typeof turno_id === "undefined"
        ? null
        : Number(turno_id);

    const unidadIdNorm =
      unidad_id === null || unidad_id === "" || typeof unidad_id === "undefined"
        ? null
        : Number(unidad_id);

    const servicioIdNorm =
      servicio_id === null || servicio_id === "" || typeof servicio_id === "undefined"
        ? null
        : Number(servicio_id);

    if (!nombreNorm) {
      return res.status(400).json({ success: false, error: "El nombre es obligatorio" });
    }

    if (!ROLES_VALIDOS.includes(roleNorm as (typeof ROLES_VALIDOS)[number])) {
      return res.status(400).json({ success: false, error: "Rol inválido" });
    }

    if (turnoIdNorm === null || !Number.isFinite(turnoIdNorm)) {
      return res.status(400).json({ success: false, error: "Debes seleccionar un turno válido" });
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

    let unidadIdFinal: number | null = null;

    if (puedeTenerUnidad(roleNorm) && unidadIdNorm !== null) {
      if (!Number.isFinite(unidadIdNorm)) {
        return res.status(400).json({
          success: false,
          error: "Unidad inválida.",
        });
      }

      const [unitRows]: any = await pool.query(
        "SELECT id, nombre, activa FROM unidades WHERE id = ? LIMIT 1",
        [unidadIdNorm]
      );

      if (unitRows.length === 0) {
        return res.status(400).json({
          success: false,
          error: "La unidad seleccionada no existe.",
        });
      }

      if (Number(unitRows[0].activa) !== 1) {
        return res.status(400).json({
          success: false,
          error: "La unidad seleccionada está inactiva.",
        });
      }

      unidadIdFinal = Number(unitRows[0].id);
    }

    let servicioIdFinal: number | null = null;

    if (puedeTenerServicio(roleNorm)) {
      if (servicioIdNorm === null || !Number.isFinite(servicioIdNorm)) {
        return res.status(400).json({
          success: false,
          error: "Debes seleccionar un servicio válido para el guardia.",
        });
      }

      const [serviceRows]: any = await pool.query(
        "SELECT id, nombre, activo FROM servicios WHERE id = ? LIMIT 1",
        [servicioIdNorm]
      );

      if (serviceRows.length === 0) {
        return res.status(400).json({
          success: false,
          error: "El servicio seleccionado no existe.",
        });
      }

      if (Number(serviceRows[0].activo) !== 1) {
        return res.status(400).json({
          success: false,
          error: "El servicio seleccionado está inactivo.",
        });
      }

      servicioIdFinal = Number(serviceRows[0].id);
    }

    const password_hash = await bcrypt.hash(String(password), 10);

    const [result]: any = await pool.query(
      `INSERT INTO usuarios (
        nombre,
        email,
        password_hash,
        turno_id,
        role,
        activo,
        verificado,
        codigo_verificacion_hash,
        expiracion_codigo,
        unidad_id,
        servicio_id
      )
      VALUES (?, ?, ?, ?, ?, 1, 1, NULL, NULL, ?, ?)`,
      [
        nombreNorm,
        emailNorm,
        password_hash,
        turnoIdNorm,
        roleNorm,
        unidadIdFinal,
        servicioIdFinal,
      ]
    );

    return res.json({
      success: true,
      message: "Usuario creado correctamente",
      user: {
        id: result.insertId,
        nombre: nombreNorm,
        email: emailNorm,
        turno: String(shiftRows[0].nombre),
        turno_id: turnoIdNorm,
        role: roleNorm,
        activo: 1,
        verificado: 1,
        unidad_id: unidadIdFinal,
        unidad_nombre: null,
        servicio_id: servicioIdFinal,
        servicio_nombre: null,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al crear usuario" });
  }
});

router.patch("/users/:id", async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    const { nombre, email, turno_id, role, unidad_id, servicio_id, activo } = req.body;

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    const nombreNorm = String(nombre || "").trim();
    const emailNorm = String(email || "").trim().toLowerCase();
    const roleNorm = String(role || "").trim().toLowerCase();
    const activoNorm = Number(activo) === 1 ? 1 : 0;

    const turnoIdNorm =
      turno_id === null || turno_id === "" || typeof turno_id === "undefined"
        ? null
        : Number(turno_id);

    const unidadIdNorm =
      unidad_id === null || unidad_id === "" || typeof unidad_id === "undefined"
        ? null
        : Number(unidad_id);

    const servicioIdNorm =
      servicio_id === null || servicio_id === "" || typeof servicio_id === "undefined"
        ? null
        : Number(servicio_id);

    if (!nombreNorm) {
      return res.status(400).json({ success: false, error: "El nombre es obligatorio" });
    }

    if (!emailNorm) {
      return res.status(400).json({ success: false, error: "El correo es obligatorio" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNorm)) {
      return res.status(400).json({ success: false, error: "Correo inválido" });
    }

    if (!ROLES_VALIDOS.includes(roleNorm as (typeof ROLES_VALIDOS)[number])) {
      return res.status(400).json({ success: false, error: "Rol inválido" });
    }

    if (turnoIdNorm === null || !Number.isFinite(turnoIdNorm)) {
      return res.status(400).json({ success: false, error: "Debes seleccionar un turno válido" });
    }

    const [rows]: any = await pool.query(
      "SELECT id, role, activo, email FROM usuarios WHERE id = ? LIMIT 1",
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Usuario no encontrado" });
    }

    const [emailRows]: any = await pool.query(
      "SELECT id FROM usuarios WHERE email = ? AND id <> ? LIMIT 1",
      [emailNorm, userId]
    );

    if (emailRows.length > 0) {
      return res.status(409).json({ success: false, error: "Ese correo ya existe" });
    }

    if (req.user?.id === userId && roleNorm !== "admin") {
      return res.status(400).json({
        success: false,
        error: "No puedes quitarte a ti mismo el rol de administrador.",
      });
    }

    if (req.user?.id === userId && activoNorm === 0) {
      return res.status(400).json({
        success: false,
        error: "No puedes desactivarte a ti mismo.",
      });
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

    let unidadIdFinal: number | null = null;

    if (puedeTenerUnidad(roleNorm)) {
      if (unidadIdNorm !== null) {
        if (!Number.isFinite(unidadIdNorm)) {
          return res.status(400).json({
            success: false,
            error: "Unidad inválida.",
          });
        }

        const [unitRows]: any = await pool.query(
          "SELECT id, activa FROM unidades WHERE id = ? LIMIT 1",
          [unidadIdNorm]
        );

        if (unitRows.length === 0) {
          return res.status(400).json({
            success: false,
            error: "La unidad seleccionada no existe.",
          });
        }

        if (Number(unitRows[0].activa) !== 1) {
          return res.status(400).json({
            success: false,
            error: "La unidad seleccionada está inactiva.",
          });
        }

        unidadIdFinal = Number(unitRows[0].id);
      }
    }

    let servicioIdFinal: number | null = null;

    if (puedeTenerServicio(roleNorm)) {
      if (servicioIdNorm === null || !Number.isFinite(servicioIdNorm)) {
        return res.status(400).json({
          success: false,
          error: "Debes seleccionar un servicio válido para el guardia.",
        });
      }

      const [serviceRows]: any = await pool.query(
        "SELECT id, activo FROM servicios WHERE id = ? LIMIT 1",
        [servicioIdNorm]
      );

      if (serviceRows.length === 0) {
        return res.status(400).json({
          success: false,
          error: "El servicio seleccionado no existe.",
        });
      }

      if (Number(serviceRows[0].activo) !== 1) {
        return res.status(400).json({
          success: false,
          error: "El servicio seleccionado está inactivo.",
        });
      }

      servicioIdFinal = Number(serviceRows[0].id);
    }

    await pool.query(
      `UPDATE usuarios
       SET
         nombre = ?,
         email = ?,
         turno_id = ?,
         role = ?,
         unidad_id = ?,
         servicio_id = ?,
         activo = ?
       WHERE id = ?`,
      [
        nombreNorm,
        emailNorm,
        turnoIdNorm,
        roleNorm,
        unidadIdFinal,
        servicioIdFinal,
        activoNorm,
        userId,
      ]
    );

    return res.json({
      success: true,
      message: "Usuario actualizado correctamente",
      user: {
        id: userId,
        nombre: nombreNorm,
        email: emailNorm,
        turno: String(shiftRows[0].nombre),
        turno_id: turnoIdNorm,
        role: roleNorm,
        activo: activoNorm,
        unidad_id: unidadIdFinal,
        servicio_id: servicioIdFinal,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al actualizar usuario" });
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

    await pool.query(
      `UPDATE usuarios
       SET role = ?,
           unidad_id = CASE WHEN ? IN ('guard', 'supervisor') THEN unidad_id ELSE NULL END,
           servicio_id = CASE WHEN ? = 'guard' THEN servicio_id ELSE NULL END
       WHERE id = ?`,
      [roleNorm, roleNorm, roleNorm, userId]
    );

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
    const { unidad_id } = req.body;

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    const unidadIdNorm =
      unidad_id === null || unidad_id === "" || typeof unidad_id === "undefined"
        ? null
        : Number(unidad_id);

    const [rows]: any = await pool.query(
      "SELECT id, role FROM usuarios WHERE id = ? LIMIT 1",
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Usuario no encontrado" });
    }

    const userRow = rows[0];

    if (!puedeTenerUnidad(userRow.role)) {
      return res.status(400).json({
        success: false,
        error: "Solo guardias y supervisores pueden tener unidad asignada.",
      });
    }

    let unidadIdFinal: number | null = null;

    if (unidadIdNorm !== null) {
      if (!Number.isFinite(unidadIdNorm)) {
        return res.status(400).json({
          success: false,
          error: "Unidad inválida.",
        });
      }

      const [unitRows]: any = await pool.query(
        "SELECT id, activa FROM unidades WHERE id = ? LIMIT 1",
        [unidadIdNorm]
      );

      if (unitRows.length === 0) {
        return res.status(400).json({
          success: false,
          error: "La unidad seleccionada no existe.",
        });
      }

      if (Number(unitRows[0].activa) !== 1) {
        return res.status(400).json({
          success: false,
          error: "La unidad seleccionada está inactiva.",
        });
      }

      unidadIdFinal = Number(unitRows[0].id);
    }

    await pool.query("UPDATE usuarios SET unidad_id = ? WHERE id = ?", [
      unidadIdFinal,
      userId,
    ]);

    return res.json({
      success: true,
      message: unidadIdFinal
        ? "Unidad asignada correctamente"
        : "Unidad desasignada correctamente",
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al actualizar unidad asignada" });
  }
});

router.patch("/users/:id/assigned-service", async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    const { servicio_id } = req.body;

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    const servicioIdNorm =
      servicio_id === null || servicio_id === "" || typeof servicio_id === "undefined"
        ? null
        : Number(servicio_id);

    const [rows]: any = await pool.query(
      "SELECT id, role FROM usuarios WHERE id = ? LIMIT 1",
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Usuario no encontrado" });
    }

    const userRow = rows[0];

    if (!puedeTenerServicio(userRow.role)) {
      return res.status(400).json({
        success: false,
        error: "Solo los guardias pueden tener servicio asignado.",
      });
    }

    if (servicioIdNorm === null || !Number.isFinite(servicioIdNorm)) {
      return res.status(400).json({
        success: false,
        error: "Debes seleccionar un servicio válido para el guardia.",
      });
    }

    const [serviceRows]: any = await pool.query(
      "SELECT id, activo FROM servicios WHERE id = ? LIMIT 1",
      [servicioIdNorm]
    );

    if (serviceRows.length === 0) {
      return res.status(400).json({
        success: false,
        error: "El servicio seleccionado no existe.",
      });
    }

    if (Number(serviceRows[0].activo) !== 1) {
      return res.status(400).json({
        success: false,
        error: "El servicio seleccionado está inactivo.",
      });
    }

    await pool.query("UPDATE usuarios SET servicio_id = ? WHERE id = ?", [
      Number(serviceRows[0].id),
      userId,
    ]);

    return res.json({
      success: true,
      message: "Servicio asignado correctamente",
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al actualizar servicio asignado" });
  }
});

router.patch("/users/:id/shift", async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    const { turno_id } = req.body;

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    const turnoIdNorm =
      turno_id === null || turno_id === "" || typeof turno_id === "undefined"
        ? null
        : Number(turno_id);

    if (turnoIdNorm === null || !Number.isFinite(turnoIdNorm)) {
      return res.status(400).json({ success: false, error: "Debes seleccionar un turno válido" });
    }

    const [rows]: any = await pool.query(
      "SELECT id FROM usuarios WHERE id = ? LIMIT 1",
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Usuario no encontrado" });
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

    await pool.query("UPDATE usuarios SET turno_id = ? WHERE id = ?", [turnoIdNorm, userId]);

    return res.json({ success: true, message: "Turno actualizado correctamente" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al actualizar el turno" });
  }
});

/**
 * ============================
 * SERVICIOS
 * ============================
 */
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

router.post("/services", async (req: AuthRequest, res) => {
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
      [
        nombreNorm,
        direccionNorm,
        responsableNorm,
        telefonoNorm,
        guardiasFinal,
        turnoIdNorm,
      ]
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
        turno: String(shiftRows[0].nombre),
        turno_id: turnoIdNorm,
        activo: 1,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al crear servicio" });
  }
});

router.put("/services/:id", async (req: AuthRequest, res) => {
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
        created_at || null,
        serviceId,
      ]
    );

    return res.json({
      success: true,
      message: "Servicio actualizado correctamente",
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al actualizar servicio" });
  }
});

router.patch("/services/:id/status", async (req: AuthRequest, res) => {
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
    return res.status(500).json({
      success: false,
      error: "Error al actualizar estado del servicio",
    });
  }
});

router.delete("/services/:id", async (req: AuthRequest, res) => {
  try {
    const serviceId = Number(req.params.id);

    if (!serviceId || Number.isNaN(serviceId)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    const [rows]: any = await pool.query(
      "SELECT id FROM servicios WHERE id = ? LIMIT 1",
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
 * UNIDADES
 * ============================
 */
router.get("/units", async (_req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT id, nombre, tipo, placa, descripcion, activa, created_at
       FROM unidades
       ORDER BY id DESC`
    );

    return res.json({ success: true, units: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al obtener unidades" });
  }
});

router.post("/units", async (req: AuthRequest, res) => {
  try {
    const { nombre, tipo, placa, descripcion } = req.body;

    const nombreNorm = String(nombre || "").trim();
    const tipoNorm = String(tipo || "").trim() || null;
    const placaNorm = String(placa || "").trim() || null;
    const descripcionNorm = String(descripcion || "").trim() || null;

    if (!nombreNorm) {
      return res.status(400).json({
        success: false,
        error: "El nombre de la unidad es obligatorio",
      });
    }

    const [exists]: any = await pool.query(
      "SELECT id FROM unidades WHERE nombre = ? LIMIT 1",
      [nombreNorm]
    );

    if (exists.length > 0) {
      return res.status(409).json({ success: false, error: "Esa unidad ya existe" });
    }

    const [result]: any = await pool.query(
      `INSERT INTO unidades (nombre, tipo, placa, descripcion, activa)
       VALUES (?, ?, ?, ?, 1)`,
      [nombreNorm, tipoNorm, placaNorm, descripcionNorm]
    );

    return res.json({
      success: true,
      message: "Unidad creada correctamente",
      unit: {
        id: result.insertId,
        nombre: nombreNorm,
        tipo: tipoNorm,
        placa: placaNorm,
        descripcion: descripcionNorm,
        activa: 1,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al crear unidad" });
  }
});

router.put("/units/:id", async (req: AuthRequest, res) => {
  try {
    const unitId = Number(req.params.id);
    const { nombre, tipo, placa, descripcion, activa } = req.body;

    if (!unitId || Number.isNaN(unitId)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    const nombreNorm = String(nombre || "").trim();
    const tipoNorm = String(tipo || "").trim() || null;
    const placaNorm = String(placa || "").trim() || null;
    const descripcionNorm = String(descripcion || "").trim() || null;
    const activaNorm = Number(activa) === 0 ? 0 : 1;

    if (!nombreNorm) {
      return res.status(400).json({
        success: false,
        error: "El nombre de la unidad es obligatorio",
      });
    }

    const [rows]: any = await pool.query(
      "SELECT id FROM unidades WHERE id = ? LIMIT 1",
      [unitId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Unidad no encontrada" });
    }

    const [duplicate]: any = await pool.query(
      "SELECT id FROM unidades WHERE nombre = ? AND id <> ? LIMIT 1",
      [nombreNorm, unitId]
    );

    if (duplicate.length > 0) {
      return res
        .status(409)
        .json({ success: false, error: "Ya existe otra unidad con ese nombre" });
    }

    await pool.query(
      `UPDATE unidades
       SET nombre = ?, tipo = ?, placa = ?, descripcion = ?, activa = ?
       WHERE id = ?`,
      [nombreNorm, tipoNorm, placaNorm, descripcionNorm, activaNorm, unitId]
    );

    return res.json({ success: true, message: "Unidad actualizada correctamente" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al actualizar unidad" });
  }
});

router.patch("/units/:id/status", async (req: AuthRequest, res) => {
  try {
    const unitId = Number(req.params.id);
    const { activa } = req.body;

    if (!unitId || Number.isNaN(unitId)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    const activaNorm = Number(activa) === 1 ? 1 : 0;

    const [rows]: any = await pool.query(
      "SELECT id FROM unidades WHERE id = ? LIMIT 1",
      [unitId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Unidad no encontrada" });
    }

    await pool.query("UPDATE unidades SET activa = ? WHERE id = ?", [activaNorm, unitId]);

    if (activaNorm === 0) {
      await pool.query("UPDATE usuarios SET unidad_id = NULL WHERE unidad_id = ?", [unitId]);
    }

    return res.json({
      success: true,
      message: activaNorm === 1 ? "Unidad activada" : "Unidad desactivada",
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      success: false,
      error: "Error al actualizar estado de la unidad",
    });
  }
});

router.delete("/units/:id", async (req: AuthRequest, res) => {
  try {
    const unitId = Number(req.params.id);

    if (!unitId || Number.isNaN(unitId)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    const [rows]: any = await pool.query(
      "SELECT id, nombre FROM unidades WHERE id = ? LIMIT 1",
      [unitId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Unidad no encontrada" });
    }

    await pool.query("UPDATE usuarios SET unidad_id = NULL WHERE unidad_id = ?", [unitId]);
    await pool.query("DELETE FROM unidades WHERE id = ?", [unitId]);

    return res.json({
      success: true,
      message: "Unidad eliminada correctamente",
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al eliminar unidad" });
  }
});

/**
 * ============================
 * CATALOGO DE TURNOS
 * ============================
 */
router.get("/shifts", async (_req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT id, nombre, descripcion, activo, created_at
       FROM catalogo_turnos
       ORDER BY id DESC`
    );

    return res.json({ success: true, shifts: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al obtener turnos" });
  }
});

router.post("/shifts", async (req: AuthRequest, res) => {
  try {
    const { nombre, descripcion } = req.body;

    const nombreNorm = String(nombre || "").trim();
    const descripcionNorm = String(descripcion || "").trim() || null;

    if (!nombreNorm) {
      return res.status(400).json({
        success: false,
        error: "El nombre del turno es obligatorio",
      });
    }

    const [exists]: any = await pool.query(
      "SELECT id FROM catalogo_turnos WHERE nombre = ? LIMIT 1",
      [nombreNorm]
    );

    if (exists.length > 0) {
      return res.status(409).json({ success: false, error: "Ese turno ya existe" });
    }

    const [result]: any = await pool.query(
      `INSERT INTO catalogo_turnos (nombre, descripcion, activo)
       VALUES (?, ?, 1)`,
      [nombreNorm, descripcionNorm]
    );

    return res.json({
      success: true,
      message: "Turno creado correctamente",
      shift: {
        id: result.insertId,
        nombre: nombreNorm,
        descripcion: descripcionNorm,
        activo: 1,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al crear turno" });
  }
});

router.patch("/shifts/:id/status", async (req: AuthRequest, res) => {
  try {
    const shiftId = Number(req.params.id);
    const { activo } = req.body;

    if (!shiftId || Number.isNaN(shiftId)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    const activoNorm = Number(activo) === 1 ? 1 : 0;

    const [rows]: any = await pool.query(
      "SELECT id FROM catalogo_turnos WHERE id = ? LIMIT 1",
      [shiftId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Turno no encontrado" });
    }

    await pool.query("UPDATE catalogo_turnos SET activo = ? WHERE id = ?", [
      activoNorm,
      shiftId,
    ]);

    return res.json({
      success: true,
      message: activoNorm === 1 ? "Turno activado" : "Turno desactivado",
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      success: false,
      error: "Error al actualizar estado del turno",
    });
  }
});

router.delete("/shifts/:id", async (req: AuthRequest, res) => {
  try {
    const shiftId = Number(req.params.id);

    if (!shiftId || Number.isNaN(shiftId)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    const [rows]: any = await pool.query(
      "SELECT id, nombre FROM catalogo_turnos WHERE id = ? LIMIT 1",
      [shiftId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Turno no encontrado" });
    }

    await pool.query("DELETE FROM catalogo_turnos WHERE id = ?", [shiftId]);

    return res.json({
      success: true,
      message: "Turno eliminado correctamente",
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al eliminar turno" });
  }
});

/**
 * ============================
 * INSPECCIONES DE UNIDAD
 * ============================
 */
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