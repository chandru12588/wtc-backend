// backend/routes/hostListings.js
import express from "express";
import Listing from "../models/Listing.js";

const router = express.Router();

/* ---------------------------
   CREATE NEW LISTING (SAFE)
---------------------------- */
router.post("/", async (req, res) => {
  try {
    const {
      hostId,
      title,
      description,
      location,
      price,
      images,
      category
    } = req.body;

    // VALIDATION — prevents <YOUR-LISTING-ID> problem
    if (!hostId) {
      return res.status(400).json({ msg: "Host ID missing" });
    }

    const listing = await Listing.create({
      hostId,
      title,
      description,
      location,
      price,
      images: images || [],
      category,
      approved: false
    });

    res.json({
      msg: "Listing submitted for approval",
      listing
    });

  } catch (err) {
    console.log("LISTING CREATE ERROR:", err);
    res.status(500).json({ msg: "Failed to create listing", error: err });
  }
});

/* ---------------------------
   GET LISTINGS FOR A HOST
---------------------------- */
router.get("/my/:hostId", async (req, res) => {
  try {
    const list = await Listing.find({ hostId: req.params.hostId })
      .sort({ createdAt: -1 });

    res.json(list);
  } catch (err) {
    res.status(500).json({ msg: "Failed to load listings" });
  }
});

/* ---------------------------
   PUBLIC — GET SINGLE LISTING
   (USED IN VIEW DETAILS PAGE)
---------------------------- */
router.get("/:id", async (req, res) => {
  try {
    // Validate ObjectId → fixes your CastError!
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ msg: "Invalid listing ID" });
    }

    const listing = await Listing.findById(req.params.id)
      .populate("hostId", "name email phoneNumber");

    if (!listing) {
      return res.status(404).json({ msg: "Listing not found" });
    }

    res.json(listing);

  } catch (err) {
    console.log("LISTING FETCH ERROR:", err);
    res.status(500).json({ msg: "Failed to load listing" });
  }
});

export default router;
