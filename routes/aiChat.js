import express from "express";
import Package from "../models/Package.js";
import { publicWriteLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const toSafeText = (value = "") => String(value || "").trim();

router.post("/chat", publicWriteLimiter, async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        message: "AI is not configured. Missing OPENAI_API_KEY on server.",
      });
    }

    const message = toSafeText(req.body?.message);
    const history = Array.isArray(req.body?.history) ? req.body.history : [];

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    const recentHistory = history
      .slice(-8)
      .map((item) => ({
        role: item?.role === "assistant" ? "assistant" : "user",
        content: toSafeText(item?.content).slice(0, 2000),
      }))
      .filter((item) => item.content);

    const packages = await Package.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .select("title serviceType location region price days stayType")
      .lean();

    const packageContext = packages
      .map(
        (pkg, idx) =>
          `${idx + 1}. ${pkg.title} | service=${pkg.serviceType || "general"} | location=${pkg.location || "N/A"} | region=${pkg.region || "N/A"} | price=${pkg.price ?? "N/A"} | duration=${pkg.days || "N/A"} | type=${pkg.stayType || "N/A"}`
      )
      .join("\n");

    const systemPrompt = `
You are Trippolama AI assistant for travel services.
Rules:
- Be concise, helpful, and friendly.
- Focus on Trippolama services: packages, acting driver service, bike rider service, guide service, booking help.
- If user asks about unavailable data, clearly say you are not sure and suggest contacting admin/WhatsApp.
- Never invent exact prices, policies, or guarantees not present in context.
- If asked to do unsafe/legal/medical/financial advice, decline briefly.
Business context (latest package snapshot):
${packageContext || "No package data available right now."}
`.trim();

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.4,
        max_tokens: 500,
        messages: [
          { role: "system", content: systemPrompt },
          ...recentHistory,
          { role: "user", content: message.slice(0, 4000) },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const errMessage =
        data?.error?.message || "AI request failed. Please try again.";
      return res.status(502).json({ message: errMessage });
    }

    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "I could not generate a response. Please try again.";

    return res.json({ reply });
  } catch (err) {
    console.error("AI CHAT ERROR:", err);
    return res.status(500).json({ message: "Failed to process AI chat request" });
  }
});

export default router;
