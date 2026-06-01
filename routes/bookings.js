import express from "express";
import cloudinary from "cloudinary";
import Booking from "../models/Booking.js";
import Package from "../models/Package.js";
import { requireAdmin, requireUser } from "../middleware/auth.js";
import { createMemoryUpload } from "../middleware/upload.js";
import { publicWriteLimiter, uploadLimiter } from "../middleware/rateLimiters.js";
import { generateInvoiceBuffer } from "./invoice.js";
import { sendEmail } from "../utils/sendEmail.js"; // ✅ BREVO API

const router = express.Router();
const upload = createMemoryUpload({
  maxFileSizeMB: 20,
  allowImages: true,
  allowVideos: false,
  allowPdf: true,
});
const bookingUpload = upload.fields([
  { name: "idProof", maxCount: 1 },
  { name: "profilePhoto", maxCount: 1 },
  { name: "vehicleImage", maxCount: 1 },
]);

const uploadToCloudinary = async (file, folder) => {
  if (!file) return null;

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

const toDayStart = (value) => {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day;
};

/* ================= CLOUDINARY ================= */
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ======================================================
   USER — GET PACKAGE BOOKINGS
====================================================== */
router.get("/user/:userId", requireUser, async (req, res) => {
  try {
    if (String(req.user.id) !== String(req.params.userId)) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const bookings = await Booking.find({ userId: req.user.id })
      .populate("packageId")
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (err) {
    console.error("USER BOOKINGS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   ADMIN — GET ALL PACKAGE BOOKINGS  ✅ FIX
====================================================== */
router.get("/admin/all", requireAdmin, async (req, res) => {
  try {
    const list = await Booking.find()
      .populate("packageId")
      .sort({ createdAt: -1 });

    res.json(list);
  } catch (err) {
    console.error("ADMIN BOOKINGS ERROR:", err);
    res.status(500).json({ message: "Failed to load bookings" });
  }
});

/* ======================================================
   CREATE PACKAGE BOOKING
====================================================== */
router.post("/", publicWriteLimiter, uploadLimiter, bookingUpload, async (req, res) => {
  try {
    const {
      userId,
      packageId,
      name,
      email,
      phone,
      age,
      checkIn,
      checkOut,
      serviceStartPoint,
      serviceDestination,
      serviceDays,
      serviceType,
      whatsappNumber,
      customerCountry,
      serviceCountry,
      serviceState,
      serviceCity,
      guideServiceMode,
      preferredLanguage,
      bikeBrand,
      vehicleModel,
      vehicleYear,
      fuelType,
      vehicleRcNumber,
      tripType,
      tripPlan,
      policyAccepted,
      idProofType,
      people,
      paymentMethod,
    } = req.body;

    const pkg = await Package.findById(packageId);
    if (!pkg) return res.status(404).json({ message: "Package not found" });

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut || checkIn);
    if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) {
      return res.status(400).json({ message: "Invalid check-in/check-out date" });
    }

    const requestedFrom = toDayStart(checkInDate);
    const requestedTo = toDayStart(checkOutDate);
    if (requestedTo < requestedFrom) {
      return res.status(400).json({ message: "Check-out cannot be before check-in" });
    }

    const today = toDayStart(new Date());
    if (requestedFrom < today) {
      return res.status(400).json({ message: "Past dates are not available for booking" });
    }

    const manuallyBlocked = (pkg.blockedDates || [])
      .map((d) => toDayStart(d))
      .some((d) => d >= requestedFrom && d <= requestedTo);
    if (manuallyBlocked) {
      return res.status(409).json({
        message: "Selected date is blocked for this package. Please choose another date.",
      });
    }

    const overlap = await Booking.findOne({
      packageId,
      status: { $in: ["pending", "accepted"] },
      checkIn: { $lte: requestedTo },
      checkOut: { $gte: requestedFrom },
    }).select("_id");

    if (overlap) {
      return res.status(409).json({
        message: "Selected date is already booked. Please choose another date.",
      });
    }

    const normalizedServiceType = serviceType || pkg.serviceType || "general";
    const normalizedDays = Math.max(Number(serviceDays || 1), 1);
    const normalizedPeople = Math.max(Number(people || 1), 1);
    const amount =
      normalizedServiceType === "guide" || normalizedServiceType === "driver"
        ? pkg.price * normalizedDays
        : pkg.price * normalizedPeople;

    const idProofUrl = await uploadToCloudinary(
      req.files?.idProof?.[0],
      "trippolama/idproof"
    );
    const profilePhotoUrl = await uploadToCloudinary(
      req.files?.profilePhoto?.[0],
      "trippolama/customer-photos"
    );
    const vehicleImageUrl = await uploadToCloudinary(
      req.files?.vehicleImage?.[0],
      "trippolama/vehicle-images"
    );

    const booking = await Booking.create({
      userId,
      packageId,
      name,
      email,
      phone,
      age: age ? Number(age) : undefined,
      checkIn,
      checkOut,
      serviceStartPoint,
      serviceDestination,
      serviceDays: serviceDays ? Number(serviceDays) : undefined,
      serviceType: normalizedServiceType,
      whatsappNumber,
      customerCountry,
      serviceCountry,
      serviceState,
      serviceCity,
      guideServiceMode,
      preferredLanguage,
      bikeBrand,
      vehicleModel,
      vehicleYear: vehicleYear ? Number(vehicleYear) : undefined,
      fuelType,
      vehicleRcNumber,
      tripType,
      tripPlan,
      policyAccepted: String(policyAccepted) === "true",
      idProofType,
      people: normalizedPeople,
      amount,
      idProofUrl,
      profilePhotoUrl,
      vehicleImageUrl,
      paymentMethod,
      paymentStatus: "unpaid",
      status: "pending",
    });

    /* 📧 EMAIL (NON-BLOCKING) */
    try {
      await sendEmail({
        to: email,
        subject: "Booking Received – Trippolama",
        html: `
          <h3>Hello ${name},</h3>
          <p>Your ${normalizedServiceType === "guide" ? "guide request" : normalizedServiceType === "driver" ? "driver request" : "booking"} for <b>${pkg.title}</b> has been received.</p>
          <p>We will confirm shortly.</p>
          <br/>
          <b>– Trippolama</b>
        `,
      });
    } catch (e) {
      console.error("BOOKING EMAIL FAILED (ignored):", e.message);
    }

    try {
      await notifyAdmin({
        subject: `New ${normalizedServiceType} request - ${pkg.title}`,
        html: `
          <h3>New ${normalizedServiceType} request</h3>
          <p><b>Package:</b> ${pkg.title}</p>
          <p><b>Name:</b> ${name}</p>
          <p><b>Email:</b> ${email}</p>
          <p><b>Phone:</b> ${phone || "-"}</p>
        `,
      });
    } catch (e) {
      console.error("ADMIN BOOKING EMAIL FAILED (ignored):", e.message);
    }

    res.json({ booking });
  } catch (err) {
    console.error("BOOKING CREATE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   USER / ADMIN — CANCEL PACKAGE BOOKING  ✅ FIX
====================================================== */
router.put("/:id/cancel", requireUser, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("packageId");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (String(booking.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: "Not allowed to cancel this booking" });
    }

    if (new Date() >= new Date(booking.checkIn)) {
      return res
        .status(400)
        .json({ message: "Cannot cancel after check-in date" });
    }

    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    booking.cancelledBy = "user";

    booking.paymentStatus =
      booking.paymentStatus === "paid"
        ? "refund_pending"
        : "cancelled";

    await booking.save();

    /* 📧 EMAIL (NON-BLOCKING) */
    try {
      await sendEmail({
        to: booking.email,
        subject: "Booking Cancelled – Trippolama",
        html: `
          <h3>Hello ${booking.name},</h3>
          <p>Your booking for <b>${booking.packageId?.title}</b> has been cancelled.</p>
          <p>Check-in: ${new Date(booking.checkIn).toDateString()}</p>
          <p>${
            booking.paymentStatus === "refund_pending"
              ? "Refund will be processed in 5–7 working days."
              : "No payment was captured."
          }</p>
          <br/>
          <b>– Trippolama</b>
        `,
      });
    } catch (e) {
      console.error("CANCEL EMAIL FAILED (ignored):", e.message);
    }

    res.json({ booking });
  } catch (err) {
    console.error("PACKAGE CANCEL ERROR:", err);
    res.status(500).json({ message: "Cancel failed" });
  }
});

/* ======================================================
   PUBLIC - BLOCKED DATES FOR A PACKAGE
====================================================== */
router.get("/package/:packageId/blocked-dates", async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.packageId).select("blockedDates");
    const bookings = await Booking.find({
      packageId: req.params.packageId,
      status: { $in: ["pending", "accepted"] },
    }).select("checkIn checkOut");

    const blockedDates = (pkg?.blockedDates || []).map((d) =>
      new Date(d).toISOString().split("T")[0]
    );
    bookings.forEach((item) => {
      const from = toDayStart(item.checkIn);
      const to = toDayStart(item.checkOut || item.checkIn);
      for (let cursor = new Date(from); cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
        blockedDates.push(new Date(cursor).toISOString().split("T")[0]);
      }
    });

    res.json({ blockedDates: [...new Set(blockedDates)] });
  } catch (err) {
    console.error("BLOCKED DATES ERROR:", err);
    res.status(500).json({ message: "Failed to load blocked dates" });
  }
});

/* ======================================================
   USER â€” DELETE OWN PACKAGE BOOKING
====================================================== */
router.delete("/:id/user-delete", requireUser, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (String(booking.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: "Not allowed to delete this booking" });
    }

    await Booking.findByIdAndDelete(req.params.id);
    res.json({ message: "Booking deleted" });
  } catch (err) {
    console.error("PACKAGE DELETE ERROR:", err);
    res.status(500).json({ message: "Failed to delete booking" });
  }
});

