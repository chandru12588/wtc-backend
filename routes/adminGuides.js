import express from "express";
import GuideApplication from "../models/GuideApplication.js";
import { requireAdmin } from "../middleware/auth.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

router.get("/", requireAdmin, async (req, res) => {
  try {
    const applications = await GuideApplication.find().sort({ createdAt: -1 });
    res.json(applications);
  } catch (err) {
    console.error("ADMIN GUIDE LIST ERROR:", err);
    res.status(500).json({ message: "Failed to fetch guide applications" });
  }
});

router.put("/:id/approve", requireAdmin, async (req, res) => {
  try {
    const { notes = "" } = req.body || {};

    const application = await GuideApplication.findByIdAndUpdate(
      req.params.id,
      {
        status: "approved",
        adminReviewNotes: notes,
        approvedAt: new Date(),
        rejectedAt: undefined,
      },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({ message: "Guide application not found" });
    }

    try {
      await sendEmail({
        to: application.email,
        subject: "Guide Application Approved - WrongTurnClub",
        html: `
          <h3>Hello ${application.fullName},</h3>
          <p>Your guide application has been approved.</p>
          <p><b>Country:</b> ${application.country}</p>
          <p><b>Private Charge / Day:</b> ${application.currencySymbol} ${application.privateDayCharge}</p>
          <p><b>Group Charge / Day:</b> ${application.currencySymbol} ${application.groupDayCharge}</p>
          ${notes ? `<p><b>Admin Notes:</b> ${notes}</p>` : ""}
          <br/>
          <b>- WrongTurnClub</b>
        `,
      });
    } catch (e) {
      console.error("GUIDE APPROVAL EMAIL FAILED:", e.message);
    }

    res.json({ message: "Guide application approved", application });
  } catch (err) {
    console.error("ADMIN GUIDE APPROVE ERROR:", err);
    res.status(500).json({ message: "Failed to approve guide application" });
  }
});

router.put("/:id/reject", requireAdmin, async (req, res) => {
  try {
    const { notes = "" } = req.body || {};

    const application = await GuideApplication.findByIdAndUpdate(
      req.params.id,
      {
        status: "rejected",
        adminReviewNotes: notes,
        rejectedAt: new Date(),
        approvedAt: undefined,
      },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({ message: "Guide application not found" });
    }

    try {
      await sendEmail({
        to: application.email,
        subject: "Guide Application Update - WrongTurnClub",
        html: `
          <h3>Hello ${application.fullName},</h3>
          <p>Your guide application has been rejected.</p>
          ${notes ? `<p><b>Admin Notes:</b> ${notes}</p>` : ""}
          <br/>
          <b>- WrongTurnClub</b>
        `,
      });
    } catch (e) {
      console.error("GUIDE REJECTION EMAIL FAILED:", e.message);
    }

    res.json({ message: "Guide application rejected", application });
  } catch (err) {
    console.error("ADMIN GUIDE REJECT ERROR:", err);
    res.status(500).json({ message: "Failed to reject guide application" });
  }
});

export default router;
