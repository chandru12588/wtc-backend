// backend/routes/hostListings.js
import express from "express";
import Listing from "../models/Listing.js";

const router = express.Router();

/* ========================================================
   CREATE NEW HOST LISTING
======================================================== */
router.post("/", async (req, res) => {
  try {
    const {
      hostId,
      title,
      description,
      location,
      price,
      images,
      stayType,       
      category,
      startDate,
      endDate
    } = req.body;

    if (!hostId) return res.status(400).json({ msg: "Host ID missing" });

    const listing = await Listing.create({
      hostId,
      title,
      description,
      location,
      price,
      images: images || [],
      stayType,
      category,

      // IMPORTANT FIX ⭐ save correctly matching DB schema
      availableFrom: startDate,
      availableTo: endDate,

      approved: false
    });

    return res.json({ msg: "Listing submitted for approval", listing });

  } catch (err) {
    console.log("LISTING CREATE ERROR:", err);
    res.status(500).json({ msg: "Failed to create listing", error: err });
  }
});


/* ========================================================
   GET ALL LISTINGS OF A HOST (Dashboard)
======================================================== */
router.get("/my/:hostId", async (req, res) => {
  try {
    const list = await Listing.find({ hostId: req.params.hostId })
      .sort({ createdAt: -1 });

    return res.json(list);

  } catch (err) {
    res.status(500).json({ msg: "Failed to load listings" });
  }
});


/* ========================================================
   PUBLIC GET — ALL APPROVED HOST LISTINGS
======================================================== */
router.get("/all", async (req, res) => {
  try {
    const data = await Listing.find({ approved: true }).sort({ createdAt: -1 });
    return res.json(data);

  } catch (err) {
    console.log("ALL HOST LIST ERROR", err);
    res.status(500).json({ msg: "Failed to load listings" });
  }
});


/* ========================================================
   GET SINGLE LISTING
======================================================== */
router.get("/:id", async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/))
      return res.status(400).json({ msg: "Invalid listing ID" });

    const listing = await Listing.findById(req.params.id)
      .populate("hostId", "name email phoneNumber");

    if (!listing) return res.status(404).json({ msg: "Listing not found" });

    return res.json(listing);

  } catch (err) {
    console.log("LISTING FETCH ERROR:", err);
    res.status(500).json({ msg: "Failed to load listing" });
  }
});


/* ========================================================
   UPDATE LISTING
======================================================== */
router.put("/:id", async (req, res) => {
  try {
    const updated = await Listing.findByIdAndUpdate(req.params.id, req.body, { new: true });
    return res.json({ msg: "Updated successfully", updated });

  } catch (err) {
    res.status(500).json({ msg: "Update failed" });
  }
});


/* ========================================================
   DELETE LISTING
======================================================== */
router.delete("/:id", async (req, res) => {
  try {
    await Listing.findByIdAndDelete(req.params.id);
    return res.json({ msg: "Listing deleted" });

  } catch (err) {
    res.status(500).json({ msg: "Delete failed" });
  }
});

export default router;
