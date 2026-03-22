import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import { authLoginLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Admin token required" });
  }

  try {
    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid admin token" });
  }
}

/* ADMIN REGISTER (first time only) */
router.post("/register", authLoginLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const totalAdmins = await Admin.countDocuments();
    const bootstrapKey = String(process.env.ADMIN_BOOTSTRAP_KEY || "");
    const headerKey = String(req.headers["x-admin-bootstrap-key"] || "");

    if (totalAdmins > 0) {
      return res.status(403).json({ message: "Admin registration is closed" });
    }

    if (bootstrapKey && headerKey !== bootstrapKey) {
      return res.status(403).json({ message: "Invalid bootstrap key" });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const exists = await Admin.findOne({ email });
    if (exists) return res.status(400).json({ message: "Admin already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const admin = await Admin.create({
      name,
      email,
      password: hashed,
      role: "admin",
    });

    res.json({ message: "Admin registered", admin });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* LOGIN */
router.post("/login", authLoginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const normalizedRole = admin.role || "admin";
    const token = jwt.sign(
      { id: admin._id, role: normalizedRole, email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      admin: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: normalizedRole,
        createdAt: admin.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/change-password", authLoginLimiter, requireAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters" });
    }

    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    admin.password = await bcrypt.hash(newPassword, 10);
    await admin.save();

    res.json({ message: "Admin password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update admin password" });
  }
});

/* RESET PASSWORD (TEMP) */
router.post("/reset", (_req, res) => {
  return res.status(403).json({ message: "This endpoint is disabled" });
});

export default router;
