import mongoose from "mongoose";

const GuideApplicationSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    whatsappNumber: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    city: { type: String, trim: true, default: "" },
    zipcode: { type: String, trim: true, default: "" },
    languages: { type: [String], default: [] },
    experienceYears: { type: Number, default: 0 },
    specialties: { type: [String], default: [] },
    guideLicense: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export default mongoose.model("GuideApplication", GuideApplicationSchema);
