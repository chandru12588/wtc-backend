import mongoose from "mongoose";

const PackageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    country: { type: String, default: "" },

    // 📍 LOCATION
    location: { type: String, required: true },  // Ooty
    region: { type: String, required: true },    // Tamil Nadu

    // ⭐ Main Category for filtering
    category: { type: String, required: true },
    serviceType: {
      type: String,
      enum: ["general", "bike", "guide", "driver"],
      default: "general",
    },

    // ⭐ NEW – Stay Type (A-frame / Tent / Mud house / Villa...)
    stayType: {
      type: String,
      required: true,       // user must select stay type
    },

    // ⭐ MULTI-TAGS SUPPORT (future filter)
    tags: {
      type: [String],
      default: [],
    },
    guideType: { type: String, default: "" },
    guideLanguages: {
      type: [String],
      default: [],
    },
    guideServiceMode: {
      type: String,
      enum: ["", "private", "group"],
      default: "",
    },
    maxGroupSize: { type: Number, default: 0 },

    days: { type: String },

    // 🗓️ Trip dates
    startDate: { type: Date, required: true },
    endDate: { type: Date },

    // 🔮 For multiple batches in future
    availableDates: [{ type: Date }],

    // Images
    images: [String],
    slug: String,

    // differentiate admin vs host
    isHostListing: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Package", PackageSchema);
