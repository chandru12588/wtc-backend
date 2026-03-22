import rateLimit from "express-rate-limit";

const buildLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
  });

export const otpSendLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: "Too many OTP requests. Try again in 15 minutes.",
});

export const otpVerifyLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many OTP attempts. Try again in 15 minutes.",
});

export const authLoginLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 12,
  message: "Too many login attempts. Try again in 15 minutes.",
});

export const passwordRecoveryLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many password reset requests. Try again in 15 minutes.",
});

export const uploadLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: "Too many upload requests. Please wait and try again.",
});

export const publicWriteLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: "Too many requests. Please slow down and try again.",
});
