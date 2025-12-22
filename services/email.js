import nodemailer from "nodemailer";

export const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,          // smtp-relay.brevo.com
  port: Number(process.env.SMTP_PORT),  // 587
  secure: false,                        // MUST be false for 587
  auth: {
    user: process.env.SMTP_USER,        // 9e8c66001@smtp-brevo.com
    pass: process.env.SMTP_PASS,        // xsmtpsib-xxxxxxxx
  },
  connectionTimeout: 60000,
  greetingTimeout: 60000,
  socketTimeout: 60000,
});

// ✅ Verify SMTP ONCE when server starts
mailer.verify((error) => {
  if (error) {
    console.error("❌ BREVO SMTP ERROR:", error);
  } else {
    console.log("✅ BREVO SMTP CONNECTED");
  }
});
