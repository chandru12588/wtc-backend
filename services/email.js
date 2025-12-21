import nodemailer from "nodemailer";

export async function sendEmail(to, subject, text) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // your gmail
        pass: process.env.EMAIL_PASS, // app password
      },
    });

    await transporter.sendMail({
      from: `"WrongTurn Club" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
    });

    console.log(`📧 Email sent to ${to}`);
  } catch (err) {
    console.error("Email send error:", err);
  }
}
