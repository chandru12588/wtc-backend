import express from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import cloudinary from "cloudinary";
import User from "../models/User.js";
import TravelStory from "../models/TravelStory.js";

const router = express.Router();
const upload = multer();

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function decodeUser(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;

  try {
    const token = auth.split(" ")[1];
    return jwt.verify(token, process.env.JWT_SECRET || "devsecret");
  } catch {
    return null;
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

router.get("/", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit || 24), 60));
    const stories = await TravelStory.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(stories);
  } catch (err) {
    console.error("STORIES LOAD ERROR:", err);
    res.status(500).json({ message: "Failed to load stories" });
  }
});

router.post("/", upload.array("media", 6), async (req, res) => {
  try {
    const decoded = decodeUser(req);
    if (!decoded?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(decoded.id).select("name");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const title = String(req.body.title || "").trim();
    const content = String(req.body.content || "").trim();
    const location = String(req.body.location || "").trim();

    if (!title) {
      return res.status(400).json({ message: "Story title is required" });
    }

    let media = [];
    if (Array.isArray(req.files) && req.files.length) {
      const uploadedMedia = await Promise.all(
        req.files.map((file) => uploadMediaFile(file, "trippolama/stories"))
      );
      media = uploadedMedia.filter(Boolean);
    }

    if (!content && !media.length) {
      return res.status(400).json({ message: "Add story text or media" });
    }

    const story = await TravelStory.create({
      userId: user._id,
      userName: user.name || "Traveler",
      title,
      content,
      location,
      media,
    });

    res.status(201).json({ message: "Story posted", story });
  } catch (err) {
    console.error("STORY SAVE ERROR:", err);
    res.status(500).json({ message: "Failed to post story" });
  }
});

export default router;
