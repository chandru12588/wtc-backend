import mongoose from "mongoose";

const KodaikanalQuoteRequestSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    fromCity: {
      type: String,
      enum: ["Chennai", "Bengaluru", "Trichy"],
      required: true,
      index: true,
    },
    travelDate: { type: Date, required: true, index: true },
    travelers: { type: Number, default: 1, min: 1 },
    budget: { type: Number, default: 0, min: 0 },
    notes: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["new", "contacted", "closed"],
      default: "new",
      index: true,
    },
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KodaikanalTravelAgent",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("KodaikanalQuoteRequest", KodaikanalQuoteRequestSchema);
