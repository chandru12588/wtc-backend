import mongoose from "mongoose";

const KodaikanalTravelAgentSchema = new mongoose.Schema(
  {
    city: {
      type: String,
      enum: ["Chennai", "Bengaluru", "Trichy"],
      required: true,
      index: true,
    },
    destination: { type: String, default: "Kodaikanal", index: true },
    dedupeKey: { type: String, required: true, unique: true, index: true },
    apifyItemId: { type: String, trim: true, default: "" },
    sourceUrl: { type: String, trim: true, default: "" },
    name: { type: String, trim: true, required: true },
    agencyName: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    whatsapp: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    website: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    rating: { type: Number, default: 0, min: 0, max: 5, index: true },
    reviewCount: { type: Number, default: 0 },
    priceFrom: { type: Number, default: 0, min: 0, index: true },
    description: { type: String, trim: true, default: "" },
    services: { type: [String], default: [] },
    verified: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    lastSyncedAt: { type: Date, default: Date.now, index: true },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

KodaikanalTravelAgentSchema.index({ city: 1, rating: -1 });

export default mongoose.model("KodaikanalTravelAgent", KodaikanalTravelAgentSchema);
