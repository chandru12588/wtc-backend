import mongoose from "mongoose";

const BikeRiderApplicationSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    dob: { type: Date, required: true },

    operatingState: {
      type: String,
      default: "Tamil Nadu",
      enum: ["Tamil Nadu"],
    },
    operatingCities: { type: [String], default: [] },
    preferredRoutes: { type: [String], default: [] },

    bikeBrand: { type: String, required: true, trim: true },
    bikeModel: { type: String, required: true, trim: true },
    bikeYear: { type: Number },
    bikeRegistrationNumber: { type: String, required: true, trim: true },
    hasPillionHelmet: { type: Boolean, default: true },
    hasExtraGear: { type: Boolean, default: false },

    rcNumber: { type: String, required: true, trim: true },
    licenseNumber: { type: String, required: true, trim: true },
    idProofType: { type: String, required: true, trim: true },
    idProofNumber: { type: String, required: true, trim: true },

    experienceYears: { type: Number, default: 0 },
    emergencyContactName: { type: String, trim: true, default: "" },
    emergencyContactPhone: { type: String, trim: true, default: "" },
    additionalNotes: { type: String, trim: true, default: "" },

    rcImageUrl: { type: String, default: "" },
    licenseImageUrl: { type: String, default: "" },
    idProofImageUrl: { type: String, default: "" },
    bikeImageUrls: { type: [String], default: [] },

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

export default mongoose.model("BikeRiderApplication", BikeRiderApplicationSchema);
