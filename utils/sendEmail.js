import { brevo } from "../config/brevo.js";

export async function sendEmail({ to, subject, html }) {
  return brevo.post("/smtp/email", {
    sender: {
      name: "WrongTurn Club",
      email: "noreply@wrongturnclub.in",
    },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  });
}
