import express from "express";
import cloudinary from "cloudinary";
import ActingDriverApplication from "../models/ActingDriverApplication.js";
import { createMemoryUpload } from "../middleware/upload.js";
import { publicWriteLimiter, uploadLimiter } from "../middleware/rateLimiters.js";

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = express.Router();
const upload = createMemoryUpload({
  maxFileSizeMB: 20,
  allowImages: true,
  allowVideos: false,
  allowPdf: true,
});

const uploadToCloudinary = async (
  file,
  folder = "trippolama/acting-drivers"
) => {
  if (!file) return "";
  const uploaded = await new Promise((resolve, reject) => {
    cloudinary.v2.uploader
      .upload_stream({ folder }, (err, result) =>
        err ? reject(err) : resolve(result)
      )
      .end(file.buffer);
  });
  return uploaded.secure_url;
};

router.post(
  "/apply",
  publicWriteLimiter,
  uploadLimiter,
  upload.fields([{ name: "licenseImage", maxCount: 1 }]),
  async (req, res) => {
    try {
      const {
        fullName,
        age,
        phone,
        whatsappNumber,
        vehicleType,
        experienceYears,
      } = req.body;

      if (
        !fullName ||
        !age ||
        !phone ||
        !whatsappNumber ||
        !vehicleType
      ) {
        return res.status(400).json({
          message:
            "Name, age, phone, WhatsApp number and vehicle type are required",
        });
      }

      if (!req.files?.licenseImage?.[0]) {
        return res
          .status(400)
          .json({ message: "Driving licence copy is required" });
      }

      const licenseImageUrl = await uploadToCloudinary(
        req.files.licenseImage[0]
      );

      const application = await ActingDriverApplication.create({
        fullName,
        age: Number(age),
        phone,
        whatsappNumber,
        vehicleType,
        experienceYears: experienceYears ? Number(experienceYears) : 0,
        licenseImageUrl,
      });

      res.status(201).json({
        message:
          "Acting driver application submitted successfully. Admin review is pending.",
        applicationId: application._id,
      });
    } catch (err) {
      console.error("ACTING DRIVER APPLY ERROR:", err);
      res
        .status(500)
        .json({ message: "Failed to submit acting driver application" });
    }
  }
);

export default router;
