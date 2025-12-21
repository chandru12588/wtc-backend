import express from "express";
import Host from "../models/Host.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

// REGISTER HOST
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const exists = await Host.findOne({ email });
    if (exists) return res.status(400).json({ msg: "Host already exists" });

    const hash = await bcrypt.hash(password, 10);

    const host = await Host.create({
      name,
      email,
      phone,
      password: hash,
    });

    res.json({ msg: "Host registered", host });
  } catch (err) {
    res.status(500).json(err);
  }
});

// LOGIN HOST
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const host = await Host.findOne({ email });
  if (!host) return res.status(400).json({ msg: "Host not found" });

  const valid = await bcrypt.compare(password, host.password);
  if (!valid) return res.status(400).json({ msg: "Invalid password" });

  const token = jwt.sign({ id: host._id }, process.env.JWT_SECRET);

  res.json({ msg: "Login success", token, host });
});

export default router;
