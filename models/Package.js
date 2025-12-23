import mongoose from "mongoose";

const PackageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },

    // 📍 LOCATION
    location: { type: String, required: true },  // Ooty
    region: { type: String, required: true },    // Tamil Nadu

    category: { type: String },
    days: { type: String },

    // 🗓️ DATES (CRITICAL FOR WEEK / MONTH FILTER)
    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
    },

    // 🔮 FUTURE (Optional – like Exoticamp batches)
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
