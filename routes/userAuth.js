import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { brevo } from "../config/brevo.js";

const router = express.Router();

/* ===============================
   Helper: Create JWT Token
================================ */
function createToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET || "devsecret",
    { expiresIn: "7d" }
  );
}

/* ===============================
   1) SEND OTP (Brevo HTTP API)
================================ */
router.post("/send-otp", async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: "Request body missing" });
    }

    const { name, email, phone } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Name & email required" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({ name, email, phone });
    } else {
      user.name = name;
      user.phone = phone;
    }

    user.otpCode = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await user.save();

    // ✅ SEND EMAIL USING BREVO HTTP API (AXIOS)
    await brevo.post("/smtp/email", {
      sender: {
        name: "WrongTurn Club",
        email: "noreply@wrongturnclub.in",
      },
      to: [{ email }],
      subject: "Your WrongTurn Login OTP",
      htmlContent: `
        <h2>Your OTP Code</h2>
        <p style="font-size:22px;font-weight:bold;">${otp}</p>
        <p>Use this OTP to login. It expires in 10 minutes.</p>
      `,
    });

    console.log("📨 OTP sent to:", email);

    res.json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error("❌ SEND OTP ERROR:", err?.response?.data || err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===============================
   2) VERIFY OTP + LOGIN
================================ */
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email & OTP required" });
    }

    const user = await User.findOne({ email });

    if (!user || !user.otpCode) {
      return res.status(400).json({ message: "OTP not requested" });
    }

    if (user.otpCode !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (user.otpExpires < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    user.otpCode = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = createToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("❌ VERIFY OTP ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===============================
   3) LOGGED-IN USER DETAILS
================================ */
router.get("/me", async (req, res) => {
  try {
    const auth = req.headers.authorization;

    if (!auth?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token" });
    }

    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "devsecret");

    const user = await User.findById(decoded.id).select("name email");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user });
  } catch (err) {
    console.error("❌ AUTH ERROR:", err);
    res.status(401).json({ message: "Invalid token" });
  }
});

/* ===============================
   4) TEST ROUTE
================================ */
router.get("/test", (req, res) => {
  res.json({ message: "User Auth Route Working ✔️" });
});

export default router;
