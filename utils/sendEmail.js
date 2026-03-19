import { brevo } from "../config/brevo.js";

export async function sendEmail({ to, subject, html }) {
  return brevo.post("/smtp/email", {
    sender: {
      name: "Trippolama", // ✅ VERIFIED SENDER NAME
      email: "chandru.jerry@gmail.com", // ✅ VERIFIED IN BREVO
    },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  });
}
