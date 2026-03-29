import express from "express";
import ActingDriverApplication from "../models/ActingDriverApplication.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAdmin, async (req, res) => {
  try {
    const applications = await ActingDriverApplication.find().sort({
      createdAt: -1,
    });
    res.json(applications);
  } catch (err) {
    console.error("ADMIN ACTING DRIVERS LIST ERROR:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch acting driver applications" });
  }
});

router.put("/:id/approve", requireAdmin, async (req, res) => {
  try {
    const { notes = "" } = req.body || {};
    const updated = await ActingDriverApplication.findByIdAndUpdate(
      req.params.id,
      {
        status: "approved",
        adminReviewNotes: notes,
        approvedAt: new Date(),
        rejectedAt: undefined,
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Application not found" });
    }

    res.json({ message: "Acting driver application approved", application: updated });
  } catch (err) {
    console.error("ADMIN ACTING DRIVER APPROVE ERROR:", err);
    res.status(500).json({ message: "Failed to approve acting driver application" });
  }
});

router.put("/:id/reject", requireAdmin, async (req, res) => {
  try {
    const { notes = "" } = req.body || {};
    const updated = await ActingDriverApplication.findByIdAndUpdate(
      req.params.id,
      {
        status: "rejected",
        adminReviewNotes: notes,
        rejectedAt: new Date(),
        approvedAt: undefined,
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Application not found" });
    }

    res.json({ message: "Acting driver application rejected", application: updated });
  } catch (err) {
    console.error("ADMIN ACTING DRIVER REJECT ERROR:", err);
    res.status(500).json({ message: "Failed to reject acting driver application" });
  }
});

export default router;
