import express from "express";
import RoadsideAssistance from "../models/RoadsideAssistance.js";
import { syncRoadsideAssistance } from "../services/roadsideAssistanceSync.js";

const router = express.Router();

router.post("/sync", async (_req, res) => {
  try {
    const summary = await syncRoadsideAssistance();
    res.json({ message: "Roadside assistance sync completed", summary });
  } catch (error) {
    console.error("ADMIN ROAD SYNC ERROR:", error);
    res.status(500).json({ message: "Failed to sync roadside assistance" });
  }
});

router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 20, city, search } = req.query;
    const filter = {};

    if (city) filter.city = city;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const items = await RoadsideAssistance.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await RoadsideAssistance.countDocuments(filter);

    res.json({
      items,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("ADMIN ROAD LIST ERROR:", error);
    res.status(500).json({ message: "Failed to fetch roadside assistance" });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const updated = await RoadsideAssistance.findByIdAndUpdate(
      id,
      { isActive },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Roadside assistance not found" });
    }

    res.json({ message: "Status updated successfully", item: updated });
  } catch (error) {
    console.error("ADMIN ROAD UPDATE ERROR:", error);
    res.status(500).json({ message: "Failed to update roadside assistance" });
  }
});

export default router;