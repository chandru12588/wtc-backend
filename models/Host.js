import mongoose from "mongoose";

const HostSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    phone: String,
    password: String,
    role: { type: String, default: "host" },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Host", HostSchema);
