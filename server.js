// server.js
import dotenv from "dotenv";
dotenv.config(); // MUST BE FIRST

import express from "express";
import session from "express-session";
import passport from "./config/passport.js";
import { connectDB } from "./config/db.js";

/* ==========================
        ROUTE IMPORTS
========================== */
import adminRoutes from "./routes/admin.js";
import adminAuthRoutes from "./routes/adminAuth.js";
import adminPackageRoutes from "./routes/adminPackages.js";
import adminHostBookings from "./routes/adminHostBookings.js";
import adminHostListingRoutes from "./routes/adminHostListings.js";
import adminBikeRidersRoutes from "./routes/adminBikeRiders.js";

import bookingRoutes from "./routes/bookings.js";
import userAuthRoutes from "./routes/userAuth.js";
import authRoutes from "./routes/auth.js";
import paymentRoutes from "./routes/payments.js";
import invoiceRoutes from "./routes/invoice.js";

import hostAuthRoutes from "./routes/hostAuth.js";
import hostListingRoutes from "./routes/hostListings.js";
import hostBookingRoutes from "./routes/hostBookings.js";
import hostPaymentRoutes from "./routes/hostPayments.js";
import bikeRidersRoutes from "./routes/bikeRiders.js";

/* MODELS (used in public routes) */
import Package from "./models/Package.js";
import Listing from "./models/Listing.js";

const app = express();

/* ==========================
        MANUAL CORS
========================== */
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (
    origin &&
    (origin.includes("vercel.app") || origin.includes("localhost"))
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

/* ==========================
        BODY PARSERS
========================== */
app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: true }));

/* ==========================
        SESSION CONFIG
========================== */
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your_session_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
    },
  })
);

/* ==========================
        PASSPORT INIT
========================== */
app.use(passport.initialize());
app.use(passport.session());

/* ==========================
        HEALTH CHECK
========================== */
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "WrongTurn backend running 🚀",
  });
});

/* ==========================
        USER AUTH
========================== */
app.use("/api/auth", userAuthRoutes);

/* GOOGLE OAUTH ROUTES */
app.use("/api/auth", authRoutes);

/* ALSO SUPPORT /auth FOR GOOGLE CALLBACK */
app.use("/auth", authRoutes);

/* ==========================
        PUBLIC PACKAGES
========================== */
app.get("/api/packages", async (req, res) => {
  try {
    const list = await Package.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    console.error("PACKAGES ERROR:", err);
    res.status(500).json({ message: "Failed to fetch packages" });
  }
});

app.get("/api/packages/:id", async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ msg: "Package not found" });
    res.json(pkg);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch package" });
  }
});

/* ==========================
        HOST ROUTES
========================== */
app.use("/api/host/auth", hostAuthRoutes);
app.use("/api/host/listings", hostListingRoutes);
app.use("/api/host/bookings", hostBookingRoutes);
app.use("/api/host/payments", hostPaymentRoutes);
app.use("/api/bike-riders", bikeRidersRoutes);

/* ==========================
        PUBLIC LISTINGS
========================== */
app.get("/api/listings", async (req, res) => {
  try {
    const list = await Listing.find({ approved: true }).sort({
      createdAt: -1,
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch listings" });
  }
});

app.get("/api/listings/:id", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id).populate(
      "hostId",
      "name email phoneNumber"
    );
    if (!listing) return res.status(404).json({ msg: "Listing not found" });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch listing" });
  }
});

/* ==========================
            ADMIN
========================== */
app.use("/api/admin", adminRoutes);
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/packages", adminPackageRoutes);
app.use("/api/admin/host-listings", adminHostListingRoutes);
app.use("/api/admin/bookings", adminHostBookings);
app.use("/api/admin/bike-riders", adminBikeRidersRoutes);
app.use("/admin/bike-riders", adminBikeRidersRoutes);

/* ==========================
    BOOKINGS / PAYMENTS
========================== */
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/invoice", invoiceRoutes);

/* ==========================
        404 HANDLER
========================== */
app.use((req, res) => {
  res.status(404).json({ error: "API route not found" });
});

/* ==========================
        START SERVER
========================== */
const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    await connectDB();
    console.log("MongoDB connected");

    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Server startup failed:", err);
    process.exit(1);
  }
}

startServer();
