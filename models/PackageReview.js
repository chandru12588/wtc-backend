import mongoose from "mongoose";

const PackageReviewSchema = new mongoose.Schema(
  {
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    userAvatar: {
      type: String,
      default: "",
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    reviewText: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    media: {
      type: [
        {
          url: { type: String, required: true },
          mediaType: {
            type: String,
            enum: ["image", "video"],
            default: "image",
          },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

PackageReviewSchema.index({ packageId: 1, userId: 1 }, { unique: true });

export default mongoose.model("PackageReview", PackageReviewSchema);
