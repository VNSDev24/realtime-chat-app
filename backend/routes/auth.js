const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { sendUsernameEmail, sendPasswordResetEmail } = require('../utils/mailer');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'password must be at least 6 characters' });
    }

    const existing = await User.findOne({ username: username.trim() });
    if (existing) {
      return res.status(409).json({ error: 'username already taken' });
    }

    const user = await User.create({ username: username.trim(), password });
    const token = signToken(user);

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Failed to register user' });
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
