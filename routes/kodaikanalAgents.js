import express from "express";
import mongoose from "mongoose";
import KodaikanalTravelAgent from "../models/KodaikanalTravelAgent.js";
import KodaikanalQuoteRequest from "../models/KodaikanalQuoteRequest.js";

const router = express.Router();
const ALLOWED_CITIES = ["Chennai", "Bengaluru", "Trichy", "Dindigul", "Kodaikanal"];

const cleanText = (value) => String(value || "").trim();
const cleanPhone = (value) => String(value || "").replace(/[^\d+]/g, "");
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const booleanFromUnknown = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["true", "yes", "y", "1", "verified", "active"].includes(normalized);
  }
  return false;
};
const numberFromUnknown = (value, fallback = Number.NaN) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const normalized = String(value).replace(/(\d),(\d)/g, "$1.$2");
    const match = normalized.match(/-?\d+(\.\d+)?/);
    if (!match) return fallback;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = numberFromUnknown(item, Number.NaN);
      if (Number.isFinite(candidate)) return candidate;
    }
    return fallback;
  }
  if (value && typeof value === "object") {
    const keys = [
      "rating",
      "value",
      "text",
      "score",
      "stars",
      "average",
      "avg",
      "ratingValue",
    ];
    for (const key of keys) {
      const candidate = numberFromUnknown(value[key], Number.NaN);
      if (Number.isFinite(candidate)) return candidate;
    }
    for (const nested of Object.values(value)) {
      const candidate = numberFromUnknown(nested, Number.NaN);
      if (Number.isFinite(candidate)) return candidate;
    }
  }
  return fallback;
};
const inferEffectiveRating = (agent) => {
  const direct = numberFromUnknown(agent?.rating, Number.NaN);
  if (Number.isFinite(direct) && direct > 0) return Math.max(0, Math.min(5, direct));
  const raw = agent?.raw || {};
  const fromRaw = numberFromUnknown(
    [
      raw?.rating,
      raw?.stars,
      raw?.avgRating,
      raw?.averageRating,
      raw?.googleRating,
      raw?.aggregateRating,
      raw?.ratingText,
    ],
    0
  );
  return Math.max(0, Math.min(5, fromRaw));
};
const inferEffectiveVerified = (agent) => {
  if (booleanFromUnknown(agent?.verified)) return true;
  const raw = agent?.raw || {};
  return Boolean(
    booleanFromUnknown(raw?.verified) ||
      booleanFromUnknown(raw?.isVerified) ||
      booleanFromUnknown(raw?.googleVerified) ||
      booleanFromUnknown(raw?.is_verified) ||
      booleanFromUnknown(raw?.profileVerified) ||
      booleanFromUnknown(raw?.verificationStatus) ||
      booleanFromUnknown(raw?.isClaimed) ||
      (Array.isArray(raw?.badges) &&
        raw.badges.some((badge) => String(badge || "").toLowerCase().includes("verified"))) ||
      String(raw?.badge || "").toLowerCase().includes("verified")
  );
};

