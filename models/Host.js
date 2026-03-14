import mongoose from "mongoose";

const HostSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    phone: String,
    whatsappNumber: String,
    country: String,
    state: String,
    city: String,
    zipcode: String,
    idProofType: String,
    idProof: String,
    googleMapLocation: String,
    password: String,
    role: { type: String, default: "host" },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Host", HostSchema);
