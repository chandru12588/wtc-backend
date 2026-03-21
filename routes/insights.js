import express from "express";
import Package from "../models/Package.js";

const router = express.Router();

router.get("/popular-destinations", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit || 10), 20));

    const rows = await Package.aggregate([
      {
        $addFields: {
          coverImage: {
            $ifNull: [{ $arrayElemAt: ["$images", 0] }, ""],
          },
        },
      },
      {
        $group: {
          _id: {
            location: "$location",
            region: "$region",
          },
          packageCount: { $sum: 1 },
          totalReviews: { $sum: "$reviewCount" },
          avgRating: { $avg: "$averageRating" },
          image: { $first: "$coverImage" },
        },
      },
      {
        $project: {
          _id: 0,
          location: "$_id.location",
          region: "$_id.region",
          image: 1,
          packageCount: 1,
          totalReviews: 1,
          avgRating: { $round: ["$avgRating", 1] },
          score: {
            $add: [
              { $multiply: ["$packageCount", 2] },
              "$totalReviews",
              "$avgRating",
            ],
          },
        },
      },
      { $sort: { score: -1, totalReviews: -1, packageCount: -1 } },
      { $limit: limit },
    ]);

    res.json(rows);
  } catch (err) {
    console.error("POPULAR DESTINATIONS ERROR:", err);
    res.status(500).json({ message: "Failed to load popular destinations" });
  }
});

export default router;
