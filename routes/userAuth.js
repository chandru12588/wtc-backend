import express from "express";
import jwt from "jsonwebtoken";
import passport from "../config/passport.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import HostBooking from "../models/HostBooking.js";
import PillionRideRequest from "../models/PillionRideRequest.js";
import { brevo } from "../config/brevo.js";
import {
  authLoginLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
  passwordRecoveryLimiter,
} from "../middleware/rateLimiters.js";

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET || "devsecret",
    { expiresIn: "7d" }
  );
}

function decodeUser(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.split(" ")[1];
  return jwt.verify(token, process.env.JWT_SECRET || "devsecret");
}

async function findUserFromDecoded(decoded) {
  if (!decoded) return null;

  if (decoded.id) {
    const byId = await User.findById(decoded.id);
    if (byId) return byId;
  }

  if (decoded.email) {
    const byEmail = await User.findOne({
      email: String(decoded.email).trim().toLowerCase(),
    });
    if (byEmail) return byEmail;
  }

  return null;
}

router.post("/send-otp", otpSendLimiter, async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: "Request body missing" });
    }

    const { name, email, phone, dob } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    if ((name || dob) && !phone) {
      return res.status(400).json({ message: "Mobile number required for signup" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    let user = await User.findOne({ email });

    if (!user) {
      const fallbackName = (name && name.trim()) || email.split("@")[0] || "User";
      user = await User.create({ name: fallbackName, email, phone, dob });
    } else {
      if (name && name.trim()) user.name = name.trim();
      if (typeof phone !== "undefined") user.phone = phone;
      if (dob) user.dob = dob;
    }

    user.otpCode = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    try {
      await brevo.post("/smtp/email", {
        sender: {
          name: "Trippolama",
          email: "chandru.jerry@gmail.com",
        },
        to: [{ email }],
        subject: "Trippolama Login OTP",
        htmlContent: `
          <h2>Your OTP Code</h2>
          <p style="font-size:22px;font-weight:bold;">${otp}</p>
          <p>Use this OTP to login. It expires in 10 minutes.</p>
        `,
      });
    } catch (emailError) {
      console.error("BREVO EMAIL ERROR:", emailError?.response?.data || emailError.message);
    }

    res.json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error("SEND OTP ERROR:", err?.response?.data || err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/verify-otp", otpVerifyLimiter, async (req, res) => {
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
        phone: user.phone || "",
        dob: user.dob || null,
      },
    });
  } catch (err) {
    console.error("VERIFY OTP ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/me", async (req, res) => {
  try {
    const decoded = decodeUser(req);

    if (!decoded?.id) {
      return res.status(401).json({ message: "No token" });
    }

    const user = await findUserFromDecoded(decoded);

    if (!user) {
      return res.status(401).json({ message: "Session expired. Please login again" });
    }

    const fullUser = await User.findById(user._id).select("name email phone dob favorites");
    const refreshedToken =
      String(user._id) !== String(decoded.id) ? createToken(user) : null;

    res.json({
      user: fullUser,
      ...(refreshedToken ? { token: refreshedToken } : {}),
    });
  } catch (err) {
    console.error("AUTH ERROR:", err);
    res.status(401).json({ message: "Invalid token" });
  }
});

router.post("/register", authLoginLimiter, async (req, res) => {
  try {
    const { name, email, phone, dob, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, mobile number & password required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const bcrypt = (await import("bcryptjs")).default;
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      phone,
      dob,
      password: hashedPassword,
    });

    const token = createToken(user);

    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        dob: user.dob || null,
      },
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Registration failed" });
  }
});

