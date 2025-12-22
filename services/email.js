import nodemailer from "nodemailer";

export const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 60000,
  greetingTimeout: 60000,
  socketTimeout: 60000,
});

mailer.verify((error) => {
  if (error) {
    console.error("❌ BREVO SMTP ERROR:", error);
  } else {
    console.log("✅ BREVO SMTP CONNECTED");
  }
});
