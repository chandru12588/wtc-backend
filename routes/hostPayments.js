// backend/routes/hostPayments.js
import dotenv from "dotenv";
dotenv.config(); // Load .env FIRST

import express from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import HostBooking from "../models/HostBooking.js";

const router = express.Router();

/* ========================================================
      RAZORPAY INITIALIZATION — FIXED
========================================================= */

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error("❌ Missing Razorpay keys in .env");
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ========================================================
      CREATE ORDER  (Online Payment)
========================================================= */
router.post("/create-order", async (req, res) => {
  try {
    const { amount, receipt } = req.body;

    if (!amount) {
      return res.status(400).json({ message: "Amount missing" });
    }

    const options = {
      amount: Math.round(amount * 100), // Convert ₹ to paise
      currency: "INR",
      receipt: receipt || `host_order_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    return res.json(order);

  } catch (err) {
    console.log("❌ Razorpay create-order error:", err);
    res.status(500).json({ message: "Failed to create Razorpay order" });
  }
});

/* ========================================================
      VERIFY PAYMENT
========================================================= */
router.post("/verify", async (req, res) => {
  try {
    const {
      bookingId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!bookingId) {
      return res.status(400).json({ message: "Booking ID missing" });
    }

    if (!razorpay_signature) {
      return res.status(400).json({ message: "Signature missing" });
    }

    // Verify digital signature
    const signBody = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(signBody)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // Update booking status
    const booking = await HostBooking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    booking.paymentStatus = "paid";
    booking.razorpayOrderId = razorpay_order_id;
    booking.razorpayPaymentId = razorpay_payment_id;
    booking.razorpaySignature = razorpay_signature;

    await booking.save();

    res.json({
      success: true,
      message: "Payment verified and booking updated",
    });

  } catch (err) {
    console.log("❌ Razorpay verify error:", err);
    res.status(500).json({ message: "Payment verification failed" });
  }
});

export default router;
