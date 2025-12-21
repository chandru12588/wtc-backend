import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";

const router = express.Router();

/* ================================
      VERIFY ENV IS LOADED
================================ */
console.log("🟢 Razorpay Key Loaded:", process.env.RAZORPAY_KEY_ID);

/* ================================
      INITIALIZE RAZORPAY
================================ */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ================================
        CREATE ORDER
================================ */
router.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    const options = {
      amount: amount * 100, // convert to paise
      currency: "INR",
      receipt: "order_rcpt_" + Date.now(),
    };

    const order = await razorpay.orders.create(options);

    return res.json(order);
  } catch (err) {
    console.error("❌ Razorpay Order Error:", err);
    res.status(500).json({ message: "Failed to create order" });
  }
});

/* ================================
        VERIFY PAYMENT
================================ */
router.post("/verify", async (req, res) => {
  try {
    const {
      bookingId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid signature" });
    }

    return res.json({ message: "Payment verified", bookingId });
  } catch (err) {
    console.error("❌ Razorpay Verify Error:", err);
    res.status(500).json({ message: "Payment verification failed" });
  }
});

export default router;
