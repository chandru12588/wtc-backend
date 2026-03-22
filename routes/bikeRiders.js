import express from "express";
import cloudinary from "cloudinary";
import BikeRiderApplication from "../models/BikeRiderApplication.js";
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

const uploadToCloudinary = async (file, folder = "trippolama/bike-riders") => {
  if (!file) return "";
  const uploaded = await new Promise((resolve, reject) => {
    cloudinary.v2.uploader
      .upload_stream({ folder }, (err, result) => (err ? reject(err) : resolve(result)))
      .end(file.buffer);
  });
  return uploaded.secure_url;
};

router.post(
  "/apply",
  publicWriteLimiter,
  uploadLimiter,
  upload.fields([
    { name: "rcImage", maxCount: 1 },
    { name: "licenseImage", maxCount: 1 },
    { name: "idProofImage", maxCount: 1 },
    { name: "bikeImages", maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      const {
        fullName,
        email,
        phone,
        dob,
        operatingCities,
        preferredRoutes,
        bikeBrand,
        bikeModel,
        bikeYear,
        bikeRegistrationNumber,
        hasPillionHelmet,
        hasExtraGear,
        rcNumber,
        licenseNumber,
        idProofType,
        idProofNumber,
        experienceYears,
        emergencyContactName,
        emergencyContactPhone,
        additionalNotes,
      } = req.body;

      if (!fullName || !email || !phone || !dob) {
        return res.status(400).json({ message: "Name, email, phone and DOB are required" });
      }

      if (!bikeBrand || !bikeModel || !bikeRegistrationNumber) {
        return res.status(400).json({ message: "Bike details are required" });
      }

      if (!rcNumber || !licenseNumber || !idProofType || !idProofNumber) {
        return res.status(400).json({ message: "RC, license and ID proof details are required" });
      }

      const existing = await BikeRiderApplication.findOne({
        email: email.toLowerCase().trim(),
        status: "pending",
      });
      if (existing) {
        return res.status(409).json({ message: "A pending rider application already exists for this email" });
      }

      const rcImageUrl = await uploadToCloudinary(req.files?.rcImage?.[0]);
      const licenseImageUrl = await uploadToCloudinary(req.files?.licenseImage?.[0]);
      const idProofImageUrl = await uploadToCloudinary(req.files?.idProofImage?.[0]);
      const bikeImageUrls = [];
      for (const imageFile of req.files?.bikeImages || []) {
        bikeImageUrls.push(await uploadToCloudinary(imageFile));
      }

      const app = await BikeRiderApplication.create({
        fullName,
        email,
        phone,
        dob,
        operatingState: "Tamil Nadu",
        operatingCities: operatingCities
          ? operatingCities.split(",").map((v) => v.trim()).filter(Boolean)
          : [],
        preferredRoutes: preferredRoutes
          ? preferredRoutes.split(",").map((v) => v.trim()).filter(Boolean)
          : [],
        bikeBrand,
        bikeModel,
        bikeYear: bikeYear ? Number(bikeYear) : undefined,
        bikeRegistrationNumber,
        hasPillionHelmet: String(hasPillionHelmet) !== "false",
        hasExtraGear: String(hasExtraGear) === "true",
        rcNumber,
        licenseNumber,
        idProofType,
        idProofNumber,
        experienceYears: experienceYears ? Number(experienceYears) : 0,
        emergencyContactName,
        emergencyContactPhone,
        additionalNotes,
        rcImageUrl,
        licenseImageUrl,
        idProofImageUrl,
        bikeImageUrls,
      });

      res.status(201).json({
        message: "Bike rider application submitted successfully. Admin review is pending.",
        applicationId: app._id,
      });
    } catch (err) {
      console.error("BIKE RIDER APPLY ERROR:", err);
      res.status(500).json({ message: "Failed to submit rider application" });
    }
  }
);

export default router;
