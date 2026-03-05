import axios from "axios";

if (!process.env.BREVO_API_KEY) {
  console.warn("⚠️  WARNING: BREVO_API_KEY is not set in environment variables.");
  console.warn("📧 Email notifications will not work until BREVO_API_KEY is configured.");
}

export const brevo = axios.create({
  baseURL: "https://api.brevo.com/v3",
  headers: {
    "api-key": process.env.BREVO_API_KEY || "",
    "Content-Type": "application/json",
    accept: "application/json",
  },
});

console.log("🔧 Brevo Configuration Loaded");
console.log("   API Key Set:", !!process.env.BREVO_API_KEY);
console.log("   Base URL: https://api.brevo.com/v3");
