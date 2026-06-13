import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleCallback = process.env.GOOGLE_CALLBACK_URL;

if (googleClientId && googleClientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: googleCallback,
        proxy: true,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const avatar = profile.photos?.[0]?.value;
          const name = profile.displayName;

          if (!email) {
            return done(new Error("Google account has no email"), null);
          }

          let user = await User.findOne({
            $or: [{ googleId: profile.id }, { email: email }],
          });

          if (user && !user.googleId) {
            user.googleId = profile.id;
            await user.save();
          }

          if (!user) {
            user = await User.create({
              name,
              email,
              googleId: profile.id,
              avatar,
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
} else {
  console.warn("Google OAuth not configured: GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET missing");
}

export default passport;