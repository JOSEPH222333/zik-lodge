import nodemailer from "nodemailer";

type SendOtpInput = {
  to: string;
  code: string;
  purpose: "signup" | "password_reset";
};

function smtpReady() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendOtpEmail({ to, code, purpose }: SendOtpInput) {
  const subject = purpose === "password_reset" ? "Reset your Zik Lodge password" : "Verify your Zik Lodge email";
  const text = `Your Zik Lodge OTP is ${code}. It expires in 10 minutes.`;

  if (!smtpReady()) {
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
    html: `<p>Your Zik Lodge OTP is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`
  });

  return { delivered: true, devFallback: false };
}
