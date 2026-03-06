import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      proxy: true
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const avatar = profile.photos?.[0]?.value;
        const name = profile.displayName;

        if (!email) {
          return done(new Error("Google account has no email"), null);
        }

        // 🔍 Check if user exists by email or googleId
        let user = await User.findOne({
          $or: [
            { googleId: profile.id },
            { email: email }
          ]
        });

        // If user exists but googleId missing, attach it
        if (user && !user.googleId) {
          user.googleId = profile.id;
          await user.save();
        }

        // If user doesn't exist, create new
        if (!user) {
          user = await User.create({
            name,
            email,
            googleId: profile.id,
            avatar
          });
        }

        return done(null, user);

      } catch (err) {
        console.error("Google OAuth Error:", err);
        return done(err, null);
      }
    }
  )
);

export default passport;