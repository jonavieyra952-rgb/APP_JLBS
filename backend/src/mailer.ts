import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // 587 = STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false, // ✅ solo para desarrollo
  },
});

export async function sendVerificationEmail(to: string, code: string) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const appName = process.env.APP_NAME || "App";

  console.log("--------------------------------------------------");
  console.log("[MAIL] Intentando enviar correo...");
  console.log("[MAIL] FROM:", from);
  console.log("[MAIL] TO:", to);
  console.log("[MAIL] CODE:", code);
  console.log("[MAIL] SMTP HOST:", process.env.SMTP_HOST);
  console.log("[MAIL] SMTP PORT:", process.env.SMTP_PORT);
  console.log("--------------------------------------------------");

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: `${appName} - Código de verificación`,
      text: `Tu código de verificación es: ${code}\n\nCaduca en 10 minutos.`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.4">
          <h2>${appName} - Verificación</h2>
          <p>Tu código de verificación es:</p>
          <div style="font-size: 28px; font-weight: 800; letter-spacing: 4px; margin: 12px 0;">
            ${code}
          </div>
          <p>Este código caduca en <b>10 minutos</b>.</p>
        </div>
      `,
    });

    console.log("[MAIL] ✅ Correo enviado correctamente");
    console.log("[MAIL] Message ID:", info.messageId);
    console.log("[MAIL] Accepted:", info.accepted);
    console.log("[MAIL] Rejected:", info.rejected);
    console.log("--------------------------------------------------");

    return info;
  } catch (error) {
    console.error("❌ [MAIL ERROR] Fallo al enviar correo:");
    console.error(error);
    console.log("--------------------------------------------------");
    throw error;
  }
}