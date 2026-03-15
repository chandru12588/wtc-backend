import express from "express";
import GuideApplication from "../models/GuideApplication.js";

const router = express.Router();

const COUNTRY_CURRENCY_MAP = {
  India: { code: "INR", symbol: "Rs." },
  Australia: { code: "AUD", symbol: "A$" },
  America: { code: "USD", symbol: "$" },
  UK: { code: "GBP", symbol: "£" },
  Germany: { code: "EUR", symbol: "€" },
  Italy: { code: "EUR", symbol: "€" },
  Portugal: { code: "EUR", symbol: "€" },
  France: { code: "EUR", symbol: "€" },
  Spain: { code: "EUR", symbol: "€" },
  Denmark: { code: "DKK", symbol: "kr" },
  Switzerland: { code: "CHF", symbol: "CHF" },
  Dubai: { code: "AED", symbol: "AED" },
};

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
      privateDayCharge,
      groupDayCharge,
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

    if (!privateDayCharge || !groupDayCharge) {
      return res.status(400).json({
        message: "Private and group per-day charges are required",
      });
    }

    const currency = COUNTRY_CURRENCY_MAP[country] || { code: "USD", symbol: "$" };

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
      currencyCode: currency.code,
      currencySymbol: currency.symbol,
      privateDayCharge: Number(privateDayCharge),
      groupDayCharge: Number(groupDayCharge),
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
