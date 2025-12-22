// backend/routes/hostBookings.js
import express from "express";
import multer from "multer";
import cloudinary from "cloudinary";
import HostBooking from "../models/HostBooking.js";
import { mailer } from "../services/email.js"; // ✅ BREVO MAILER

const router = express.Router();

/* ---------------------------------------
   CLOUDINARY CONFIG
----------------------------------------- */
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ---------------------------------------
   MULTER STORAGE
----------------------------------------- */
const storage = multer.memoryStorage();
const upload = multer({ storage });

/* ---------------------------------------
   UPLOAD ID PROOF
----------------------------------------- */
router.post("/upload-id", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: "No file uploaded" });

    cloudinary.v2.uploader
      .upload_stream({ folder: "wtc/host_idproofs" }, (err, result) => {
        if (err) return res.status(500).json({ msg: "Upload failed" });
        res.json({ url: result.secure_url });
      })
      .end(req.file.buffer);
  } catch {
    res.status(500).json({ msg: "Upload failed" });
  }
});

/* ---------------------------------------
   CREATE HOST BOOKING
----------------------------------------- */
router.post("/", async (req, res) => {
  try {
    const {
      listingId,
      userId,
      hostId,
      name,
      email,
      phone,
      checkIn,
      checkOut,
      guests,
      amount,
      paymentMode,
      idProofUrl,
    } = req.body;

    if (!listingId || !userId || !hostId) {
      return res.status(400).json({ msg: "Missing IDs" });
    }

    const conflict = await HostBooking.findOne({
      listingId,
      paymentStatus: "paid",
      checkIn: { $lte: new Date(checkOut) },
      checkOut: { $gte: new Date(checkIn) },
    });

    if (conflict) {
      return res
        .status(400)
        .json({ msg: "Listing not available for selected dates" });
    }

    const booking = await HostBooking.create({
      listingId,
      userId,
      hostId,
      name,
      email,
      phone,
      checkIn,
      checkOut,
      guests,
      amount,
      paymentMode,
      idProofUrl,
      paymentStatus: "pending",
      bookingStatus: "pending",
    });

    res.json({ booking });
  } catch (err) {
    console.error("HOST BOOKING ERROR:", err);
    res.status(500).json({ msg: "Booking failed" });
  }
});

/* ---------------------------------------
   GET BOOKINGS FOR HOST
----------------------------------------- */
router.get("/host/:hostId", async (req, res) => {
  try {
    const list = await HostBooking.find({ hostId: req.params.hostId })
      .populate("listingId")
      .populate("userId");

    res.json(list);
  } catch {
    res.status(500).json({ msg: "Failed to load host bookings" });
  }
});

/* ---------------------------------------
   GET BOOKINGS FOR USER
----------------------------------------- */
router.get("/user/:userId", async (req, res) => {
  try {
    const list = await HostBooking.find({
      userId: req.params.userId,
      bookingStatus: { $ne: "rejected" },
    })
      .populate("listingId")
      .populate("hostId")
      .sort({ createdAt: -1 });

    res.json(list);
  } catch {
    res.status(500).json({ msg: "Failed to load user bookings" });
  }
});

/* ---------------------------------------
   USER CANCEL HOST BOOKING
----------------------------------------- */
router.put("/:id/cancel", async (req, res) => {
  try {
    const booking = await HostBooking.findById(req.params.id).populate(
      "listingId"
    );

    if (!booking)
      return res.status(404).json({ msg: "Booking not found" });

    if (new Date() >= new Date(booking.checkIn)) {
      return res
        .status(400)
        .json({ msg: "Cannot cancel after check-in date" });
    }

    booking.bookingStatus = "cancelled";
    booking.cancelledAt = new Date();
    booking.cancelledBy = "user";

    booking.paymentStatus =
      booking.paymentStatus === "paid"
        ? "refund_pending"
        : "cancelled";

    await booking.save();

    /* 📧 EMAIL (BREVO) */
    await mailer.sendMail({
      from: process.env.EMAIL_FROM, // noreply@brevo.com
      to: booking.email,
      subject: "Host Booking Cancelled – WrongTurnClub",
      html: `
        <h3>Hello ${booking.name},</h3>
        <p>Your booking for <b>${booking.listingId?.title}</b> has been cancelled.</p>
        <p>Check-in: ${new Date(booking.checkIn).toDateString()}</p>
        <p>${
          booking.paymentStatus === "refund_pending"
            ? "Refund will be processed in 5–7 working days."
            : "No payment was captured."
        }</p>
        <br/>
        <b>– WrongTurnClub</b>
      `,
    });

    res.json({ booking });
  } catch (err) {
    console.error("CANCEL HOST BOOKING ERROR:", err);
    res.status(500).json({ msg: "Cancel failed" });
  }
});

export default router;