router.get("/", async (req, res) => {
  try {
    const {
      city = "",
      destination = "",
      state = "",
      search = "",
      minRating = "",
      maxPrice = "",
      verified = "",
      sort = "rating_desc",
      page = "1",
      limit = "12",
    } = req.query;

    const filter = { isActive: true };

    if (city && ALLOWED_CITIES.includes(cleanText(city))) {
      filter.city = cleanText(city);
    }
    if (destination) {
      filter.destination = cleanText(destination);
    }
    if (state && ["Tamil Nadu", "Kerala"].includes(cleanText(state))) {
      filter.destinationState = cleanText(state);
    }

    if (search) {
      const regex = new RegExp(cleanText(search), "i");
      filter.$or = [{ name: regex }, { agencyName: regex }, { address: regex }];
    }

    if (maxPrice) {
      filter.priceFrom = { ...(filter.priceFrom || {}), $lte: toNumber(maxPrice, 0) };
    }

    const pageNum = Math.max(1, toNumber(page, 1));
    const limitNum = Math.min(50, Math.max(1, toNumber(limit, 12)));
    const skip = (pageNum - 1) * limitNum;

    let sortObj = { rating: -1, reviewCount: -1, createdAt: -1 };
    if (sort === "price_asc") sortObj = { priceFrom: 1, rating: -1 };
    if (sort === "price_desc") sortObj = { priceFrom: -1, rating: -1 };
    if (sort === "newest") sortObj = { createdAt: -1 };

    const [allCandidates, lastSyncDoc, availableDestinations, availableStates] = await Promise.all([
      KodaikanalTravelAgent.find(filter)
        .sort(sortObj)
        .limit(2000),
      KodaikanalTravelAgent.findOne({})
        .sort({ lastSyncedAt: -1 })
        .select("lastSyncedAt"),
      KodaikanalTravelAgent.distinct("destination", { isActive: true }),
      KodaikanalTravelAgent.distinct("destinationState", {
        isActive: true,
        destinationState: { $ne: "" },
      }),
    ]);

    let filtered = allCandidates;
    if (minRating) {
      const min = toNumber(minRating, 0);
      filtered = filtered.filter((agent) => inferEffectiveRating(agent) >= min);
    }
    if (verified === "true") {
      filtered = filtered.filter((agent) => inferEffectiveVerified(agent));
    }

    const total = filtered.length;
    const items = filtered.slice(skip, skip + limitNum).map((agent) => {
      const obj = agent.toObject();
      obj.rating = inferEffectiveRating(agent);
      obj.verified = inferEffectiveVerified(agent);
      delete obj.raw;
      return obj;
    });

    res.json({
      items,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
      },
      meta: {
        destination: destination || "All",
        allowedCities: ALLOWED_CITIES,
        availableDestinations: availableDestinations.filter(Boolean).sort(),
        availableStates: availableStates.filter(Boolean).sort(),
        lastUpdated: lastSyncDoc?.lastSyncedAt || null,
      },
    });
  } catch (error) {
    console.error("KODAI AGENTS LIST ERROR:", error);
    res.status(500).json({ message: "Failed to load travel agents" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid agent id" });
    }

    const agent = await KodaikanalTravelAgent.findById(id).select("-raw");
    if (!agent || !agent.isActive) {
      return res.status(404).json({ message: "Agent not found" });
    }

    res.json(agent);
  } catch (error) {
    console.error("KODAI AGENT DETAIL ERROR:", error);
    res.status(500).json({ message: "Failed to load agent" });
  }
});

router.post("/quote-requests", async (req, res) => {
  try {
    const {
      customerName,
      phone,
      email,
      fromCity,
      travelDate,
      travelers,
      budget,
      notes,
      agentId,
      destination,
      destinationState,
    } = req.body || {};

    if (!cleanText(customerName) || !cleanPhone(phone)) {
      return res.status(400).json({ message: "Name and phone are required" });
    }

    if (!ALLOWED_CITIES.includes(cleanText(fromCity))) {
      return res.status(400).json({
        message: `fromCity must be one of: ${ALLOWED_CITIES.join(", ")}`,
      });
    }

    const date = new Date(travelDate);
    if (!travelDate || Number.isNaN(date.getTime())) {
      return res.status(400).json({ message: "Valid travelDate is required" });
    }

    let agent = null;
    if (agentId) {
      if (!mongoose.Types.ObjectId.isValid(agentId)) {
        return res.status(400).json({ message: "Invalid agentId" });
      }
      agent = await KodaikanalTravelAgent.findById(agentId).select(
        "_id city destination destinationState"
      );
      if (!agent) return res.status(404).json({ message: "Selected agent not found" });
    }

    const payload = {
      customerName: cleanText(customerName),
      phone: cleanPhone(phone),
      email: cleanText(email).toLowerCase(),
      fromCity: cleanText(fromCity),
      destination: cleanText(destination || agent?.destination || ""),
      destinationState: cleanText(destinationState || agent?.destinationState || ""),
      travelDate: date,
      travelers: Math.max(1, toNumber(travelers, 1)),
      budget: Math.max(0, toNumber(budget, 0)),
      notes: cleanText(notes),
      agent: agent?._id || null,
    };

    const created = await KodaikanalQuoteRequest.create(payload);

    res.status(201).json({
      message: "Quote request submitted successfully",
      requestId: created._id,
    });
  } catch (error) {
    console.error("KODAI QUOTE CREATE ERROR:", error);
    res.status(500).json({ message: "Failed to submit quote request" });
  }
});

export default router;
