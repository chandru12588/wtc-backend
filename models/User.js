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
      required: function() {
        return !this.otpCode; // Password required if not using OTP
      },
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
userSchema.pre('save', async function(next) {
  if (this.isModified('password') && this.password) {
    const bcrypt = await import('bcryptjs');
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
