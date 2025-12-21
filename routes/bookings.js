import express from "express";
import multer from "multer";
import cloudinary from "cloudinary";
import Booking from "../models/Booking.js";
import HostBooking from "../models/HostBooking.js";
import Package from "../models/Package.js";
import { requireAdmin } from "../middleware/auth.js";
import nodemailer from "nodemailer";
import { generateInvoiceBuffer } from "./invoice.js";

const router = express.Router();
const upload = multer();

/* ================= CLOUDINARY ================= */
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ================= EMAIL ================= */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* verify once at server start */
transporter.verify((err) => {
  if (err) {
    console.error("❌ EMAIL CONFIG ERROR:", err);
  } else {
    console.log("✅ EMAIL TRANSPORTER READY");
  }
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

    /* 📧 EMAIL CONFIRMATION */
    await transporter.sendMail({
      from: `"WrongTurnClub" <${process.env.EMAIL_USER}>`,
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

    res.json({ booking });
  } catch (err) {
    console.error("BOOKING CREATE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   USER — CANCEL PACKAGE BOOKING ✅ (NEW)
====================================================== */
router.put("/:id/cancel", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking)
      return res.status(404).json({ message: "Booking not found" });

    if (!["pending", "accepted"].includes(booking.status)) {
      return res
        .status(400)
        .json({ message: "This booking cannot be cancelled" });
    }

    if (new Date() >= new Date(booking.checkIn)) {
      return res
        .status(400)
        .json({ message: "Check-in date already passed" });
    }

    booking.status = "cancelled";
    booking.paymentStatus =
      booking.paymentStatus === "paid"
        ? "refund_pending"
        : "cancelled";

    await booking.save();

    res.json({ message: "Booking cancelled successfully", booking });
  } catch (err) {
    console.error("CANCEL BOOKING ERROR:", err);
    res.status(500).json({ message: "Cancel failed" });
  }
});

/* ======================================================
   ADMIN — GET ALL BOOKINGS (PACKAGE + HOST)
====================================================== */
router.get("/admin/all", requireAdmin, async (req, res) => {
  try {
    const packageBookings = await Booking.find()
      .populate("packageId")
      .sort({ createdAt: -1 });

    const hostBookings = await HostBooking.find()
      .populate("listingId")
      .sort({ createdAt: -1 });

    const merged = [
      ...packageBookings.map((b) => ({
        _id: b._id,
        name: b.name,
        email: b.email,
        phone: b.phone,
        packageId: { title: b.packageId?.title },
        people: b.people,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        amount: b.amount,
        paymentStatus: b.paymentStatus,
        paymentMethod: b.paymentMethod,
        status: b.status,
        idProofUrl: b.idProofUrl,
        source: "package",
      })),
      ...hostBookings.map((b) => ({
        _id: b._id,
        name: b.name,
        email: b.email,
        phone: b.phone,
        packageId: { title: b.listingId?.title || "Host Stay" },
        people: b.guests,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        amount: b.amount,
        paymentStatus: b.paymentStatus,
        paymentMethod: b.paymentMode,
        status: b.bookingStatus || "pending",
        idProofUrl: b.idProofUrl,
        source: "host",
      })),
    ];

    merged.sort((a, b) => new Date(b.checkIn || 0) - new Date(a.checkIn || 0));
    res.json(merged);
  } catch (err) {
    console.error("ADMIN BOOKINGS ERROR:", err);
    res.status(500).json({ message: "Failed to load bookings" });
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

    if (status === "accepted") booking.paymentStatus = "paid";
    if (status === "rejected") booking.paymentStatus = "failed";

    await booking.save();

    if (status === "accepted") {
      const invoiceBuffer = await generateInvoiceBuffer(booking);

      await transporter.sendMail({
        from: `"WrongTurnClub" <${process.env.EMAIL_USER}>`,
        to: booking.email,
        subject: "Booking Confirmed – WrongTurnClub ✅",
        html: `
          <h3>Hello ${booking.name}</h3>
          <p>Your booking for <b>${booking.packageId.title}</b> is confirmed.</p>
          <p><b>Check-in:</b> ${new Date(booking.checkIn).toDateString()}</p>
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
    }

    res.json({ booking });
  } catch (err) {
    console.error("PACKAGE STATUS UPDATE ERROR:", err);
    res.status(500).json({ message: "Failed to update status" });
  }
});

export default router;
