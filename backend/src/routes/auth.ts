import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db";
import { sendVerificationEmail } from "../mailer";
import { requireAuth, type AuthRequest } from "../middleware/authMiddleware";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "cambia_esto";
const CODE_TTL_MIN = Number(process.env.CODE_TTL_MINUTES || 10);

function makeCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * REGISTER
 * - Siempre crea usuarios como guard
 * - Crea usuario con verificado=0
 * - Genera código, guarda hash + expiración
 * - Envía correo
 * - El turno se asigna automáticamente por defecto usando catalogo_turnos
 */
router.post("/register", async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ success: false, error: "Faltan datos" });
    }

    const nombreNorm = String(nombre).trim();
    const emailNorm = String(email).trim().toLowerCase();
    const passwordNorm = String(password);

    if (!nombreNorm) {
      return res.status(400).json({ success: false, error: "El nombre es obligatorio" });
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
      return res.status(409).json({ success: false, error: "Ese email ya existe" });
    }

    const roleNorm = "guard";

    const [defaultShiftRows]: any = await pool.query(
      `SELECT id, nombre
       FROM catalogo_turnos
       WHERE activo = 1
       ORDER BY
         CASE
           WHEN nombre = 'Matutino' THEN 0
           WHEN nombre = 'Nocturno' THEN 1
           ELSE 2
         END,
         id ASC
       LIMIT 1`
    );

    if (defaultShiftRows.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No hay turnos activos disponibles en el catálogo.",
      });
    }

    const turnoId = Number(defaultShiftRows[0].id);

    const password_hash = await bcrypt.hash(passwordNorm, 10);

    const code = makeCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expires = addMinutes(new Date(), CODE_TTL_MIN);

    const [result]: any = await pool.query(
      `INSERT INTO usuarios (
        nombre,
        email,
        password_hash,
        turno_id,
        role,
        verificado,
        codigo_verificacion_hash,
        expiracion_codigo,
        activo
      )
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, 1)`,
      [nombreNorm, emailNorm, password_hash, turnoId, roleNorm, codeHash, expires]
    );

    await sendVerificationEmail(emailNorm, code);

    return res.json({
      success: true,
      message: "Registrado. Revisa tu correo para el código de verificación.",
      user: {
        id: result.insertId,
        nombre: nombreNorm,
        email: emailNorm,
        turno_id: turnoId,
        role: roleNorm,
        verificado: 0,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error en registro" });
  }
});

/**
 * VERIFY
 * - Verifica código y expiración
 * - Marca verificado=1 y limpia el código
 */
router.post("/verify", async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ success: false, error: "Faltan datos" });
    }

    const emailNorm = String(email).trim().toLowerCase();

    const [rows]: any = await pool.query(
      `SELECT id, verificado, codigo_verificacion_hash, expiracion_codigo
       FROM usuarios WHERE email = ? LIMIT 1`,
      [emailNorm]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Usuario no encontrado" });
    }

    const user = rows[0];

    if (user.verificado === 1) {
      return res.json({ success: true, message: "Tu cuenta ya estaba verificada." });
    }

    if (!user.codigo_verificacion_hash || !user.expiracion_codigo) {
      return res.status(400).json({
        success: false,
        error: "No hay código activo. Reenvía el código.",
      });
    }

    const exp = new Date(user.expiracion_codigo);

    if (Date.now() > exp.getTime()) {
      return res.status(400).json({
        success: false,
        error: "El código expiró. Reenvía el código.",
      });
    }

    const ok = await bcrypt.compare(String(code).trim(), user.codigo_verificacion_hash);

    if (!ok) {
      return res.status(400).json({ success: false, error: "Código incorrecto" });
    }

    await pool.query(
      `UPDATE usuarios
       SET verificado = 1, codigo_verificacion_hash = NULL, expiracion_codigo = NULL
       WHERE id = ?`,
      [user.id]
    );

    return res.json({ success: true, message: "Cuenta verificada con éxito." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al verificar" });
  }
});

/**
 * RESEND CODE
 */
router.post("/resend-code", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: "Faltan datos" });
    }

    const emailNorm = String(email).trim().toLowerCase();

    const [rows]: any = await pool.query(
      `SELECT id, verificado FROM usuarios WHERE email = ? LIMIT 1`,
      [emailNorm]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Usuario no encontrado" });
    }

    const user = rows[0];

    if (user.verificado === 1) {
      return res.json({ success: true, message: "Tu cuenta ya está verificada." });
    }

    const code = makeCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expires = addMinutes(new Date(), CODE_TTL_MIN);

    await pool.query(
      `UPDATE usuarios
       SET codigo_verificacion_hash = ?, expiracion_codigo = ?
       WHERE id = ?`,
      [codeHash, expires, user.id]
    );

    await sendVerificationEmail(emailNorm, code);

    return res.json({ success: true, message: "Código reenviado. Revisa tu correo." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al reenviar" });
  }
});

/**
 * LOGIN
 * - Bloquea si verificado=0
 * - Devuelve turno, unidad y servicio asignado si existen
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Faltan datos" });
    }

    const emailNorm = String(email).trim().toLowerCase();

    const [rows]: any = await pool.query(
      `SELECT
         u.id,
         u.nombre,
         u.email,
         u.password_hash,
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
       LEFT JOIN catalogo_turnos ct ON ct.id = u.turno_id
       LEFT JOIN unidades un ON un.id = u.unidad_id
       LEFT JOIN servicios s ON s.id = u.servicio_id
       WHERE u.email = ?
       LIMIT 1`,
      [emailNorm]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: "Credenciales inválidas" });
    }

    const user = rows[0];

    if (user.activo !== 1) {
      return res.status(403).json({ success: false, error: "Usuario desactivado" });
    }

    if (user.verificado !== 1) {
      return res.status(403).json({
        success: false,
        error: "Tu cuenta no está verificada. Revisa tu correo e ingresa el código.",
        needs_verification: true,
      });
    }

    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      return res.status(401).json({ success: false, error: "Credenciales inválidas" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role || "guard",
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        turno: user.turno || "",
        turno_id: user.turno_id ?? null,
        role: user.role || "guard",
        unidad_id: user.unidad_id ?? null,
        unidad_nombre: user.unidad_nombre || null,
        servicio_id: user.servicio_id ?? null,
        servicio_nombre: user.servicio_nombre || null,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error en login" });
  }
});

/**
 * PERFIL AUTENTICADO
 */
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: "No autorizado" });
    }

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
         s.nombre AS servicio_nombre,
         s.activo AS servicio_activo
       FROM usuarios u
       LEFT JOIN catalogo_turnos ct ON ct.id = u.turno_id
       LEFT JOIN unidades un ON un.id = u.unidad_id
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
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        turno: user.turno || "",
        turno_id: user.turno_id ?? null,
        role: user.role || "guard",
        activo: user.activo,
        verificado: user.verificado,
        unidad_id: user.unidad_id ?? null,
        unidad_nombre: user.unidad_nombre || null,
        servicio_id: user.servicio_id ?? null,
        servicio_nombre: user.servicio_nombre || null,
        servicio_activo: user.servicio_activo ?? null,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error al obtener perfil" });
  }
});

export default router;
