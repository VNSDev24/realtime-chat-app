const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const PendingRegistration = require('../models/PendingRegistration');
const { sendUsernameEmail, sendPasswordResetEmail, sendOtpEmail } = require('../utils/mailer');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/register/start - validates the new account details, hashes
// the password immediately, and emails a 6-digit code. The real User account
// is NOT created yet — see register/verify below for why.
router.post('/register/start', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({ error: 'username, password, and email are required' });
    }
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      return res.status(400).json({ error: 'username must be between 3 and 30 characters' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'password must be at least 6 characters' });
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    // Username must be free of BOTH a real account and any other in-progress
    // (not-yet-expired) registration attempt.
    const existingUser = await User.findOne({ username: trimmedUsername });
    if (existingUser) {
      return res.status(409).json({ error: 'username already taken' });
    }
    const existingPending = await PendingRegistration.findOne({ username: trimmedUsername });
    if (existingPending) {
      return res.status(409).json({ error: 'That username has a registration already in progress. Try verifying it, or wait for it to expire and try again.' });
    }

    const existingEmailUser = await User.findOne({ email: trimmedEmail, emailVerified: true });
    if (existingEmailUser) {
      return res.status(409).json({ error: 'That email is already associated with an existing account' });
    }

    // Hash now — this is what gets carried into the real User document
    // later, so a plaintext password is never persisted, even temporarily.
    const passwordHash = await bcrypt.hash(password, 10);
    const otp = generateOtp();

    await PendingRegistration.create({
      username: trimmedUsername,
      email: trimmedEmail,
      passwordHash,
      otp,
      otpExpires: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });

    const { sent } = await sendOtpEmail(trimmedEmail, otp);
    if (!sent) {
      return res.status(502).json({ error: 'Failed to send verification email. Please try again shortly.' });
    }

    res.status(201).json({ message: 'Verification code sent to your email.' });
  } catch (err) {
    console.error('Register start error:', err.message);
    res.status(500).json({ error: 'Failed to start registration' });
  }
});

// POST /api/auth/register/verify - the actual User account gets created HERE,
// only once the code is confirmed correct and unexpired.
router.post('/register/verify', async (req, res) => {
  try {
    const { username, otp } = req.body;
    if (!username || !otp) {
      return res.status(400).json({ error: 'username and otp are required' });
    }

    const pending = await PendingRegistration.findOne({ username: username.trim() });
    if (!pending) {
      return res.status(400).json({ error: 'No registration in progress for that username. Please register again.' });
    }
    if (pending.otpExpires < new Date()) {
      return res.status(400).json({ error: 'This code has expired. Please request a new one.' });
    }
    if (otp !== pending.otp) {
      return res.status(400).json({ error: 'Incorrect code. Please check and try again.' });
    }

    // Double-check the username/email weren't taken by someone else while
    // this registration was pending (e.g. two people racing on the same
    // username, one of them via a route other than this one).
    const existingUser = await User.findOne({ username: pending.username });
    if (existingUser) {
      await PendingRegistration.findByIdAndDelete(pending._id);
      return res.status(409).json({ error: 'username was taken while your verification was pending. Please register again with a different username.' });
    }

    const user = await User.create({
      username: pending.username,
      password: pending.passwordHash, // already bcrypt-hashed — the pre-save hook detects this and skips re-hashing
      email: pending.email,
      emailVerified: true // verified as part of registration itself, per the design
    });

    await PendingRegistration.findByIdAndDelete(pending._id);

    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register verify error:', err.message);
    res.status(500).json({ error: 'Failed to verify registration' });
  }
});

// POST /api/auth/register/resend-otp - re-sends a fresh code against an
// existing pending registration, resetting its expiry.
router.post('/register/resend-otp', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'username is required' });
    }

    const pending = await PendingRegistration.findOne({ username: username.trim() });
    if (!pending) {
      return res.status(400).json({ error: 'No registration in progress for that username. Please register again.' });
    }

    pending.otp = generateOtp();
    pending.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await pending.save();

    const { sent } = await sendOtpEmail(pending.email, pending.otp);
    if (!sent) {
      return res.status(502).json({ error: 'Failed to send verification email. Please try again shortly.' });
    }

    res.json({ message: 'A new verification code has been sent.' });
  } catch (err) {
    console.error('Resend registration OTP error:', err.message);
    res.status(500).json({ error: 'Failed to resend verification code' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check lockout BEFORE verifying the password, so a locked account gives
    // no signal either way about whether the submitted password was correct.
    if (user.isLocked()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        error: `Too many failed login attempts. Please try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.registerFailedLogin();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await user.registerSuccessfulLogin();

    const token = signToken(user);
    res.json({ token, user });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// POST /api/auth/forgot-username - email the username to a VERIFIED email on file.
// Always returns the same generic response regardless of whether the email
// matches an account, so this endpoint can't be used to check who has an
// account here.
router.post('/forgot-username', async (req, res) => {
  const genericResponse = { message: 'If that email is on file and verified, we\'ve sent the username to it.' };
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase(), emailVerified: true });
    if (user) {
      await sendUsernameEmail(user.email, user.username);
    }

    res.json(genericResponse);
  } catch (err) {
    console.error('Forgot username error:', err.message);
    res.json(genericResponse); // still generic — don't leak whether something went wrong internally
  }
});

// POST /api/auth/forgot-password - email a reset link for a VERIFIED email on file.
// Same generic-response principle as forgot-username above.
router.post('/forgot-password', async (req, res) => {
  const genericResponse = { message: 'If that email is on file and verified, we\'ve sent a reset link to it.' };
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase(), emailVerified: true });
    if (user) {
      // The raw token goes in the email link; only its hash is stored, same
      // principle as password hashing — a database leak alone can't be used
      // to reset anyone's password.
      const rawToken = crypto.randomBytes(32).toString('hex');
      user.passwordResetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      await user.save();

      const clientOrigin = process.env.CLIENT_ORIGIN || '';
      const resetUrl = `${clientOrigin}/?resetToken=${rawToken}`;
      await sendPasswordResetEmail(user.email, resetUrl);
    }

    res.json(genericResponse);
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.json(genericResponse);
  }
});

// POST /api/auth/reset-password - completes a reset started by forgot-password.
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'token and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'newPassword must be at least 6 characters' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
    }

    user.password = newPassword; // re-hashed automatically by the pre-save hook
    user.passwordResetTokenHash = null;
    user.passwordResetExpires = null;
    // A password reset is a good moment to also clear any lockout — the
    // person has just proven account ownership via email.
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    res.json({ message: 'Your password has been reset. You can now log in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
