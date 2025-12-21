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

/* -----------------------------
   GET ALL PACKAGES
------------------------------ */
router.get("/", async (req, res) => {
  try {
    const pkgs = await Package.find().sort({ createdAt: -1 });
    res.json(pkgs);
  } catch (err) {
    res.status(500).json({ msg: "Failed to load packages" });
  }
});

/* -----------------------------
   GET SINGLE PACKAGE
------------------------------ */
router.get("/:id", async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    res.json(pkg);
  } catch {
    res.status(500).json({ msg: "Invalid package ID" });
  }
});

/* -----------------------------
   CREATE NEW PACKAGE
------------------------------ */
router.post("/", upload.array("images", 10), async (req, res) => {
  try {
    const data = {
      title: req.body.title,
      description: req.body.description,
      price: req.body.price,
      location: req.body.location,     // ⭐ FIXED – REQUIRED FIELD
      region: req.body.region,
      category: req.body.category,
      days: req.body.days,
    };

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

    const slug = data.title.toLowerCase().replace(/\s+/g, "-");

    const pkg = await Package.create({ ...data, slug, images });

    res.json(pkg);
  } catch (err) {
    console.log("CREATE PACKAGE ERROR:", err);
    res.status(500).json({ msg: "Create failed" });
  }
});

/* -----------------------------
   UPDATE PACKAGE
------------------------------ */
router.put("/:id", upload.array("images", 10), async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ msg: "Package not found" });

    const data = {
      title: req.body.title,
      description: req.body.description,
      price: req.body.price,
      location: req.body.location,     // ⭐ FIXED – REQUIRED FIELD
      region: req.body.region,
      category: req.body.category,
      days: req.body.days,
    };

    let images = [...pkg.images];

    if (req.body.removeImages) {
      const removeList = JSON.parse(req.body.removeImages);
      images = images.filter((img) => !removeList.includes(img));
    }

    for (const file of req.files || []) {
      const uploadRes = await new Promise((resolve, reject) => {
        cloudinary.v2.uploader.upload_stream(
          { folder: "wrongturn" },
          (err, result) => (err ? reject(err) : resolve(result))
        ).end(file.buffer);
      });

      images.push(uploadRes.secure_url);
    }

    const slug = data.title.toLowerCase().replace(/\s+/g, "-");

    pkg.set({ ...data, slug, images });
    await pkg.save();

    res.json(pkg);
  } catch (err) {
    console.log("UPDATE PACKAGE ERROR:", err);
    res.status(500).json({ msg: "Update failed" });
  }
});

/* -----------------------------
   DELETE PACKAGE
------------------------------ */
router.delete("/:id", async (req, res) => {
  try {
    await Package.findByIdAndDelete(req.params.id);
    res.json({ msg: "Deleted" });
  } catch {
    res.status(500).json({ msg: "Delete failed" });
  }
});

export default router;
