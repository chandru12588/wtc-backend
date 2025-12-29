// backend/models/Listing.js
import mongoose from "mongoose";

const ListingSchema = new mongoose.Schema(
  {
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: "Host" },

    title: { type: String, required: true },
    description: { type: String, required: true },

    location: { type: String, required: true },
    price: { type: Number, required: true },

    images: [String],

    // ⭐ Used in UI search & categories
    stayType: { type: String },      // <--- ADDED
    category: { type: String },      

    approved: { type: Boolean, default: false },

    // ⭐ Week/Month filter support
    startDate: { type: Date },       // <--- NEW
    endDate: { type: Date },         // <--- NEW

    /* Availability System (optional) */
    availableFrom: { type: Date },
    availableTo: { type: Date },

    blockedRanges: [
      {
        from: { type: Date },
        to: { type: Date },
        reason: { type: String },
      }
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Listing", ListingSchema);
