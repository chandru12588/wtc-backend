import dotenv from "dotenv";
dotenv.config();

import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";

import passport from "./config/passport.js";
import { connectDB } from "./config/db.js";
import Admin from "./models/Admin.js";

import adminRoutes from "./routes/admin.js";
import adminAuthRoutes from "./routes/adminAuth.js";
import adminPackageRoutes from "./routes/adminPackages.js";
import adminHostBookings from "./routes/adminHostBookings.js";
import adminHostListingRoutes from "./routes/adminHostListings.js";
import adminBikeRidersRoutes from "./routes/adminBikeRiders.js";
import adminGuideRoutes from "./routes/adminGuides.js";
import adminActingDriverRoutes from "./routes/adminActingDrivers.js";
import adminPillionRequestRoutes from "./routes/adminPillionRequests.js";
import adminUserRoutes from "./routes/adminUsers.js";
import adminStoriesRoutes from "./routes/adminStories.js";

import bookingRoutes from "./routes/bookings.js";
import userAuthRoutes from "./routes/userAuth.js";
import authRoutes from "./routes/auth.js";
import paymentRoutes from "./routes/payments.js";
import invoiceRoutes from "./routes/invoice.js";
import hostListingRoutes from "./routes/hostListings.js";
import hostBookingRoutes from "./routes/hostBookings.js";
import bikeRiderRoutes from "./routes/bikeRiders.js";
import guideRoutes from "./routes/guides.js";
import actingDriverRoutes from "./routes/actingDrivers.js";
import pillionRequestRoutes from "./routes/pillionRequests.js";
import reviewRoutes from "./routes/reviews.js";
import storyRoutes from "./routes/stories.js";
import insightRoutes from "./routes/insights.js";
import aiChatRoutes from "./routes/aiChat.js";
import kodaikanalAgentsRoutes from "./routes/kodaikanalAgents.js";
import adminKodaikanalAgentsRoutes from "./routes/adminKodaikanalAgents.js";
import { startKodaikanalSyncScheduler } from "./services/kodaikanalAgentSync.js";

import Package from "./models/Package.js";
import Listing from "./models/Listing.js";

const app = express();

// Required on Railway/proxy so rate-limit sees real client IP
app.set("trust proxy", 1);

app.use(helmet());
app.use(morgan("dev"));

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://wtc-chandru.vercel.app",
  "https://trippolama.com",
  "https://www.trippolama.com",
];

const allowVercelPreviews = process.env.ALLOW_VERCEL_PREVIEWS === "true";
const isTrustedVercelPreview = (origin = "") =>
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(String(origin || ""));

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        (allowVercelPreviews && isTrustedVercelPreview(origin))
      ) {
        callback(null, true);
      } else {
        callback(new Error("CORS blocked"));
      }
    },
    credentials: true,
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
});
app.use(limiter);

app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: true }));

const isProduction = process.env.NODE_ENV === "production";
const mongoSessionUrl = process.env.MONGO_URI || process.env.MONGODB_URI;

const sessionConfig = {
  secret: process.env.SESSION_SECRET || "secret",
  resave: false,
  saveUninitialized: false,
  proxy: isProduction,
  cookie: {
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
  },
};

if (mongoSessionUrl) {
  sessionConfig.store = MongoStore.create({
    mongoUrl: mongoSessionUrl,
    collectionName: "sessions",
    ttl: 60 * 60 * 24,
    autoRemove: "native",
  });
} else {
  console.warn("SESSION WARNING: MONGO_URI/MONGODB_URI missing, using MemoryStore (dev only)");
}

app.use(session(sessionConfig));

app.use(passport.initialize());
app.use(passport.session());

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Running" });
});

app.use("/api/auth", userAuthRoutes);
app.use("/api/auth/google", authRoutes);

app.use("/api/host/listings", hostListingRoutes);
app.use("/api/host/bookings", hostBookingRoutes);
app.use("/api/bike-riders", bikeRiderRoutes);
app.use("/api/guides", guideRoutes);
app.use("/api/acting-drivers", actingDriverRoutes);
app.use("/api/pillion-requests", pillionRequestRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/insights", insightRoutes);
app.use("/api/ai", aiChatRoutes);
app.use("/api/kodaikanal-agents", kodaikanalAgentsRoutes);

app.use("/api/admin/auth", adminAuthRoutes);
const requireAdminAccess = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Admin token required" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role === "admin") return next();

    const admin = decoded?.id
      ? await Admin.findById(decoded.id).select("email role")
      : null;
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ message: "Admin access denied" });
    }

    next();
  } catch {
    return res.status(401).json({ message: "Invalid admin token" });
  }
};

app.use("/api/admin", requireAdminAccess, adminRoutes);
app.use("/api/admin/users", requireAdminAccess, adminUserRoutes);
app.use("/api/admin/packages", requireAdminAccess, adminPackageRoutes);
app.use("/api/admin/host-listings", requireAdminAccess, adminHostListingRoutes);
app.use("/api/admin/bookings", requireAdminAccess, adminHostBookings);
app.use("/api/admin/bike-riders", requireAdminAccess, adminBikeRidersRoutes);
app.use("/api/admin/guides", requireAdminAccess, adminGuideRoutes);
app.use("/api/admin/acting-drivers", requireAdminAccess, adminActingDriverRoutes);
app.use("/api/admin/pillion-requests", requireAdminAccess, adminPillionRequestRoutes);
app.use("/api/admin/stories", requireAdminAccess, adminStoriesRoutes);
app.use("/api/admin/kodaikanal-agents", requireAdminAccess, adminKodaikanalAgentsRoutes);

app.get("/api/packages", async (req, res) => {
  const list = await Package.find().sort({ createdAt: -1 });
  res.json(list);
});

app.get("/api/packages/:id", async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ msg: "Package not found" });
    res.json(pkg);
  } catch {
    res.status(500).json({ msg: "Error fetching package" });
  }
});

app.get("/api/host/listings/all", async (req, res) => {
  try {
    const list = await Listing.find({ approved: true });
    res.json(list);
  } catch {
    res.status(500).json({ msg: "Failed to load listings" });
  }
});

app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/invoice", invoiceRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  const statusCode =
    err?.statusCode || (err?.name === "MulterError" ? 400 : 500);
  res.status(statusCode).json({ message: err?.message || "Server error" });
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

const PORT = process.env.PORT || 4000;

connectDB().then(() => {
  startKodaikanalSyncScheduler();
  app.listen(PORT, () => console.log(`Server running on ${PORT}`));
});



