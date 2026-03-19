import dotenv from "dotenv";
dotenv.config();

import express from "express";
import session from "express-session";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import passport from "./config/passport.js";
import { connectDB } from "./config/db.js";

/* ROUTES */
import adminRoutes from "./routes/admin.js";
import adminAuthRoutes from "./routes/adminAuth.js";
import adminPackageRoutes from "./routes/adminPackages.js";
import adminHostBookings from "./routes/adminHostBookings.js";
import adminHostListingRoutes from "./routes/adminHostListings.js";
import adminBikeRidersRoutes from "./routes/adminBikeRiders.js";
import adminGuideRoutes from "./routes/adminGuides.js";
import adminPillionRequestRoutes from "./routes/adminPillionRequests.js";
import adminUserRoutes from "./routes/adminUsers.js";

import bookingRoutes from "./routes/bookings.js";
import userAuthRoutes from "./routes/userAuth.js";
import authRoutes from "./routes/auth.js";
import paymentRoutes from "./routes/payments.js";
import invoiceRoutes from "./routes/invoice.js";

import hostListingRoutes from "./routes/hostListings.js";

/* MODELS */
import Package from "./models/Package.js";
import Listing from "./models/Listing.js";

const app = express();

/* SECURITY */
app.use(helmet());
app.use(morgan("dev"));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

/* CORS */
const allowedOrigins = [
  "http://localhost:3000",
  "https://wtc-chandru.vercel.app",
  "https://trippolama.com",
  "https://www.trippolama.com"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin?.includes("vercel.app")
      ) {
        callback(null, true);
      } else {
        callback(new Error("CORS blocked"));
      }
    },
    credentials: true
  })
);

/* BODY */
app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: true }));

/* SESSION */
app.set("trust proxy", 1);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  })
);

/* PASSPORT */
app.use(passport.initialize());
app.use(passport.session());

/* HEALTH */
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Running 🚀" });
});

/* ================= AUTH FIX ================= */
app.use("/api/auth", userAuthRoutes); // ✅ FIXED

/* GOOGLE AUTH */
app.use("/api/auth/google", authRoutes);

/* ================= HOST FIX ================= */
app.use("/api/host/listings", hostListingRoutes); // ✅ FIXED

/* ================= ADMIN ================= */
app.use("/api/admin", adminRoutes);
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/packages", adminPackageRoutes);
app.use("/api/admin/host-listings", adminHostListingRoutes);
app.use("/api/admin/bookings", adminHostBookings);
app.use("/api/admin/bike-riders", adminBikeRidersRoutes);
app.use("/api/admin/guides", adminGuideRoutes);
app.use("/api/admin/pillion-requests", adminPillionRequestRoutes);

/* ================= PUBLIC ================= */

// ✅ ALL PACKAGES
app.get("/api/packages", async (req, res) => {
  const list = await Package.find().sort({ createdAt: -1 });
  res.json(list);
});

// ✅ SINGLE PACKAGE (🔥 VERY IMPORTANT)
app.get("/api/packages/:id", async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ msg: "Package not found" });
    res.json(pkg);
  } catch {
    res.status(500).json({ msg: "Error fetching package" });
  }
});

// ✅ HOST LISTINGS (optional backup route)
app.get("/api/host/listings/all", async (req, res) => {
  try {
    const list = await Listing.find({ approved: true });
    res.json(list);
  } catch {
    res.status(500).json({ msg: "Failed to load listings" });
  }
});

/* BOOKINGS */
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/invoice", invoiceRoutes);

/* ERROR HANDLER */
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message });
});

/* 404 */
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

/* START */
const PORT = process.env.PORT || 4000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on ${PORT}`));
});