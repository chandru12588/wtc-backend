import express from "express";
import multer from "multer";
import cloudinary from "cloudinary";
import Booking from "../models/Booking.js";
import Package from "../models/Package.js";
import { requireAdmin } from "../middleware/auth.js";
import { generateInvoiceBuffer } from "./invoice.js";
import { sendEmail } from "../utils/sendEmail.js"; // ✅ BREVO API

const router = express.Router();
const upload = multer();

/* ================= CLOUDINARY ================= */
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ======================================================
   USER — GET PACKAGE BOOKINGS
====================================================== */
router.get("/user/:userId", async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.params.userId })
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
router.post("/", upload.single("idProof"), async (req, res) => {
  try {
    const {
      userId,
      packageId,
      name,
      email,
      phone,
      checkIn,
      checkOut,
      people,
      paymentMethod,
    } = req.body;

    const pkg = await Package.findById(packageId);
    if (!pkg) return res.status(404).json({ message: "Package not found" });

    const amount = pkg.price * Number(people || 1);

    let idProofUrl = null;
    if (req.file) {
      const uploaded = await new Promise((resolve, reject) => {
        cloudinary.v2.uploader
          .upload_stream({ folder: "wrongturn/idproof" }, (err, result) =>
            err ? reject(err) : resolve(result)
          )
          .end(req.file.buffer);
      });
      idProofUrl = uploaded.secure_url;
    }

    const booking = await Booking.create({
      userId,
      packageId,
      name,
      email,
      phone,
      checkIn,
      checkOut,
      people,
      amount,
      idProofUrl,
      paymentMethod,
      paymentStatus: "unpaid",
      status: "pending",
    });

    /* 📧 EMAIL (NON-BLOCKING) */
    try {
      await sendEmail({
        to: email,
        subject: "Booking Received – WrongTurnClub",
        html: `
          <h3>Hello ${name},</h3>
          <p>Your booking for <b>${pkg.title}</b> has been received.</p>
          <p>We will confirm shortly.</p>
          <br/>
          <b>– WrongTurnClub</b>
        `,
      });
    } catch (e) {
      console.error("BOOKING EMAIL FAILED (ignored):", e.message);
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
router.put("/:id/cancel", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("packageId");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
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
        subject: "Booking Cancelled – WrongTurnClub",
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
          <b>– WrongTurnClub</b>
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
          subject: "Booking Confirmed – WrongTurnClub ✅",
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
