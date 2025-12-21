import mongoose from "mongoose";

const ListingSchema = new mongoose.Schema(
  {
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: "Host" },

    title: { type: String, required: true },
    description: { type: String, required: true },

    location: { type: String, required: true },
    price: { type: Number, required: true },

    images: [String],

    category: { type: String },

    approved: { type: Boolean, default: false },

    /* ================================
       ⭐ AVAILABILITY SYSTEM (NEW)
    =================================*/

    // Basic available date range
    availableFrom: { type: Date },
    availableTo: { type: Date },

    // Block specific days or periods (maintenance, full booking, etc.)
    blockedRanges: [
      {
        from: { type: Date },
        to: { type: Date },
        reason: { type: String }, // optional text
      }
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Listing", ListingSchema);
