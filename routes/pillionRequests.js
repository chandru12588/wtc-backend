import express from "express";
import Package from "../models/Package.js";
import PillionRideRequest from "../models/PillionRideRequest.js";

const router = express.Router();

function inferServiceType(pkg) {
  const normalize = (value) => String(value || "").trim().toLowerCase();

  const explicit = normalize(pkg?.serviceType);
  if (explicit) return explicit;

  const category = normalize(pkg?.category);
  const stayType = normalize(pkg?.stayType);

  if (category === "bike pillion tour" || stayType === "pillion bike tour") {
    return "bike";
  }

  return "general";
}

router.post("/", async (req, res) => {
  try {
    const {
      userId,
      packageId,
      name,
      email,
      phone,
      startDate,
      numberOfDays,
      startPoint,
      destination,
      bikeBrand,
    } = req.body;

    if (
      !userId ||
      !packageId ||
      !name ||
      !email ||
      !phone ||
      !startDate ||
      !numberOfDays ||
      !startPoint ||
      !destination ||
      !bikeBrand
    ) {
      return res.status(400).json({
        message:
          "Name, email, phone, date, days, start point, destination and bike brand are required",
      });
    }

    const pkg = await Package.findById(packageId);
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    if (inferServiceType(pkg) !== "bike") {
      return res
        .status(400)
        .json({ message: "This package is not a pillion rider service" });
    }

    const request = await PillionRideRequest.create({
      userId,
      packageId,
      name,
      email,
      phone,
      startDate,
      numberOfDays: Number(numberOfDays),
      startPoint,
      destination,
      bikeBrand,
    });

    res.status(201).json({
      message: "Pillion rider request submitted successfully",
      request,
    });
  } catch (err) {
    console.error("PILLION REQUEST CREATE ERROR:", err);
    res.status(500).json({ message: "Failed to submit pillion rider request" });
  }
});

router.get("/user/:userId", async (req, res) => {
  try {
    const list = await PillionRideRequest.find({ userId: req.params.userId })
      .populate("packageId")
      .populate("assignedRiderId")
      .sort({ createdAt: -1 });

    res.json(list);
  } catch (err) {
    console.error("PILLION REQUEST USER LOAD ERROR:", err);
    res.status(500).json({ message: "Failed to load requests" });
  }
});

export default router;
