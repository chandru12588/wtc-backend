import express from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import cloudinary from "cloudinary";
import Admin from "../models/Admin.js";
import TravelStory from "../models/TravelStory.js";

const router = express.Router();
const upload = multer();

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Admin token required" });
  }

  try {
    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id).select("_id name email role");
    if (!admin) {
      return res.status(401).json({ message: "Invalid admin token" });
    }

    req.admin = admin;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid admin token" });
  }
}

async function uploadMediaFile(file, folder) {
  if (!file) return null;

  const uploaded = await new Promise((resolve, reject) => {
    cloudinary.v2.uploader
      .upload_stream(
        {
          folder,
          resource_type: "auto",
        },
        (err, result) => (err ? reject(err) : resolve(result))
      )
      .end(file.buffer);
  });

  const mediaType = String(uploaded.resource_type || "image").includes("video")
    ? "video"
    : "image";

  return {
    url: uploaded.secure_url,
    mediaType,
  };
}

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const stories = await TravelStory.find().sort({ createdAt: -1 }).limit(80).lean();
    res.json(stories);
  } catch (err) {
    console.error("ADMIN STORIES LOAD ERROR:", err);
    res.status(500).json({ message: "Failed to load stories" });
  }
});

router.post("/", requireAdmin, upload.array("media", 8), async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    const content = String(req.body.content || "").trim();
    const location = String(req.body.location || "").trim();

    if (!title) {
      return res.status(400).json({ message: "Story title is required" });
    }

    const uploadedMedia = await Promise.all(
      (Array.isArray(req.files) ? req.files : []).map((file) =>
        uploadMediaFile(file, "trippolama/stories")
      )
    );

    const media = uploadedMedia.filter(Boolean);

    if (!content && !media.length) {
      return res.status(400).json({ message: "Add story text or media" });
    }

    const story = await TravelStory.create({
      userId: req.admin._id,
      userName: req.admin.name || "Admin",
      title,
      content,
      location,
      media,
    });

    res.status(201).json({ message: "Story posted", story });
  } catch (err) {
    console.error("ADMIN STORY SAVE ERROR:", err);
    res.status(500).json({ message: "Failed to post story" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const deleted = await TravelStory.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Story not found" });
    }
    res.json({ message: "Story deleted" });
  } catch (err) {
    console.error("ADMIN STORY DELETE ERROR:", err);
    res.status(500).json({ message: "Failed to delete story" });
  }
});

export default router;
