import mongoose from "mongoose";

const ActingDriverApplicationSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    age: { type: Number, required: true },
    phone: { type: String, required: true, trim: true },
    whatsappNumber: { type: String, required: true, trim: true },
    vehicleType: {
      type: String,
      required: true,
      enum: ["car", "bike"],
    },
    experienceYears: { type: Number, default: 0 },
    licenseImageUrl: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    adminReviewNotes: { type: String, default: "" },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model(
  "ActingDriverApplication",
  ActingDriverApplicationSchema
);
