import express from "express";
import jwt from "jsonwebtoken";
import cloudinary from "cloudinary";
import Package from "../models/Package.js";
import User from "../models/User.js";
import PackageReview from "../models/PackageReview.js";
import { createMemoryUpload } from "../middleware/upload.js";
import { publicWriteLimiter, uploadLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();
const upload = createMemoryUpload({
  maxFileSizeMB: 80,
  allowImages: true,
  allowVideos: true,
  allowPdf: false,
});
const MAX_REVIEW_VIDEO_SECONDS = 60;

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

  if (mediaType === "video" && Number(uploaded.duration || 0) > MAX_REVIEW_VIDEO_SECONDS) {
    if (uploaded.public_id) {
      await cloudinary.v2.uploader.destroy(uploaded.public_id, { resource_type: "video" });
    }
    const err = new Error(`Each video must be ${MAX_REVIEW_VIDEO_SECONDS} seconds or less`);
    err.statusCode = 400;
    throw err;
  }

  return {
    url: uploaded.secure_url,
    mediaType,
  };
}

async function recalcPackageRating(packageId) {
  const [summary] = await PackageReview.aggregate([
    { $match: { packageId } },
    {
      $group: {
        _id: "$packageId",
        averageRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  if (!summary) {
    await Package.findByIdAndUpdate(packageId, {
      averageRating: 0,
      reviewCount: 0,
    });
    return;
  }

  await Package.findByIdAndUpdate(packageId, {
    averageRating: Number(summary.averageRating.toFixed(1)),
    reviewCount: summary.reviewCount,
  });
}

router.get("/package/:packageId", async (req, res) => {
  try {
    const reviews = await PackageReview.find({ packageId: req.params.packageId })
      .sort({ createdAt: -1 })
      .lean();

    res.json(reviews);
  } catch (err) {
    console.error("REVIEWS LOAD ERROR:", err);
    res.status(500).json({ message: "Failed to load reviews" });
  }
});

router.post(
  "/package/:packageId",
  publicWriteLimiter,
  uploadLimiter,
  upload.array("media", 4),
  async (req, res) => {
  try {
    const decoded = decodeUser(req);
    if (!decoded?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { rating, reviewText = "" } = req.body;
    const parsedRating = Number(rating);

    if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const pkg = await Package.findById(req.params.packageId);
    if (!pkg) {
      return res.status(404).json({ message: "Package not found" });
    }

    const user = await User.findById(decoded.id).select("name avatar");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let media = [];
    if (Array.isArray(req.files) && req.files.length) {
      const uploadedMedia = await Promise.all(
        req.files.map((file) => uploadMediaFile(file, "trippolama/reviews"))
      );
      media = uploadedMedia.filter(Boolean);
    }

    let review = await PackageReview.findOne({
      packageId: pkg._id,
      userId: decoded.id,
    });

    if (review) {
      review.rating = parsedRating;
      review.reviewText = String(reviewText || "").trim();
      if (media.length) {
        review.media = media;
      }
      review.userName = user.name || "Traveler";
      review.userAvatar = user.avatar || "";
      await review.save();
    } else {
      review = await PackageReview.create({
        packageId: pkg._id,
        userId: decoded.id,
        userName: user.name || "Traveler",
        userAvatar: user.avatar || "",
        rating: parsedRating,
        reviewText: String(reviewText || "").trim(),
        media,
      });
    }

    await recalcPackageRating(pkg._id);

    res.status(201).json({ message: "Review saved", review });
  } catch (err) {
    console.error("REVIEW SAVE ERROR:", err);
    res.status(500).json({ message: "Failed to save review" });
  }
  }
);

router.get("/featured", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit || 8), 20));
    const reviews = await PackageReview.find({ rating: { $gte: 4 } })
      .populate("packageId", "title location region")
      .sort({ rating: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(reviews);
  } catch (err) {
    console.error("FEATURED REVIEWS ERROR:", err);
    res.status(500).json({ message: "Failed to load featured reviews" });
  }
});

router.get("/user/me", async (req, res) => {
  try {
    const decoded = decodeUser(req);
    if (!decoded?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const reviews = await PackageReview.find({ userId: decoded.id })
      .populate("packageId", "title location region")
      .sort({ createdAt: -1 })
      .lean();

    res.json(reviews);
  } catch (err) {
    console.error("MY REVIEWS ERROR:", err);
    res.status(500).json({ message: "Failed to load your reviews" });
  }
});

export default router;
