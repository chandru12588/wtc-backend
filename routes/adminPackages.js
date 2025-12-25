import express from "express";
import multer from "multer";
import cloudinary from "cloudinary";
import Package from "../models/Package.js";

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = express.Router();
const upload = multer();

/* =====================================================
   GET ALL PACKAGES
===================================================== */
router.get("/", async (req, res) => {
  try {
    const pkgs = await Package.find().sort({ createdAt: -1 });
    res.json(pkgs);
  } catch {
    res.status(500).json({ msg: "Failed to load packages" });
  }
});

/* =====================================================
   GET SINGLE
===================================================== */
router.get("/:id", async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ msg: "Package not found" });
    res.json(pkg);
  } catch {
    res.status(500).json({ msg: "Invalid package ID" });
  }
});

/* =====================================================
   CREATE PACKAGE  ⭐ StayType + Tags added
===================================================== */
router.post("/", upload.array("images", 10), async (req, res) => {
  try {
    if (!req.body.startDate || !req.body.stayType || !req.body.category) {
      return res.status(400).json({ msg: "stayType, category & startDate required" });
    }

    const data = {
      title: req.body.title,
      description: req.body.description,
      price: Number(req.body.price),

      location: req.body.location,
      region: req.body.region,

      category: req.body.category,
      stayType: req.body.stayType,            // ⭐ Save Stay Type
      tags: req.body.tags ? JSON.parse(req.body.tags) : [],  // ⭐ multi tags

      days: req.body.days,

      startDate: new Date(req.body.startDate),
      endDate: req.body.endDate ? new Date(req.body.endDate) : null,

      isHostListing: false,
    };

    /* 🔥 Upload Images */
    let images = [];
    for (const file of req.files || []) {
      const uploadRes = await new Promise((resolve, reject) => {
        cloudinary.v2.uploader.upload_stream(
          { folder: "wrongturn" },
          (err, result) => (err ? reject(err) : resolve(result))
        ).end(file.buffer);
      });
      images.push(uploadRes.secure_url);
    }

    data.slug = data.title.toLowerCase().replace(/\s+/g, "-");

    const pkg = await Package.create({ ...data, images });
    res.json(pkg);

  } catch (err) {
    console.error("CREATE PACKAGE ERROR:", err);
    res.status(500).json({ msg: err.message });
  }
});

/* =====================================================
   UPDATE PACKAGE  ⭐ StayType + Tags supported
===================================================== */
router.put("/:id", upload.array("images", 10), async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ msg: "Package not found" });

    const data = {
      title: req.body.title,
      description: req.body.description,
      price: Number(req.body.price),

      location: req.body.location,
      region: req.body.region,

      category: req.body.category,
      stayType: req.body.stayType,                             // ⭐ stayType update
      tags: req.body.tags ? JSON.parse(req.body.tags) : pkg.tags,

      days: req.body.days,
      startDate: new Date(req.body.startDate),
      endDate: req.body.endDate ? new Date(req.body.endDate) : null,
    };

    /* Maintain Old Images */
    let images = [...pkg.images];

    if (req.body.oldImages) {
      images = JSON.parse(req.body.oldImages);
    }

    /* Upload New */
    for (const file of req.files || []) {
      const uploadRes = await new Promise((resolve, reject) => {
        cloudinary.v2.uploader.upload_stream(
          { folder: "wrongturn" },
          (err, result) => (err ? reject(err) : resolve(result))
        ).end(file.buffer);
      });
      images.push(uploadRes.secure_url);
    }

    data.slug = data.title.toLowerCase().replace(/\s+/g, "-");

    pkg.set({ ...data, images });
    await pkg.save();

    res.json(pkg);

  } catch (err) {
    console.error("UPDATE PACKAGE ERROR:", err);
    res.status(500).json({ msg: err.message });
  }
});

/* =====================================================
   DELETE
===================================================== */
router.delete("/:id", async (req, res) => {
  try {
    await Package.findByIdAndDelete(req.params.id);
    res.json({ msg: "Deleted" });
  } catch {
    res.status(500).json({ msg: "Delete failed" });
  }
});

export default router;
