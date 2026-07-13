const express = require('express');
const Message = require('../models/Message');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// DELETE /api/messages/:messageId - soft-delete a message.
// Only the original sender may delete their own message. The message row is
// kept (not removed from the database) but its text is replaced with a
// placeholder, matching a typical "soft delete" chat UX (e.g. WhatsApp).
router.delete('/:messageId', requireAuth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    if (message.sender.toString() !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    message.text = 'Message deleted';
    message.deleted = true;
    await message.save();

    res.json({ _id: message._id, room: message.room, text: message.text, deleted: true });
  } catch (err) {
    console.error('Delete message error:', err.message);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

module.exports = router;
