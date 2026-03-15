import express from "express";
import multer from "multer";
import cloudinary from "cloudinary";
import Package from "../models/Package.js";
import PillionRideRequest from "../models/PillionRideRequest.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();
const upload = multer();

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const requestUpload = upload.fields([
  { name: "idProof", maxCount: 1 },
  { name: "profilePhoto", maxCount: 1 },
]);

const uploadToCloudinary = async (file, folder) => {
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

const notifyAdmin = async ({ subject, html }) => {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!adminEmail) return;

  await sendEmail({ to: adminEmail, subject, html });
};

function inferServiceType(pkg) {
  const normalize = (value) => String(value || "").trim().toLowerCase();

  const explicit = normalize(pkg?.serviceType);
  if (explicit) return explicit;

  const category = normalize(pkg?.category);
  const stayType = normalize(pkg?.stayType);

  if (category === "bike pillion tour" || stayType === "pillion bike tour") {
    return "bike";
  }

  return "general";
}

router.post("/", requestUpload, async (req, res) => {
  try {
    const {
      userId,
      packageId,
      name,
      email,
      phone,
      age,
      startDate,
      numberOfDays,
      startPoint,
      destination,
      bikeBrand,
      idProofType,
      policyAccepted,
    } = req.body;

    if (
      !userId ||
      !packageId ||
      !name ||
      !email ||
      !phone ||
      !age ||
      !startDate ||
      !numberOfDays ||
      !startPoint ||
      !destination ||
      !bikeBrand ||
      !idProofType ||
      String(policyAccepted) !== "true"
    ) {
      return res.status(400).json({
        message:
          "Name, email, phone, age, date, days, route, bike brand, ID proof, and policy confirmation are required",
      });
    }

    if (!req.files?.idProof?.[0] || !req.files?.profilePhoto?.[0]) {
      return res.status(400).json({
        message: "ID proof and customer photo uploads are required",
      });
    }

    const pkg = await Package.findById(packageId);
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    if (inferServiceType(pkg) !== "bike") {
      return res
        .status(400)
        .json({ message: "This package is not a pillion rider service" });
    }

    const idProofUrl = await uploadToCloudinary(
      req.files?.idProof?.[0],
      "wrongturn/pillion-idproof"
    );
    const customerPhotoUrl = await uploadToCloudinary(
      req.files?.profilePhoto?.[0],
      "wrongturn/pillion-customer-photo"
    );

    const request = await PillionRideRequest.create({
      userId,
      packageId,
      name,
      email,
      phone,
      age: Number(age),
      startDate,
      numberOfDays: Number(numberOfDays),
      startPoint,
      destination,
      bikeBrand,
      idProofType,
      idProofUrl,
      customerPhotoUrl,
      policyAccepted: true,
    });

    try {
      await sendEmail({
        to: email,
        subject: "Pillion Ride Request Received - WrongTurnClub",
        html: `
          <h3>Hello ${name},</h3>
          <p>Your pillion ride request for <b>${pkg.title}</b> has been received.</p>
          <p>Admin will review the request and assign a rider.</p>
          <br/>
          <b>- WrongTurnClub</b>
        `,
      });
    } catch (e) {
      console.error("PILLION REQUEST EMAIL FAILED (ignored):", e.message);
    }

    try {
      await notifyAdmin({
        subject: `New pillion request - ${pkg.title}`,
        html: `
          <h3>New pillion ride request</h3>
          <p><b>Package:</b> ${pkg.title}</p>
          <p><b>Name:</b> ${name}</p>
          <p><b>Email:</b> ${email}</p>
          <p><b>Phone:</b> ${phone}</p>
        `,
      });
    } catch (e) {
      console.error("ADMIN PILLION EMAIL FAILED (ignored):", e.message);
    }

    res.status(201).json({
      message: "Pillion rider request submitted successfully",
      request,
    });
  } catch (err) {
    console.error("PILLION REQUEST CREATE ERROR:", err);
    res.status(500).json({ message: "Failed to submit pillion rider request" });
  }
});

router.get("/user/:userId", async (req, res) => {
  try {
    const list = await PillionRideRequest.find({ userId: req.params.userId })
      .populate("packageId")
      .populate("assignedRiderId")
      .sort({ createdAt: -1 });

    res.json(list);
  } catch (err) {
    console.error("PILLION REQUEST USER LOAD ERROR:", err);
    res.status(500).json({ message: "Failed to load requests" });
  }
});

export default router;
