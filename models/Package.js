import mongoose from "mongoose";

const PackageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },

    // 📍 LOCATION
    location: { type: String, required: true },  // Ooty
    region: { type: String, required: true },    // Tamil Nadu

    // ⭐ Main Category (used for filters/backpacker/forest etc.)
    category: { type: String },                  

    // ⭐ MULTI-TAGS SUPPORT (future filtering)
    tags: {
      type: [String], // e.g. ["Backpacker","Bike Traveller"]
      default: [],
    },

    days: { type: String },

    // 🗓️ DATES (CRITICAL FOR WEEK / MONTH FILTER)
    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
    },

    // 🔮 FUTURE Feature (if you want multiple upcoming batches)
    availableDates: [
      {
        type: Date,
      },
    ],

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
