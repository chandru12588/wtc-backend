import express from "express";
import BikeRiderApplication from "../models/BikeRiderApplication.js";
import PillionRideRequest from "../models/PillionRideRequest.js";
import { requireAdmin } from "../middleware/auth.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

router.get("/", requireAdmin, async (req, res) => {
  try {
    const requests = await PillionRideRequest.find()
      .populate("packageId")
      .populate("assignedRiderId")
      .sort({ createdAt: -1 });

    const availableRiders = await BikeRiderApplication.find({
      status: "approved",
    }).sort({ fullName: 1 });

    res.json({ requests, availableRiders });
  } catch (err) {
    console.error("ADMIN PILLION REQUEST LIST ERROR:", err);
    res.status(500).json({ message: "Failed to fetch pillion requests" });
  }
});

router.put("/:id/approve", requireAdmin, async (req, res) => {
  try {
    const { assignedRiderId, notes = "" } = req.body || {};
    if (!assignedRiderId) {
      return res
        .status(400)
        .json({ message: "Assigned rider is required for approval" });
    }

    const rider = await BikeRiderApplication.findById(assignedRiderId);
    if (!rider || rider.status !== "approved") {
      return res.status(404).json({ message: "Approved rider not found" });
    }

    const request = await PillionRideRequest.findByIdAndUpdate(
      req.params.id,
      {
        status: "approved",
        assignedRiderId,
        adminNotes: notes,
        approvedAt: new Date(),
        rejectedAt: undefined,
      },
      { new: true }
    )
      .populate("packageId")
      .populate("assignedRiderId");

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    try {
      await sendEmail({
        to: request.email,
        subject: "Pillion Rider Service Confirmed",
        html: `
          <h3>Hello ${request.name},</h3>
          <p>Your pillion rider service request for <b>${request.packageId?.title || "Pillion Rider Service"}</b> has been approved.</p>
          <p><b>Rider:</b> ${request.assignedRiderId?.fullName || "Assigned"}</p>
          <p><b>Rider Contact:</b> ${request.assignedRiderId?.phone || "Will be shared shortly"}</p>
          <p><b>Start:</b> ${request.startPoint}</p>
          <p><b>Destination:</b> ${request.destination}</p>
          <p><b>Trip Date:</b> ${new Date(request.startDate).toDateString()}</p>
          <p><b>Days:</b> ${request.numberOfDays}</p>
          <p><b>Bike Brand:</b> ${request.bikeBrand}</p>
          ${notes ? `<p><b>Admin Notes:</b> ${notes}</p>` : ""}
        `,
      });
    } catch (e) {
      console.error("PILLION APPROVAL EMAIL FAILED:", e.message);
    }

    res.json({ message: "Pillion request approved", request });
  } catch (err) {
    console.error("ADMIN PILLION REQUEST APPROVE ERROR:", err);
    res.status(500).json({ message: "Failed to approve request" });
  }
});

router.put("/:id/reject", requireAdmin, async (req, res) => {
  try {
    const { notes = "" } = req.body || {};
    const request = await PillionRideRequest.findByIdAndUpdate(
      req.params.id,
      {
        status: "rejected",
        adminNotes: notes,
        rejectedAt: new Date(),
        approvedAt: undefined,
        assignedRiderId: undefined,
      },
      { new: true }
    ).populate("packageId");

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    try {
      await sendEmail({
        to: request.email,
        subject: "Pillion Rider Service Update",
        html: `
          <h3>Hello ${request.name},</h3>
          <p>Your pillion rider service request for <b>${request.packageId?.title || "Pillion Rider Service"}</b> has been rejected.</p>
          ${notes ? `<p><b>Admin Notes:</b> ${notes}</p>` : ""}
        `,
      });
    } catch (e) {
      console.error("PILLION REJECTION EMAIL FAILED:", e.message);
    }

    res.json({ message: "Pillion request rejected", request });
  } catch (err) {
    console.error("ADMIN PILLION REQUEST REJECT ERROR:", err);
    res.status(500).json({ message: "Failed to reject request" });
  }
});

export default router;
