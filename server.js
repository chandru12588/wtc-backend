// server.js
import dotenv from "dotenv";
dotenv.config(); // MUST BE FIRST

import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";

/* ==========================
      ROUTE IMPORTS
========================== */
import adminRoutes from "./routes/admin.js";
import adminAuthRoutes from "./routes/adminAuth.js";
import adminPackageRoutes from "./routes/adminPackages.js";

/* ⭐ ADMIN HOST BOOKINGS (EMAIL + INVOICE FIX) */
import adminHostBookings from "./routes/adminHostBookings.js";

import bookingRoutes from "./routes/bookings.js";
import userAuthRoutes from "./routes/userAuth.js";
import paymentRoutes from "./routes/payments.js";
import invoiceRoutes from "./routes/invoice.js";

/* HOST ROUTES */
import hostAuthRoutes from "./routes/hostAuth.js";
import hostListingRoutes from "./routes/hostListings.js";
import hostBookingRoutes from "./routes/hostBookings.js";
import hostPaymentRoutes from "./routes/hostPayments.js";

/* ADMIN HOST LISTINGS */
import adminHostListingRoutes from "./routes/adminHostListings.js";

/* MODELS (used in public routes) */
import Package from "./models/Package.js";
import Listing from "./models/Listing.js";

const app = express();

/* ==========================
          CORS
========================== */
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: true }));

/* ==========================
        USER AUTH
========================== */
app.use("/api/auth", userAuthRoutes);

/* ==========================
        PUBLIC PACKAGES
========================== */
app.get("/api/packages", async (req, res) => {
  try {
    const list = await Package.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch packages" });
  }
});

app.get("/api/packages/:id", async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    res.json(pkg);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch package" });
  }
});

/* ==========================
      HOST AUTH + LISTINGS
========================== */
app.use("/api/host/auth", hostAuthRoutes);
app.use("/api/host/listings", hostListingRoutes);

/* ⭐ HOST BOOKINGS */
app.use("/api/host/bookings", hostBookingRoutes);

/* ⭐ HOST PAYMENTS */
app.use("/api/host/payments", hostPaymentRoutes);

/* ==========================
      PUBLIC HOST LISTINGS
========================== */
app.get("/api/listings", async (req, res) => {
  try {
    const list = await Listing.find({ approved: true }).sort({ createdAt: -1 });
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
    console.log("FETCH LISTING ERROR:", err);
    res.status(500).json({ msg: "Failed to fetch listing" });
  }
});

/* ==========================
              ADMIN
========================== */
app.use("/api/admin", adminRoutes);
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/packages", adminPackageRoutes);

/* ⭐ ADMIN HOST LISTINGS */
app.use("/api/admin/host-listings", adminHostListingRoutes);

/* ⭐ ADMIN BOOKINGS (PACKAGE + HOST) */
app.use("/api/admin/bookings", adminHostBookings);

/* ==========================
            BOOKINGS
========================== */
app.use("/api/bookings", bookingRoutes);

/* ==========================
            PAYMENTS
========================== */
app.use("/api/payments", paymentRoutes);

/* ==========================
            INVOICES
========================== */
app.use("/api/invoice", invoiceRoutes);

/* ==========================
        START SERVER
========================== */
const PORT = process.env.PORT || 4000;
connectDB();

app.listen(PORT, () =>
  console.log(`🚀 WrongTurn backend running at http://localhost:${PORT}`)
);
