import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db";
import { sendVerificationEmail } from "../mailer";

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
 */
router.post("/register", async (req, res) => {
  try {
    const { nombre, email, password, turno } = req.body;

    if (!nombre || !email || !password || !turno) {
      return res.status(400).json({ success: false, error: "Faltan datos" });
    }

    if (!["Matutino", "Nocturno"].includes(turno)) {
      return res.status(400).json({ success: false, error: "Turno inválido" });
    }

    const roleNorm = "guard";

    const emailNorm = String(email).trim().toLowerCase();
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

    const password_hash = await bcrypt.hash(password, 10);

    const code = makeCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expires = addMinutes(new Date(), CODE_TTL_MIN);

    const [result]: any = await pool.query(
      `INSERT INTO usuarios (
        nombre,
        email,
        password_hash,
        turno,
        role,
        verificado,
        codigo_verificacion_hash,
        expiracion_codigo
      )
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      [nombre, emailNorm, password_hash, turno, roleNorm, codeHash, expires]
    );

    await sendVerificationEmail(emailNorm, code);

    return res.json({
      success: true,
      message: "Registrado. Revisa tu correo para el código de verificación.",
      user: {
        id: result.insertId,
        nombre,
        email: emailNorm,
        turno,
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
 * - Sigue devolviendo role para futuros supervisores/admins creados desde panel web
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Faltan datos" });
    }

    const emailNorm = String(email).trim().toLowerCase();

    const [rows]: any = await pool.query(
      `SELECT id, nombre, email, password_hash, turno, role, activo, verificado
       FROM usuarios
       WHERE email = ?
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
        turno: user.turno,
        role: user.role || "guard",
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Error en login" });
  }
});

export default router;