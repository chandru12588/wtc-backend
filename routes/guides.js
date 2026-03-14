import express from "express";
import GuideApplication from "../models/GuideApplication.js";

const router = express.Router();

router.post("/apply", async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      whatsappNumber,
      country,
      state,
      city,
      zipcode,
      languages,
      experienceYears,
      specialties,
      guideLicense,
      notes,
    } = req.body;

    if (!fullName || !email || !phone || !whatsappNumber || !country || !state) {
      return res
        .status(400)
        .json({ message: "Name, email, phone, WhatsApp, country and state are required" });
    }

    const existing = await GuideApplication.findOne({
      email: email.toLowerCase().trim(),
      status: "pending",
    });

    if (existing) {
      return res.status(409).json({
        message: "A pending guide application already exists for this email",
      });
    }

    const application = await GuideApplication.create({
      fullName,
      email,
      phone,
      whatsappNumber,
      country,
      state,
      city,
      zipcode,
      languages: languages
        ? String(languages)
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
        : [],
      experienceYears: experienceYears ? Number(experienceYears) : 0,
      specialties: specialties
        ? String(specialties)
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
        : [],
      guideLicense,
      notes,
    });

    res.status(201).json({
      message: "Guide application submitted successfully",
      applicationId: application._id,
    });
  } catch (err) {
    console.error("GUIDE APPLY ERROR:", err);
    res.status(500).json({ message: "Failed to submit guide application" });
  }
});

export default router;
