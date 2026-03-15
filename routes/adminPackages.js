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

router.get("/", async (_req, res) => {
  try {
    const pkgs = await Package.find().sort({ createdAt: -1 });
    res.json(pkgs);
  } catch {
    res.status(500).json({ msg: "Failed to load packages" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ msg: "Package not found" });
    res.json(pkg);
  } catch {
    res.status(500).json({ msg: "Invalid package ID" });
  }
});

const parsePackagePayload = (body, existing = {}) => ({
  title: body.title,
  description: body.description,
  price: Number(body.price),
  country: body.country || existing.country || "",
  location: body.location,
  region: body.region,
  category: body.category,
  serviceType: body.serviceType || existing.serviceType || "general",
  stayType: body.stayType || existing.stayType || "",
  tags: body.tags ? JSON.parse(body.tags) : existing.tags || [],
  guideType: body.guideType || existing.guideType || "",
  guideLanguages: body.guideLanguages
    ? JSON.parse(body.guideLanguages)
    : existing.guideLanguages || [],
  guideServiceMode: body.guideServiceMode || existing.guideServiceMode || "",
  maxGroupSize: body.maxGroupSize
    ? Number(body.maxGroupSize)
    : existing.maxGroupSize || 0,
  days: body.days,
  startDate: new Date(body.startDate),
  endDate: body.endDate ? new Date(body.endDate) : null,
  isHostListing: false,
});

const uploadImages = async (files = []) => {
  const images = [];

  for (const file of files) {
    const uploadRes = await new Promise((resolve, reject) => {
      cloudinary.v2.uploader
        .upload_stream({ folder: "wrongturn" }, (err, result) =>
          err ? reject(err) : resolve(result)
        )
        .end(file.buffer);
    });

    images.push(uploadRes.secure_url);
  }

  return images;
};

router.post("/", upload.array("images", 10), async (req, res) => {
  try {
    if (!req.body.startDate || !req.body.stayType || !req.body.category) {
      return res
        .status(400)
        .json({ msg: "stayType, category & startDate required" });
    }

    const data = parsePackagePayload(req.body);
    const images = await uploadImages(req.files || []);

    data.slug = data.title.toLowerCase().replace(/\s+/g, "-");

    const pkg = await Package.create({ ...data, images });
    res.json(pkg);
  } catch (err) {
    console.error("CREATE PACKAGE ERROR:", err);
    res.status(500).json({ msg: err.message });
  }
});

router.put("/:id", upload.array("images", 10), async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ msg: "Package not found" });

    const data = parsePackagePayload(req.body, pkg);
    let images = [...pkg.images];

    if (req.body.oldImages) {
      images = JSON.parse(req.body.oldImages);
    }

    const newImages = await uploadImages(req.files || []);
    images.push(...newImages);

    data.slug = data.title.toLowerCase().replace(/\s+/g, "-");

    pkg.set({ ...data, images });
    await pkg.save();

    res.json(pkg);
  } catch (err) {
    console.error("UPDATE PACKAGE ERROR:", err);
    res.status(500).json({ msg: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await Package.findByIdAndDelete(req.params.id);
    res.json({ msg: "Deleted" });
  } catch {
    res.status(500).json({ msg: "Delete failed" });
  }
});

export default router;
