import mongoose from "mongoose";

const PillionRideRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
      required: true,
    },
    assignedRiderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BikeRiderApplication",
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    numberOfDays: { type: Number, required: true, min: 1 },
    startPoint: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
    bikeBrand: { type: String, required: true, trim: true },
    age: { type: Number, min: 18 },
    idProofType: { type: String, trim: true, default: "" },
    idProofUrl: { type: String, trim: true, default: "" },
    customerPhotoUrl: { type: String, trim: true, default: "" },
    policyAccepted: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    adminNotes: { type: String, default: "" },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("PillionRideRequest", PillionRideRequestSchema);
