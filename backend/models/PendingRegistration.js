const mongoose = require('mongoose');

// Holds a registration attempt until its OTP is verified. The real User
// document is NOT created until verification succeeds — this avoids
// permanently squatting a username on someone who never finishes verifying
// (closed the tab, mistyped their email, changed their mind, etc.).
//
// `expiresAt` is set 1 hour in the future at creation and is watched by a
// MongoDB TTL index below — abandoned registrations clean themselves up
// automatically, with no cron job or manual sweep needed.
const pendingRegistrationSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    // Already bcrypt-hashed by the time it lands here — see the /register/start
    // route. Never stored in plaintext, even temporarily.
    passwordHash: {
      type: String,
      required: true
    },
    otp: {
      type: String,
      required: true
    },
    otpExpires: {
      type: Date,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    }
  },
  { timestamps: true }
);

// TTL index: MongoDB automatically deletes a document once `expiresAt` is in
// the past (checked periodically in the background, not instantaneous, but
// reliably within a couple of minutes of expiry).
pendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PendingRegistration', pendingRegistrationSchema);
