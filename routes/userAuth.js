import express from "express";
import jwt from "jsonwebtoken";
import passport from "../config/passport.js";
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

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    let user = await User.findOne({ email });

    if (!user) {
      const fallbackName = (name && name.trim()) || email.split("@")[0] || "User";
      user = await User.create({ name: fallbackName, email, phone });
    } else {
      if (name && name.trim()) {
        user.name = name.trim();
      }
      if (typeof phone !== "undefined") {
        user.phone = phone;
      }
    }

    user.otpCode = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await user.save();

    // ✅ SEND EMAIL USING BREVO HTTP API (AXIOS)
    try {
      console.log("📧 Attempting to send OTP email...");
      console.log("🔑 BREVO_API_KEY set:", !!process.env.BREVO_API_KEY);
      console.log("📨 Sending to:", email);
      console.log("🤖 OTP Code:", otp);

      const emailResponse = await brevo.post("/smtp/email", {
        sender: {
          name: "WrongTurn Club",
          email: "chandru.jerry@gmail.com",  // Your verified Brevo email
        },
        to: [{ email }],
        subject: "Your WrongTurn Login OTP",
        htmlContent: `
          <h2>Your OTP Code</h2>
          <p style="font-size:22px;font-weight:bold;">${otp}</p>
          <p>Use this OTP to login. It expires in 10 minutes.</p>
        `,
      });
      console.log("✅ OTP email sent successfully:", emailResponse.status);
    } catch (emailError) {
      console.error("❌ BREVO EMAIL ERROR:", emailError?.response?.data || emailError.message);
      console.error("❌ BREVO ERROR DETAILS:", {
        status: emailError?.response?.status,
        statusText: emailError?.response?.statusText,
        data: emailError?.response?.data,
        message: emailError?.message
      });
      console.log("⚠️  OTP generated:", otp, "for email:", email);
    }

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
   4) REGISTER WITH PASSWORD
================================ */
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email & password required" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password manually
    const bcrypt = (await import('bcryptjs')).default;
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword
    });

    // Create token
    const token = createToken(user);

    res.status(201).json({
      message: "Registration successful",
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error("❌ REGISTER ERROR:", err);
    res.status(500).json({ message: "Registration failed" });
  }
});

/* ===============================
   5) LOGIN WITH PASSWORD
================================ */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email & password required" });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if user has a password set
    if (!user.password) {
      return res.status(400).json({
        message: "This account was created with OTP login. Please use OTP to login or reset your password."
      });
    }

    // Check password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Create token
    const token = createToken(user);

    res.json({
      message: "Login successful",
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error("❌ LOGIN ERROR:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

/* ===============================
   6) FORGOT PASSWORD
================================ */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate reset token
    const crypto = await import('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await user.save();

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;

    await brevo.post("/smtp/email", {
      sender: { name: "WrongTurn Club", email: "noreply@wrongturnclub.com" },
      to: [{ email: user.email }],
      subject: "Password Reset Request",
      htmlContent: `
        <h2>Password Reset</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link expires in 10 minutes.</p>
      `,
    });

    res.json({ message: "Password reset email sent" });
  } catch (err) {
    console.error("❌ FORGOT PASSWORD ERROR:", err);
    res.status(500).json({ message: "Failed to send reset email" });
  }
});

/* ===============================
   7) RESET PASSWORD
================================ */
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: "Token & password required" });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Hash new password manually
    const bcrypt = (await import('bcryptjs')).default;
    user.password = await bcrypt.hash(password, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("❌ RESET PASSWORD ERROR:", err);
    res.status(500).json({ message: "Password reset failed" });
  }
});

/* ===============================
   8) TEST ROUTE
================================ */
router.get("/test", (req, res) => {
  res.json({ message: "User Auth Route Working ✔️" });
});

/* ===============================
   GOOGLE AUTH ROUTES
================================ */
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get("/google/callback", passport.authenticate("google", { failureRedirect: "/login" }), (req, res) => {
  const token = createToken(req.user);
  // Redirect to frontend with token
  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?token=${token}`);
});

export default router;
