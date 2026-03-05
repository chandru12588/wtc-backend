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

// Hash password before saving - DISABLED to avoid conflicts with OTP
// userSchema.pre('save', function(next) {
//   // Only run if password is being modified and is a non-empty string
//   if (this.isModified('password') && typeof this.password === 'string' && this.password.trim().length > 0) {
//     import('bcryptjs').then(bcrypt => {
//       bcrypt.hash(this.password, 12, (err, hash) => {
//         if (err) {
//           console.error('Password hashing error:', err);
//           return next(err);
//         }
//         this.password = hash;
//         next();
//       });
//     }).catch(err => {
//       console.error('Bcrypt import error:', err);
//       next(err);
//     });
//   } else {
//     next();
//   }
// });

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
