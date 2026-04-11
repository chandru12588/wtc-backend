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

    if (minRating) {
      filter.rating = { ...(filter.rating || {}), $gte: toNumber(minRating, 0) };
    }

    if (maxPrice) {
      filter.priceFrom = { ...(filter.priceFrom || {}), $lte: toNumber(maxPrice, 0) };
    }

    if (verified === "true") {
      filter.verified = true;
    }

    const pageNum = Math.max(1, toNumber(page, 1));
    const limitNum = Math.min(50, Math.max(1, toNumber(limit, 12)));
    const skip = (pageNum - 1) * limitNum;

    let sortObj = { rating: -1, reviewCount: -1, createdAt: -1 };
    if (sort === "price_asc") sortObj = { priceFrom: 1, rating: -1 };
    if (sort === "price_desc") sortObj = { priceFrom: -1, rating: -1 };
    if (sort === "newest") sortObj = { createdAt: -1 };

    const [items, total, lastSyncDoc, availableDestinations, availableStates] = await Promise.all([
      KodaikanalTravelAgent.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .select("-raw"),
      KodaikanalTravelAgent.countDocuments(filter),
      KodaikanalTravelAgent.findOne({})
        .sort({ lastSyncedAt: -1 })
        .select("lastSyncedAt"),
      KodaikanalTravelAgent.distinct("destination", { isActive: true }),
      KodaikanalTravelAgent.distinct("destinationState", {
        isActive: true,
        destinationState: { $ne: "" },
      }),
    ]);

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
