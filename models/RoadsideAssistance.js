import mongoose from "mongoose";

const roadsideAssistanceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  city: {
    type: String,
    required: true,
    enum: ["Chennai", "Bengaluru", "Trichy", "Dindigul", "Kodaikanal"],
  },
  services: [{
    type: String,
    trim: true,
  }],
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  raw: {
    type: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
});

// Index for efficient queries
roadsideAssistanceSchema.index({ city: 1, isActive: 1 });
roadsideAssistanceSchema.index({ name: 1, city: 1 });

export default mongoose.model("RoadsideAssistance", roadsideAssistanceSchema);