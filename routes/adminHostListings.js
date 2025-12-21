import express from "express";
import Listing from "../models/Listing.js";

const router = express.Router();

/* -------------------------------------
   GET ALL LISTINGS (APPROVED + PENDING)
-------------------------------------- */
router.get("/", async (req, res) => {
  try {
    const list = await Listing.find().sort({ createdAt: -1 }).populate("hostId");
    res.json(list);
  } catch (err) {
    res.status(500).json({ msg: "Failed to load listings" });
  }
});

/* -------------------------------------
   APPROVE LISTING
-------------------------------------- */
router.put("/approve/:id", async (req, res) => {
  try {
    await Listing.findByIdAndUpdate(req.params.id, { approved: true });
    res.json({ msg: "Listing approved" });
  } catch (err) {
    res.status(500).json({ msg: "Approval failed" });
  }
});

/* -------------------------------------
   REJECT LISTING
-------------------------------------- */
router.put("/reject/:id", async (req, res) => {
  try {
    await Listing.findByIdAndUpdate(req.params.id, { approved: false });
    res.json({ msg: "Listing rejected" });
  } catch (err) {
    res.status(500).json({ msg: "Rejection failed" });
  }
});

/* -------------------------------------
   DELETE LISTING
-------------------------------------- */
router.delete("/:id", async (req, res) => {
  try {
    await Listing.findByIdAndDelete(req.params.id);
    res.json({ msg: "Listing deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Delete failed" });
  }
});

export default router;
