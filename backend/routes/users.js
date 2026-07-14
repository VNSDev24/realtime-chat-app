const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const { requireAuth } = require('../middleware/auth');
const { sendOtpEmail } = require('../utils/mailer');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// GET /api/users/me - fetch the current user's own profile
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('username createdAt email emailVerified pendingEmail');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('Fetch profile error:', err.message);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PATCH /api/users/me - change username
// Returns a FRESH token, since the old one has the previous username baked in.
router.patch('/me', requireAuth, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'username is required' });
    }
    const trimmed = username.trim();
    if (trimmed.length < 3 || trimmed.length > 30) {
      return res.status(400).json({ error: 'username must be between 3 and 30 characters' });
    }

    const existing = await User.findOne({ username: trimmed, _id: { $ne: req.user.id } });
    if (existing) {
      return res.status(409).json({ error: 'username already taken' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.username = trimmed;
    await user.save();

    const token = signToken(user);
    res.json({ token, user });
  } catch (err) {
    console.error('Update username error:', err.message);
    res.status(500).json({ error: 'Failed to update username' });
  }
});

// PATCH /api/users/me/password - change password (requires current password)
router.patch('/me/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'newPassword must be at least 6 characters' });
    }
    // Backup check — the frontend already verifies this, but never trust
    // client-only validation for something like a password change.
    if (confirmNewPassword !== undefined && newPassword !== confirmNewPassword) {
      return res.status(400).json({ error: 'newPassword and confirmNewPassword do not match' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.password = newPassword; // re-hashed automatically by the pre-save hook
    await user.save();

    res.json({ status: 'password updated' });
  } catch (err) {
    console.error('Update password error:', err.message);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// DELETE /api/users/me - permanently delete the account (requires password confirmation)
// Past messages are KEPT, but their displayed sender name is changed to "Deleted User"
// so existing room history/context isn't destroyed for other members.
router.delete('/me', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'password is required to confirm account deletion' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    await Message.updateMany({ sender: user._id }, { $set: { senderName: 'Deleted User' } });
    await User.findByIdAndDelete(user._id);

    res.json({ status: 'account deleted' });
  } catch (err) {
    console.error('Delete account error:', err.message);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// POST /api/users/me/email/send-otp - start (or restart) email verification.
// Stores the email as `pendingEmail` — it only becomes the account's real,
// usable `email` once the OTP is confirmed below.
router.post('/me/email/send-otp', requireAuth, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'email is required' });
    }
    const trimmed = email.trim().toLowerCase();

    // Basic sanity check — not exhaustive email validation, just enough to
    // catch obvious typos before we spend a Resend send on them.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const existing = await User.findOne({ email: trimmed, _id: { $ne: req.user.id } });
    if (existing) {
      return res.status(409).json({ error: 'That email is already in use on another account' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.pendingEmail = trimmed;
    user.emailOtp = otp;
    user.emailOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    const { sent } = await sendOtpEmail(trimmed, otp);
    if (!sent) {
      return res.status(502).json({ error: 'Failed to send verification email. Please try again shortly.' });
    }

    res.json({ status: 'otp sent' });
  } catch (err) {
    console.error('Send email OTP error:', err.message);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// POST /api/users/me/email/verify-otp - confirm the code and activate the email.
router.post('/me/email/verify-otp', requireAuth, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) {
      return res.status(400).json({ error: 'otp is required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.pendingEmail || !user.emailOtp) {
      return res.status(400).json({ error: 'No verification is currently in progress. Please request a new code.' });
    }
    if (user.emailOtpExpires < new Date()) {
      return res.status(400).json({ error: 'This code has expired. Please request a new one.' });
    }
    if (otp !== user.emailOtp) {
      return res.status(400).json({ error: 'Incorrect code. Please check and try again.' });
    }

    user.email = user.pendingEmail;
    user.emailVerified = true;
    user.pendingEmail = null;
    user.emailOtp = null;
    user.emailOtpExpires = null;
    await user.save();

    res.json({ status: 'email verified', email: user.email });
  } catch (err) {
    console.error('Verify email OTP error:', err.message);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

module.exports = router;
