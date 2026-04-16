import express from "express";
import RoadsideAssistance from "../models/RoadsideAssistance.js";

const router = express.Router();
const ALLOWED_CITIES = ["Chennai", "Bengaluru", "Trichy", "Dindigul", "Kodaikanal"];

router.get("/", async (req, res) => {
  try {
    const { city, limit = 24, search = "" } = req.query;

    if (!city || !ALLOWED_CITIES.includes(city)) {
      return res.status(400).json({ message: "Invalid or missing city" });
    }

    const filter = { city, isActive: true };
    if (search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { services: { $in: [new RegExp(search.trim(), "i")] } },
      ];
    }

    const items = await RoadsideAssistance.find(filter)
      .sort({ rating: -1 })
      .limit(Number(limit))
      .select("-raw");

    const meta = {
      total: await RoadsideAssistance.countDocuments(filter),
      lastUpdated: new Date(),
    };

    res.json({ items, meta });
  } catch (error) {
    console.error("ROAD ASSISTANCE LIST ERROR:", error);
    res.status(500).json({ message: "Failed to fetch roadside assistance" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const item = await RoadsideAssistance.findById(id).select("-raw");
    if (!item) {
      return res.status(404).json({ message: "Roadside assistance not found" });
    }
    res.json(item);
  } catch (error) {
    console.error("ROAD ASSISTANCE DETAIL ERROR:", error);
    res.status(500).json({ message: "Failed to fetch roadside assistance detail" });
  }
});

router.post("/quote-requests", async (req, res) => {
  try {
    const { customerName, phone, email, fromCity, vehicleType, issue, notes, assistanceId } = req.body;

    // Basic validation
    if (!customerName || !phone || !fromCity || !vehicleType || !issue) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!ALLOWED_CITIES.includes(fromCity)) {
      return res.status(400).json({ message: "Invalid city" });
    }

    // Here you could save to a quote model or send email/SMS
    // For now, just return success
    res.json({ message: "Roadside assistance request submitted successfully" });
  } catch (error) {
    console.error("ROAD ASSISTANCE QUOTE CREATE ERROR:", error);
    res.status(500).json({ message: "Failed to create roadside assistance request" });
  }
});

export default router;