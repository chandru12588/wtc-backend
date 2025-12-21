import mongoose from "mongoose";

const PackageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },

    // ⭐ NEW IMPORTANT FIELDS FOR SEARCH
    location: { type: String, required: true },  // Example: Ooty
    region: { type: String, required: true },    // Example: Tamil Nadu

    category: { type: String },
    days: { type: String },

    images: [String],
    slug: String,
  },
  { timestamps: true }
);

export default mongoose.model("Package", PackageSchema);
