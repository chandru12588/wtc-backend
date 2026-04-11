import express from "express";
import KodaikanalQuoteRequest from "../models/KodaikanalQuoteRequest.js";
import { syncKodaikanalAgents } from "../services/kodaikanalAgentSync.js";

const router = express.Router();

router.post("/sync", async (_req, res) => {
  try {
    const summary = await syncKodaikanalAgents();
    res.json({ message: "Kodaikanal agents sync completed", summary });
  } catch (error) {
    console.error("ADMIN KODAI SYNC ERROR:", error);
    res.status(500).json({ message: "Failed to sync Kodaikanal agents" });
  }
});

router.get("/quote-requests", async (_req, res) => {
  try {
    const requests = await KodaikanalQuoteRequest.find()
      .populate("agent", "name city phone rating")
      .sort({ createdAt: -1 })
      .limit(300);

    res.json(requests);
  } catch (error) {
    console.error("ADMIN KODAI QUOTES ERROR:", error);
    res.status(500).json({ message: "Failed to load quote requests" });
  }
});

router.patch("/quote-requests/:id/status", async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["new", "contacted", "closed"].includes(status)) {
      return res
        .status(400)
        .json({ message: "status must be one of: new, contacted, closed" });
    }

    const updated = await KodaikanalQuoteRequest.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate("agent", "name city phone rating");

    if (!updated) return res.status(404).json({ message: "Request not found" });
    res.json(updated);
  } catch (error) {
    console.error("ADMIN KODAI QUOTE UPDATE ERROR:", error);
    res.status(500).json({ message: "Failed to update quote request" });
  }
});

export default router;
