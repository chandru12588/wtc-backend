import mongoose from "mongoose";

const HostBookingSchema = new mongoose.Schema(
  {
    /* ---------------- RELATIONS ---------------- */
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
    },

    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Host",
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    /* ---------------- CUSTOMER ---------------- */
    name: String,
    email: String,
    phone: String,

    /* ---------------- STAY DETAILS ---------------- */
    checkIn: Date,
    checkOut: Date,
    guests: Number,

    /* ---------------- PRICING ---------------- */
    amount: Number,

    /* ---------------- DOCUMENTS ---------------- */
    idProofUrl: String, // Aadhaar / License etc.

    /* ---------------- PAYMENT ---------------- */
    paymentMode: {
      type: String,
      enum: ["online", "pay_at_property"],
      default: "online",
    },

    paymentStatus: {
      type: String,
      enum: [
        "pending",          // booked but not paid
        "paid",             // payment success
        "refund_pending",   // cancelled after payment
        "refunded",         // refund completed
        "failed",           // payment failed
        "cancelled",        // unpaid cancellation
      ],
      default: "pending",
    },

    /* ---------------- BOOKING STATUS ---------------- */
    bookingStatus: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      default: "pending",
    },

    /* ---------------- CANCELLATION ---------------- */
    cancelledAt: Date,
    cancelledBy: {
      type: String,
      enum: ["user", "admin"],
    },

    /* ---------------- PAYMENT GATEWAY ---------------- */
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
  },
  { timestamps: true }
);

export default mongoose.model("HostBooking", HostBookingSchema);
