import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      default: "",
    },

    password: {
      type: String,
    },

    // OTP fields
    otpCode: {
      type: String,
    },

    otpExpires: {
      type: Date,
    },

    // Password reset fields
    resetPasswordToken: {
      type: String,
    },

    resetPasswordExpires: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', function(next) {
  if (this.isModified('password') && this.password) {
    import('bcryptjs').then(bcrypt => {
      bcrypt.hash(this.password, 12, (err, hash) => {
        if (err) return next(err);
        this.password = hash;
        next();
      });
    }).catch(err => next(err));
  } else {
    next();
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    return false; // User doesn't have a password set
  }
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
