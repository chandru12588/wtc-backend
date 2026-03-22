import express from "express";
import User from "../models/User.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAdmin);

// GET all users
router.get("/", async (req, res) => {
  try {
    const users = await User.find().select("_id name email phone createdAt");
    res.json(users);
  } catch (err) {
    console.error("Users fetch error:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

export default router;
