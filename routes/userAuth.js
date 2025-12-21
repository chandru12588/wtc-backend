import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { mailer } from "../config/mailer.js";

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
   1) SEND OTP (Email)
================================ */
router.post("/send-otp", async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    if (!email || !name) {
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

    /* SEND EMAIL */
    try {
      await mailer.sendMail({
        from: `"WrongTurn Club" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your WrongTurn Login OTP",
        html: `
          <h2>Your OTP Code</h2>
          <p style="font-size:22px; font-weight:bold;">${otp}</p>
          <p>Use this OTP to login. It expires in 10 minutes.</p>
        `,
      });
    } catch (emailErr) {
      console.error("❌ Email Error:", emailErr);
      return res.status(500).json({
        message: "Failed to send OTP email. Check email configuration.",
      });
    }

    console.log("📨 OTP Email Sent to →", email, "OTP:", otp);

    res.json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===============================
   2) VERIFY OTP + LOGIN
================================ */
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
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

    // clear OTP
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
    console.error(err);
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

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ user });
  } catch (err) {
    console.error(err);
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
