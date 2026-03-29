import express from "express";
import Package from "../models/Package.js";
import AppSetting from "../models/AppSetting.js";
import { publicWriteLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const toSafeText = (value = "") => String(value || "").trim();
const AI_CHAT_SETTING_KEY = "ai_chat_enabled";

const getAiChatEnabled = async () => {
  const setting = await AppSetting.findOne({ key: AI_CHAT_SETTING_KEY }).lean();
  if (!setting) return true;
  return setting.value !== false;
};

const tokenize = (text = "") =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w && w.length > 2);

router.get("/settings", async (_req, res) => {
  try {
    const enabled = await getAiChatEnabled();
    res.json({ enabled });
  } catch (err) {
    console.error("AI SETTINGS ERROR:", err);
    res.status(500).json({ message: "Failed to load AI settings" });
  }
});

router.post("/chat", publicWriteLimiter, async (req, res) => {
  try {
    const enabled = await getAiChatEnabled();
    if (!enabled) {
      return res.status(403).json({
        message: "AI chat is currently disabled by admin.",
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.json({
        reply:
          "AI assistant is currently unavailable. Please contact admin on WhatsApp for quick help.",
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
      if (data?.error?.code === "insufficient_quota") {
        return res.json({
          reply:
            "AI assistant is temporarily unavailable due to usage limits. Please contact admin on WhatsApp.",
        });
      }
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

router.post("/recommendations", publicWriteLimiter, async (req, res) => {
  try {
    const query = toSafeText(req.body?.query);
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    const historyText = history
      .slice(-6)
      .map((item) => toSafeText(item?.content))
      .join(" ");

    const signal = `${query} ${historyText}`.trim();
    if (!signal) {
      return res.status(400).json({ message: "Query is required" });
    }

    const tokens = tokenize(signal);
    if (!tokens.length) {
      return res.json({ recommendations: [] });
    }

    const packages = await Package.find()
      .sort({ createdAt: -1 })
      .limit(120)
      .select(
        "_id title description serviceType location region category stayType tags price images"
      )
      .lean();

    const scored = packages
      .map((pkg) => {
        const haystack = [
          pkg.title,
          pkg.description,
          pkg.serviceType,
          pkg.location,
          pkg.region,
          pkg.category,
          pkg.stayType,
          ...(Array.isArray(pkg.tags) ? pkg.tags : []),
        ]
          .join(" ")
          .toLowerCase();

        let score = 0;
        const matched = [];
        for (const token of tokens) {
          if (haystack.includes(token)) {
            score += 1;
            matched.push(token);
          }
        }

        if (
          tokens.some((t) => ["driver", "acting", "chauffeur"].includes(t)) &&
          String(pkg.serviceType || "").toLowerCase() === "driver"
        ) {
          score += 2;
        }
        if (
          tokens.some((t) => ["bike", "pillion", "rider"].includes(t)) &&
          String(pkg.serviceType || "").toLowerCase() === "bike"
        ) {
          score += 2;
        }
        if (
          tokens.some((t) => ["guide", "tour"].includes(t)) &&
          String(pkg.serviceType || "").toLowerCase() === "guide"
        ) {
          score += 2;
        }

        return { pkg, score, matched };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => ({
        _id: item.pkg._id,
        title: item.pkg.title,
        serviceType: item.pkg.serviceType || "general",
        location: item.pkg.location || "",
        region: item.pkg.region || "",
        price: item.pkg.price ?? null,
        image: item.pkg.images?.[0] || "",
        reason: item.matched.length
          ? `Matched keywords: ${item.matched.slice(0, 4).join(", ")}`
          : "Best relevant match",
      }));

    return res.json({ recommendations: scored });
  } catch (err) {
    console.error("AI RECOMMENDATIONS ERROR:", err);
    return res.status(500).json({ message: "Failed to get recommendations" });
  }
});

export default router;
