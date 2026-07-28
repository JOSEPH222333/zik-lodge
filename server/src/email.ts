import nodemailer from "nodemailer";

type SendOtpInput = {
  to: string;
  code: string;
  purpose: "signup" | "password_reset";
};

// SMTP is optional locally; when absent, OTPs are logged and returned to the dev client.
function smtpReady() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

// Sends signup/password-reset OTP messages through SMTP or development fallback logging.
export async function sendOtpEmail({ to, code, purpose }: SendOtpInput) {
  const subject = purpose === "password_reset" ? "Reset your Zik Lodge password" : "Verify your Zik Lodge email";
  const intro = purpose === "password_reset"
    ? "Thank you for using Zik Lodge. We received a request to reset your password."
    : "Thank you for creating a Zik Lodge account. Use this code to finish verifying your email.";
  const text = `${intro}\n\nYour OTP is ${code}. It expires in 10 minutes.\n\nIf you did not request this, you can safely ignore this email.`;

  if (!smtpReady()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP is not configured. Add SMTP_HOST, SMTP_USER, and SMTP_PASS before sending OTP emails.");
    }
    console.log(`[DEV EMAIL] ${subject} for ${to}: ${code}`);
    return { delivered: false, devFallback: true };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? `"Zik Lodge" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html: `<p>${intro}</p><p>Your OTP is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p><p>If you did not request this, you can safely ignore this email.</p>`
  });

  return { delivered: true, devFallback: false };
}
