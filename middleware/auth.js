import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";

const getAllowedAdminEmails = () =>
  (process.env.ADMIN_EMAILS ||
    "admin@trippolama.com,chandru.balasub12588@gmail.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const requireAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ msg: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Primary allow: explicit admin role in JWT
    if (decoded.role === "admin") {
      req.user = decoded;
      return next();
    }

    // Fallback allow: token belongs to a known admin record/email
    const admin = decoded?.id ? await Admin.findById(decoded.id).select("email role") : null;
    const allowedEmails = getAllowedAdminEmails();
    const isAllowedAdmin =
      admin &&
      (admin.role === "admin" || allowedEmails.includes(String(admin.email || "").toLowerCase()));

    if (!isAllowedAdmin) return res.status(403).json({ msg: "Access denied" });

    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ msg: "Invalid token" });
  }
};

export const requireUser = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "devsecret");
    if (!decoded?.id) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};