router.post("/login", authLoginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email & password required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.password) {
      return res.status(400).json({
        message:
          "This account was created with OTP login. Please use OTP to login or reset your password.",
      });
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = createToken(user);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        dob: user.dob || null,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

router.post("/forgot-password", passwordRecoveryLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const crypto = await import("crypto");
    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    const resetUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/reset-password/${resetToken}`;

    await brevo.post("/smtp/email", {
      sender: { name: "Trippolama", email: "noreply@trippolama.com" },
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
    console.error("FORGOT PASSWORD ERROR:", err);
    res.status(500).json({ message: "Failed to send reset email" });
  }
});

router.post("/reset-password", passwordRecoveryLimiter, async (req, res) => {
  try {
    const { token, email, otp, password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Password required" });
    }

    let user = null;

    if (token) {
      user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() },
      });

      if (!user) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }
    } else if (email && otp) {
      user = await User.findOne({ email });
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
    } else {
      return res.status(400).json({ message: "Token or email & OTP required" });
    }

    const bcrypt = (await import("bcryptjs")).default;
    user.password = await bcrypt.hash(password, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    res.status(500).json({ message: "Password reset failed" });
  }
});

router.put("/profile", async (req, res) => {
  try {
    const decoded = decodeUser(req);
    if (!decoded?.id) return res.status(401).json({ message: "Unauthorized" });

    const { name, phone, dob } = req.body || {};

    if (!name || !phone) {
      return res.status(400).json({ message: "Name and mobile number are required" });
    }

    const existingUser = await findUserFromDecoded(decoded);
    if (!existingUser) {
      return res.status(401).json({ message: "Session expired. Please login again" });
    }

    existingUser.name = String(name).trim();
    existingUser.phone = String(phone).trim();
    existingUser.dob = dob || null;
    await existingUser.save();

    const user = await User.findById(existingUser._id).select("name email phone dob favorites");

    const refreshedToken =
      String(existingUser._id) !== String(decoded.id) ? createToken(existingUser) : null;

    res.json({
      message: "Profile updated",
      ...(refreshedToken ? { token: refreshedToken } : {}),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        dob: user.dob || null,
      },
    });
  } catch (err) {
    console.error("PROFILE UPDATE ERROR:", err);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

router.get("/test", (req, res) => {
  res.json({ message: "User Auth Route Working" });
});

router.get("/favorites", async (req, res) => {
  try {
    const decoded = decodeUser(req);
    if (!decoded?.id) return res.status(401).json({ message: "Unauthorized" });

    const existingUser = await findUserFromDecoded(decoded);
    if (!existingUser) {
      return res.status(401).json({ message: "Session expired. Please login again" });
    }

    const user = await User.findById(existingUser._id).select("favorites");
    if (!user) {
      return res.status(401).json({ message: "Session expired. Please login again" });
    }

    res.json({ favorites: user.favorites || [] });
  } catch (err) {
    console.error("FAVORITES LOAD ERROR:", err);
    res.status(500).json({ message: "Failed to load favorites" });
  }
});

router.post("/favorites/toggle", async (req, res) => {
  try {
    const decoded = decodeUser(req);
    if (!decoded?.id) return res.status(401).json({ message: "Unauthorized" });

    const { itemId, itemType = "package", title, location, image, price, serviceType } = req.body;
    if (!itemId) return res.status(400).json({ message: "itemId is required" });

    const existingUser = await findUserFromDecoded(decoded);
    if (!existingUser) {
      return res.status(401).json({ message: "Session expired. Please login again" });
    }

    const user = await User.findById(existingUser._id);
    if (!user) {
      return res.status(401).json({ message: "Session expired. Please login again" });
    }

    const existingIndex = user.favorites.findIndex((fav) => fav.itemId === String(itemId));

    if (existingIndex >= 0) {
      user.favorites.splice(existingIndex, 1);
      await user.save();
      return res.json({ favorite: false, favorites: user.favorites || [] });
    }

    user.favorites.push({
      itemId: String(itemId),
      itemType,
      title: title || "",
      location: location || "",
      image: image || "",
      price: Number(price || 0),
      serviceType: serviceType || "general",
      addedAt: new Date(),
    });
    await user.save();

    res.json({ favorite: true, favorites: user.favorites || [] });
  } catch (err) {
    console.error("FAVORITE TOGGLE ERROR:", err);
    res.status(500).json({ message: "Failed to update favorite" });
  }
});

router.delete("/account", async (req, res) => {
  try {
    const decoded = decodeUser(req);
    if (!decoded?.id) return res.status(401).json({ message: "Unauthorized" });

    const user = await findUserFromDecoded(decoded);
    if (!user) {
      return res.status(401).json({ message: "Session expired. Please login again" });
    }

    await Promise.all([
      Booking.deleteMany({ userId: user._id }),
      HostBooking.deleteMany({ userId: user._id }),
      PillionRideRequest.deleteMany({ userId: user._id }),
    ]);

    await User.findByIdAndDelete(user._id);

    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("ACCOUNT DELETE ERROR:", err);
    res.status(500).json({ message: "Failed to delete account" });
  }
});

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    const token = createToken(req.user);
    res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/login?token=${token}`);
  }
);

export default router;
