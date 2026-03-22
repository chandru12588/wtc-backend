import express from "express";
import multer from "multer";
import cloudinary from "cloudinary";
import jwt from "jsonwebtoken";
import Package from "../models/Package.js";
import Admin from "../models/Admin.js";

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = express.Router();
const upload = multer();

const requireAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ msg: "Admin token required" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role === "admin") return next();

    const admin = decoded?.id
      ? await Admin.findById(decoded.id).select("role")
      : null;
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ msg: "Access denied" });
    }

    next();
  } catch {
    return res.status(401).json({ msg: "Invalid admin token" });
  }
};

router.use(requireAdmin);

const packageUpload = upload.fields([
  { name: "images", maxCount: 10 },
  { name: "replacementImages", maxCount: 10 },
  { name: "videos", maxCount: 5 },
]);

/* ==============================
   GET ALL PACKAGES (FIXED 🔥)
============================== */
router.get("/", async (_req, res) => {
  try {
    const pkgs = await Package.find().sort({ createdAt: -1 });

    console.log("📦 Packages fetched:", pkgs.length);

    // 🔥 FIX: Disable cache
    res.set("Cache-Control", "no-store");

    res.json(pkgs);
  } catch (err) {
    console.error("❌ GET PACKAGES ERROR:", err);
    res.status(500).json({ msg: "Failed to load packages" });
  }
});

/* ==============================
   GET SINGLE PACKAGE
============================== */
router.get("/:id", async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);

    if (!pkg) {
      return res.status(404).json({ msg: "Package not found" });
    }

    res.set("Cache-Control", "no-store");
    res.json(pkg);
  } catch (err) {
    console.error("❌ GET PACKAGE ERROR:", err);
    res.status(500).json({ msg: "Invalid package ID" });
  }
});

/* ==============================
   HELPER: PARSE DATA
============================== */
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

/* ==============================
   HELPER: UPLOAD IMAGES
============================== */
const uploadAssets = async (files = [], folder = "trippolama/packages") => {
  const uploadedUrls = [];

  for (const file of files) {
    const uploadRes = await new Promise((resolve, reject) => {
      cloudinary.v2.uploader
        .upload_stream({ folder, resource_type: "auto" }, (err, result) =>
          err ? reject(err) : resolve(result)
        )
        .end(file.buffer);
    });

    uploadedUrls.push(uploadRes.secure_url);
  }

  return uploadedUrls;
};

/* ==============================
   CREATE PACKAGE
============================== */
router.post("/", packageUpload, async (req, res) => {
  try {
    if (!req.body.startDate || !req.body.stayType || !req.body.category) {
      return res
        .status(400)
        .json({ msg: "stayType, category & startDate required" });
    }

    const data = parsePackagePayload(req.body);
    const images = await uploadAssets(req.files?.images || [], "trippolama/packages/images");
    const videos = await uploadAssets(req.files?.videos || [], "trippolama/packages/videos");

    data.slug = data.title.toLowerCase().replace(/\s+/g, "-");

    const pkg = await Package.create({ ...data, images, videos });

    console.log("✅ Package created:", pkg._id);

    res.json(pkg);
  } catch (err) {
    console.error("❌ CREATE PACKAGE ERROR:", err);
    res.status(500).json({ msg: err.message });
  }
});

/* ==============================
   UPDATE PACKAGE
============================== */
router.put("/:id", packageUpload, async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ msg: "Package not found" });

    const data = parsePackagePayload(req.body, pkg);
    let images = [...pkg.images];
    let videos = [...(pkg.videos || [])];

    if (req.body.oldImages) {
      images = JSON.parse(req.body.oldImages);
    }
    if (req.body.oldVideos) {
      videos = JSON.parse(req.body.oldVideos);
    }

    const replacementTargets = req.body.replacementTargets
      ? JSON.parse(req.body.replacementTargets)
      : [];

    const replacementFiles = req.files?.replacementImages || [];

    if (
      replacementTargets.length &&
      replacementTargets.length !== replacementFiles.length
    ) {
      return res.status(400).json({ msg: "Replacement image data invalid" });
    }

    if (replacementTargets.length) {
      const uploadedReplacements = await uploadAssets(
        replacementFiles,
        "trippolama/packages/images"
      );

      images = images.map((imageUrl) => {
        const idx = replacementTargets.indexOf(imageUrl);
        return idx >= 0 ? uploadedReplacements[idx] : imageUrl;
      });
    }

    const newImages = await uploadAssets(req.files?.images || [], "trippolama/packages/images");
    images.push(...newImages);
    const newVideos = await uploadAssets(req.files?.videos || [], "trippolama/packages/videos");
    videos.push(...newVideos);

    data.slug = data.title.toLowerCase().replace(/\s+/g, "-");

    pkg.set({ ...data, images, videos });
    await pkg.save();

    console.log("✏️ Package updated:", pkg._id);

    res.json(pkg);
  } catch (err) {
    console.error("❌ UPDATE PACKAGE ERROR:", err);
    res.status(500).json({ msg: err.message });
  }
});

/* ==============================
   DELETE PACKAGE
============================== */
router.delete("/:id", async (req, res) => {
  try {
    await Package.findByIdAndDelete(req.params.id);

    console.log("🗑️ Package deleted:", req.params.id);

    res.json({ msg: "Deleted" });
  } catch (err) {
    console.error("❌ DELETE ERROR:", err);
    res.status(500).json({ msg: "Delete failed" });
  }
});

export default router;
