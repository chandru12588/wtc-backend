// backend/models/Booking.js
import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema(
  {
    /* ================================
       USER INFORMATION
    =================================*/
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    /* ================================
       BOOKING TYPE
    =================================*/
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
    },

    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
    },

    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Host",
    },

    /* ================================
       CUSTOMER DETAILS
    =================================*/
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },

    /* ================================
       DATES
    =================================*/
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },

    /* ================================
       GUEST COUNT
    =================================*/
    people: { type: Number, default: 1 },

    /* ================================
       PAYMENT DETAILS
    =================================*/
    amount: { type: Number, default: 0 },

    idProofUrl: { type: String },

    paymentMethod: {
      type: String,
      enum: ["property", "online"],
      default: "property",
    },

    // ✅ UPDATED ENUM (CRITICAL FIX)
    paymentStatus: {
      type: String,
      enum: [
        "unpaid",
        "paid",
        "refund_pending",
        "refunded",
        "failed",
        "cancelled",
      ],
      default: "unpaid",
    },

    /* ================================
       BOOKING WORKFLOW STATUS
    =================================*/
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      default: "pending",
    },

    /* ================================
       RAZORPAY (ONLINE PAYMENTS)
    =================================*/
    razorpay_order_id: { type: String },
    razorpay_payment_id: { type: String },
    razorpay_signature: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Booking", BookingSchema);