/* ======================================================
   ADMIN — ACCEPT / REJECT PACKAGE BOOKINGS
====================================================== */
router.put("/:id/status", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    const booking = await Booking.findById(req.params.id).populate("packageId");
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    booking.status = status;
    booking.paymentStatus = status === "accepted" ? "paid" : "failed";
    await booking.save();

    if (status === "accepted") {
      const invoiceBuffer = await generateInvoiceBuffer(booking);

      try {
        await sendEmail({
          to: booking.email,
          subject: "Booking Confirmed – Trippolama ✅",
          html: `
            <h3>Hello ${booking.name}</h3>
            <p>Your booking for <b>${booking.packageId.title}</b> is confirmed.</p>
            <p><b>Check-in:</b> ${new Date(
              booking.checkIn
            ).toDateString()}</p>
            <p><b>Amount:</b> ₹${booking.amount}</p>
            <br/>
            <b>Invoice attached.</b>
          `,
          attachments: [
            {
              filename: `invoice_${booking._id}.pdf`,
              content: invoiceBuffer,
            },
          ],
        });
      } catch (e) {
        console.error("CONFIRMATION EMAIL FAILED:", e.message);
      }
    }

    res.json({ booking });
  } catch (err) {
    console.error("PACKAGE STATUS UPDATE ERROR:", err);
    res.status(500).json({ message: "Failed to update status" });
  }
});

export default router;


