import User from "../models/User.js";
import otpGenerator from "otp-generator";
import jwt from "jsonwebtoken";

/* ===========================
   SEND OTP
=========================== */
export const sendOtp = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    let user = await User.findOne({ email });

    // Create user if not found
    if (!user) {
      user = await User.create({ name, email, phone });
    }

    // Generate 4-digit OTP
    const otp = otpGenerator.generate(4, {
      digits: true,
      alphabets: false,
      upperCase: false,
      specialChars: false,
    });

    user.otp = otp;
    user.otpExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes
    await user.save();

    console.log("OTP for:", email, "=>", otp); // Temporary: Send OTP to console

    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ===========================
   VERIFY OTP
=========================== */
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (user.otpExpiry < Date.now()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    // Generate JWT Token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    res.json({
      message: "Login successful",
      token,
      user,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
