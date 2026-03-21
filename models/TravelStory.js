import mongoose from "mongoose";

const TravelStorySchema = new mongoose.Schema(
  {
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
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    content: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },
    location: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
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

export default mongoose.model("TravelStory", TravelStorySchema);
