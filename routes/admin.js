import express from "express";
import Booking from "../models/Booking.js";
import HostBooking from "../models/HostBooking.js";

const router = express.Router();

/* =====================================================
   ADMIN DASHBOARD STATS  (already working – kept same)
===================================================== */
router.get("/stats", async (req, res) => {
  try {
    const packageBookings = await Booking.find().populate("packageId");
    const hostBookings = await HostBooking.find().populate("listingId");

    const totalBookings = packageBookings.length + hostBookings.length;

    const totalRevenue =
      packageBookings.filter(b => b.paymentStatus === "paid")
        .reduce((s, b) => s + (b.amount || 0), 0) +
      hostBookings.filter(b => b.paymentStatus === "paid")
        .reduce((s, b) => s + (b.amount || 0), 0);

    const now = new Date();

    const upcomingTrips =
      packageBookings.filter(b => (b.checkIn || b.date) && new Date(b.checkIn || b.date) > now).length +
      hostBookings.filter(b => b.checkIn && new Date(b.checkIn) > now).length;

    const destinationCount = {};

    packageBookings.forEach(b => {
      const r = b.packageId?.region;
      if (r) destinationCount[r] = (destinationCount[r] || 0) + 1;
    });

    hostBookings.forEach(b => {
      const l = b.listingId?.location;
      if (l) destinationCount[l] = (destinationCount[l] || 0) + 1;
    });

    const topDestinations = Object.entries(destinationCount)
      .map(([location, count]) => ({ location, count }));

    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthlyData = months.map(m => ({ month: m, revenue: 0 }));

    packageBookings.forEach(b => {
      if (b.paymentStatus === "paid") {
        const d = b.checkIn || b.date;
        if (d) monthlyData[new Date(d).getMonth()].revenue += b.amount || 0;
      }
    });

    hostBookings.forEach(b => {
      if (b.paymentStatus === "paid" && b.checkIn) {
        monthlyData[new Date(b.checkIn).getMonth()].revenue += b.amount || 0;
      }
    });

    const combined = [
      ...packageBookings.map(b => ({
        _id: b._id,
        name: b.name,
        phone: b.phone,
        email: b.email,
        trip: b.packageId?.title || "Package",
        amount: b.amount,
        paymentStatus: b.paymentStatus,
        status: b.status,
        date: b.checkIn || b.date,
        source: "Package"
      })),
      ...hostBookings.map(b => ({
        _id: b._id,
        name: b.name,
        phone: b.phone,
        email: b.email,
        trip: b.listingId?.title || "Host Stay",
        amount: b.amount,
        paymentStatus: b.paymentStatus,
        status: b.bookingStatus || "pending",
        date: b.checkIn,
        source: "Host"
      }))
    ];

    combined.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date) - new Date(a.date);
    });

    const recentBookings = combined.slice(0, 10);

    const bookingTrend = recentBookings.map(b => ({
      date: b.date ? new Date(b.date).toLocaleDateString("en-IN") : "No Date",
      count: 1
    }));

    res.json({
      totalBookings,
      totalRevenue,
      upcomingTrips,
      topDestinations,
      monthlyData,
      bookingTrend,
      recentBookings
    });

  } catch (err) {
    console.log("ADMIN STATS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =====================================================
   ✅ ADMIN GET ALL BOOKINGS (PACKAGE + HOST)
===================================================== */
router.get("/bookings", async (req, res) => {
  try {
    const hostBookings = await HostBooking.find().populate("listingId");
    const packageBookings = await Booking.find().populate("packageId");
    

    const merged = [
      ...packageBookings.map(b => ({
        _id: b._id,
        name: b.name,
        trip: b.packageId?.title || "Package",
        amount: b.amount,
        paymentStatus: b.paymentStatus,
        status: b.status,
        date: b.checkIn || b.date,
        source: "Package"
      })),
      ...hostBookings.map(b => ({
        _id: b._id,
        name: b.name,
        trip: b.listingId?.title || "Host Stay",
        amount: b.amount,
        paymentStatus: b.paymentStatus,
        status: b.bookingStatus || "pending",
        date: b.checkIn,
        source: "Host"
      }))
    ];

    merged.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date) - new Date(a.date);
    });

    res.json(merged);

  } catch (err) {
    console.log("ADMIN BOOKINGS ERROR:", err);
    res.status(500).json({ message: "Failed to load bookings" });
  }
});

export default router;
