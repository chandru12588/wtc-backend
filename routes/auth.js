import express from "express";
import jwt from "jsonwebtoken";
import passport from "passport";

const router = express.Router();

// Helper: Create JWT Token
function createToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET || "devsecret",
    { expiresIn: "7d" }
  );
}

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  (req, res) => {
    const token = createToken(req.user);
    res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/login?token=${token}`);
  }
);

export default router;
