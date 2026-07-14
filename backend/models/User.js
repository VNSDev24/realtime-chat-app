const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    lastSeen: {
      type: Date,
      default: Date.now
    },
    // Brute-force protection: tracks consecutive failed login attempts for
    // THIS specific account (independent of the IP-based rate limiter, which
    // only slows down request volume, not targeted password-guessing against
    // one known username).
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    // When set to a future date, login attempts are rejected until this time,
    // regardless of whether the password is actually correct.
    lockUntil: {
      type: Date,
      default: null
    },
    // ---------- Account recovery (email) ----------
    // Sparse + unique: existing accounts have no email yet, and Mongo's
    // unique index would otherwise collide on multiple `null` values without
    // `sparse: true`.
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      default: null
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    // Holds an email address while it's awaiting OTP confirmation. Kept
    // separate from `email` so a previously-verified email stays valid and
    // usable for recovery right up until the NEW one is actually confirmed.
    pendingEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: null
    },
    emailOtp: {
      type: String,
      default: null
    },
    emailOtpExpires: {
      type: Date,
      default: null
    },
    // Password reset: the token itself is never stored — only its hash —
    // for the same reason passwords are hashed rather than stored directly.
    passwordResetTokenHash: {
      type: String,
      default: null
    },
    passwordResetExpires: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// Hash password before saving
// bcrypt hashes always start with one of these version prefixes and are a
// fixed 60 characters long — a reliable, standard way to detect "this is
// already a hash" and avoid double-hashing it.
function looksLikeBcryptHash(value) {
  return typeof value === 'string' && value.length === 60 && /^\$2[aby]\$/.test(value);
}

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  if (looksLikeBcryptHash(this.password)) return next(); // already hashed upstream — see PendingRegistration flow
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ---------- Account lockout helpers ----------
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

userSchema.methods.isLocked = function () {
  return Boolean(this.lockUntil && this.lockUntil > new Date());
};

// Called after a failed password check. Increments the counter and locks the
// account once the threshold is hit. Kept as a single save() call to avoid
// a race between reading and writing the count across concurrent requests.
userSchema.methods.registerFailedLogin = async function () {
  this.failedLoginAttempts += 1;
  if (this.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    this.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
    this.failedLoginAttempts = 0; // reset counter for the next lockout cycle
  }
  await this.save();
};

// Called after a successful login — clears any prior failed-attempt history.
userSchema.methods.registerSuccessfulLogin = async function () {
  this.failedLoginAttempts = 0;
  this.lockUntil = null;
  this.lastSeen = new Date();
  await this.save();
};

// Never leak password hash or recovery secrets in JSON responses
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.emailOtp;
    delete ret.emailOtpExpires;
    delete ret.passwordResetTokenHash;
    delete ret.passwordResetExpires;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
