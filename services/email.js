import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,          // smtp-relay.brevo.com
  port: Number(process.env.SMTP_PORT),  // 587
  secure: false,                        // MUST be false for port 587
  auth: {
    user: process.env.SMTP_USER,        // 9e8c66001@smtp-brevo.com
    pass: process.env.SMTP_PASS,        // xsmtpsib-xxxxxx
  },
  connectionTimeout: 60000,
  greetingTimeout: 60000,
  socketTimeout: 60000,
});

// Verify SMTP on server start
transporter.verify((error) => {
  if (error) {
    console.error("❌ BREVO SMTP ERROR:", error);
  } else {
    console.log("✅ BREVO SMTP CONNECTED");
  }
});

export async function sendEmail(to, subject, text, html = null) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM, // noreply@brevo.com
      to,
      subject,
      text,
      html,
    });

    console.log(`📧 Email sent to ${to}`);
  } catch (err) {
    console.error("❌ Email send error:", err);
  }
}
