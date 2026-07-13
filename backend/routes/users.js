const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const { requireAuth } = require('../middleware/auth');

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
    const user = await User.findById(req.user.id).select('username createdAt');
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
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'newPassword must be at least 6 characters' });
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

module.exports = router;
