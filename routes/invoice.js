import express from "express";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import Booking from "../models/Booking.js";
import HostBooking from "../models/HostBooking.js";

const router = express.Router();

/* ------------------ Helpers ------------------ */
const formatDate = (iso) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatINR = (amt) =>
  `₹ ${Number(amt || 0).toLocaleString("en-IN")}`;

/* ======================================================
   GENERATE INVOICE BUFFER (PACKAGE + HOST)
====================================================== */
export async function generateInvoiceBuffer(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const buffers = [];

      doc.on("data", (b) => buffers.push(b));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      /* ---------- Assets ---------- */
      const fontPath = path.join(
        process.cwd(),
        "fonts",
        "NotoSansDevanagari-Regular.ttf"
      );
      const logoPath = path.join(process.cwd(), "assets", "logo.png");

      if (fs.existsSync(fontPath)) {
        doc.registerFont("main", fontPath);
        doc.font("main");
      } else {
        doc.font("Helvetica");
      }

      /* ---------- HEADER ---------- */
      doc.rect(0, 0, doc.page.width, 50).fill("#222833");

      let y = 70;

      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, (doc.page.width - 130) / 2, y, { width: 130 });
        y += 80;
      }

      doc
        .fillColor("#000")
        .fontSize(26)
        .text("BOOKING INVOICE", 0, y, { align: "center" });

      y += 50;

      const leftX = 40;
      const rightX = 320;
      const gap = 18;

      doc.fontSize(12);

      /* ---------- CUSTOMER ---------- */
      doc.text("Invoice ID:", leftX, y);
      doc.text(String(data._id), rightX, y);
      y += gap;

      doc.text("Customer Name:", leftX, y);
      doc.text(data.name, rightX, y);
      y += gap;

      doc.text("Email:", leftX, y);
      doc.text(data.email, rightX, y);
      y += gap;

      doc.text("Phone:", leftX, y);
      doc.text(data.phone || "-", rightX, y);
      y += gap * 2;

      /* ---------- BOOKING ---------- */
      doc.text("Stay / Package:", leftX, y);
      doc.text(data.title || "-", rightX, y);
      y += gap;

      doc.text("Check-in:", leftX, y);
      doc.text(formatDate(data.checkIn), rightX, y);
      y += gap;

      doc.text("Check-out:", leftX, y);
      doc.text(formatDate(data.checkOut), rightX, y);
      y += gap;

      doc.text("Guests:", leftX, y);
      doc.text(String(data.people || data.guests || 1), rightX, y);
      y += gap * 2;

      /* ---------- TOTAL ---------- */
      doc
        .fontSize(18)
        .fillColor("#0a7cff")
        .text(`Total Amount: ${formatINR(data.amount)}`, leftX, y);

      y += 40;

      /* ---------- PAYMENT ---------- */
      doc.fillColor("#000").fontSize(12);
      doc.text("Payment Method:", leftX, y);
      doc.text(
        (data.paymentMethod || data.paymentMode || "-").toUpperCase(),
        rightX,
        y
      );
      y += gap;

      doc.text("Payment Status:", leftX, y);
      doc.text((data.paymentStatus || "-").toUpperCase(), rightX, y);
      y += gap;

      doc.text("Booking Status:", leftX, y);
      doc.text((data.status || data.bookingStatus).toUpperCase(), rightX, y);
      y += gap * 2;

      doc
        .fontSize(11)
        .fillColor("#555")
        .text("Thank you for choosing WrongTurnClub!", 0, y, {
          align: "center",
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/* ======================================================
   DOWNLOAD INVOICE (PACKAGE + HOST)
====================================================== */
router.get("/:id", async (req, res) => {
  try {
    /* ---------- TRY PACKAGE BOOKING ---------- */
    const pkgBooking = await Booking.findById(req.params.id).populate(
      "packageId"
    );

    if (pkgBooking) {
      if (pkgBooking.status !== "accepted") {
        return res
          .status(400)
          .json({ message: "Invoice available after acceptance only" });
      }

      const buffer = await generateInvoiceBuffer({
        _id: pkgBooking._id,
        name: pkgBooking.name,
        email: pkgBooking.email,
        phone: pkgBooking.phone,
        title: pkgBooking.packageId?.title,
        checkIn: pkgBooking.checkIn,
        checkOut: pkgBooking.checkOut,
        people: pkgBooking.people,
        amount: pkgBooking.amount,
        paymentMethod: pkgBooking.paymentMethod,
        paymentStatus: pkgBooking.paymentStatus,
        status: pkgBooking.status,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename=invoice_${pkgBooking._id}.pdf`
      );
      return res.send(buffer);
    }

    /* ---------- TRY HOST BOOKING ---------- */
    const hostBooking = await HostBooking.findById(req.params.id).populate(
      "listingId"
    );

    if (!hostBooking) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (hostBooking.bookingStatus !== "accepted") {
      return res
        .status(400)
        .json({ message: "Invoice available after acceptance only" });
    }

    const buffer = await generateInvoiceBuffer({
      _id: hostBooking._id,
      name: hostBooking.name,
      email: hostBooking.email,
      phone: hostBooking.phone,
      title: hostBooking.listingId?.title || "Host Stay",
      checkIn: hostBooking.checkIn,
      checkOut: hostBooking.checkOut,
      guests: hostBooking.guests,
      amount: hostBooking.amount,
      paymentMode: hostBooking.paymentMode,
      paymentStatus: hostBooking.paymentStatus,
      bookingStatus: hostBooking.bookingStatus,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=invoice_${hostBooking._id}.pdf`
    );

    res.send(buffer);
  } catch (err) {
    console.error("❌ INVOICE ERROR:", err);
    res.status(500).json({ message: "Failed to generate invoice" });
  }
});

export default router;
