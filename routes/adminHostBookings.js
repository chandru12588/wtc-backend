import express from "express";
import HostBooking from "../models/HostBooking.js";
import { requireAdmin } from "../middleware/auth.js";
import { generateInvoiceBuffer } from "./invoice.js";
import { mailer } from "../services/email.js"; // ✅ USE BREVO MAILER

const router = express.Router();

/* ======================================================
   ADMIN — GET ALL HOST BOOKINGS
====================================================== */
router.get("/", requireAdmin, async (req, res) => {
  try {
    const list = await HostBooking.find()
      .populate("listingId")
      .sort({ createdAt: -1 });

    res.json(list);
  } catch (err) {
    console.error("ADMIN HOST BOOKINGS ERROR:", err);
    res.status(500).json({ message: "Failed to load host bookings" });
  }
});

/* ======================================================
   ✅ ADMIN — ACCEPT / REJECT HOST BOOKING (FIXED)
====================================================== */
router.put("/host/:id/status", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    const booking = await HostBooking.findById(req.params.id)
      .populate("listingId");

    if (!booking) {
      return res.status(404).json({ message: "Host booking not found" });
    }

    booking.bookingStatus = status;
    booking.paymentStatus = status === "accepted" ? "paid" : "pending";

    await booking.save();

    /* 📧 EMAIL + 📄 INVOICE */
    if (status === "accepted") {
      const invoiceBuffer = await generateInvoiceBuffer({
        ...booking.toObject(),
        packageId: { title: booking.listingId?.title || "Host Stay" },
        people: booking.guests,
        paymentMethod: booking.paymentMode,
        status: booking.bookingStatus,
      });

      await mailer.sendMail({
        from: process.env.EMAIL_FROM, // noreply@brevo.com
        to: booking.email,
        subject: "Host Stay Booking Confirmed – WrongTurnClub ✅",
        html: `
          <h3>Hello ${booking.name}</h3>
          <p>Your stay at <b>${booking.listingId?.title}</b> is confirmed.</p>
          <p><b>Check-in:</b> ${new Date(booking.checkIn).toDateString()}</p>
          <p><b>Amount:</b> ₹${booking.amount}</p>
          <br/>
          <b>Invoice attached.</b>
        `,
        attachments: [
          {
            filename: `invoice_${booking._id}.pdf`,
            content: invoiceBuffer,
          },
        ],
      });
    }

    res.json({ booking });
  } catch (err) {
    console.error("HOST STATUS UPDATE ERROR:", err);
    res.status(500).json({ message: "Failed to update host booking" });
  }
});

export default router;
