import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";

const router = express.Router();

/* ADMIN REGISTER (first time only) */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const exists = await Admin.findOne({ email });
    if (exists) return res.status(400).json({ msg: "Admin already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const admin = await Admin.create({
      name,
      email,
      password: hashed,
      role: "admin",
    });

    res.json({ msg: "Admin registered", admin });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

/* LOGIN */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(400).json({ msg: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ msg: "Login successful", token });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

/* RESET PASSWORD (TEMP) */
router.post("/reset", async (req, res) => {
  try {
    const email = "admin@wrongturn.com";
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(404).json({ msg: "Admin not found" });

    const hashed = await bcrypt.hash("WrongTurn@123", 10);
    admin.password = hashed;
    await admin.save();

    res.json({ msg: "Admin password reset!" });
  } catch {
    res.status(500).json({ msg: "Reset error" });
  }
});

export default router;
