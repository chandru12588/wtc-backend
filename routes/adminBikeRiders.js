import express from "express";
import BikeRiderApplication from "../models/BikeRiderApplication.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAdmin, async (req, res) => {
  try {
    const applications = await BikeRiderApplication.find().sort({ createdAt: -1 });
    res.json(applications);
  } catch (err) {
    console.error("ADMIN RIDERS LIST ERROR:", err);
    res.status(500).json({ message: "Failed to fetch rider applications" });
  }
});

router.put("/:id/approve", requireAdmin, async (req, res) => {
  try {
    const { notes = "" } = req.body || {};
    const updated = await BikeRiderApplication.findByIdAndUpdate(
      req.params.id,
      {
        status: "approved",
        adminReviewNotes: notes,
        approvedAt: new Date(),
        rejectedAt: undefined,
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Application not found" });
    res.json({ message: "Rider approved", application: updated });
  } catch (err) {
    console.error("ADMIN RIDERS APPROVE ERROR:", err);
    res.status(500).json({ message: "Failed to approve rider" });
  }
});

router.put("/:id/reject", requireAdmin, async (req, res) => {
  try {
    const { notes = "" } = req.body || {};
    const updated = await BikeRiderApplication.findByIdAndUpdate(
      req.params.id,
      {
        status: "rejected",
        adminReviewNotes: notes,
        rejectedAt: new Date(),
        approvedAt: undefined,
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Application not found" });
    res.json({ message: "Rider rejected", application: updated });
  } catch (err) {
    console.error("ADMIN RIDERS REJECT ERROR:", err);
    res.status(500).json({ message: "Failed to reject rider" });
  }
});

export default router;
