const express = require('express');
const Message = require('../models/Message');
const { requireAuth } = require('../middleware/auth');
const { parseMentions } = require('../utils/mentions');

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

// PATCH /api/messages/:messageId - edit the text of your own message.
// Re-parses @mentions from the new text, same as a fresh send would.
router.patch('/:messageId', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }
    if (text.length > 2000) {
      return res.status(400).json({ error: 'Message is too long' });
    }

    const message = await Message.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    if (message.sender.toString() !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own messages' });
    }
    if (message.deleted) {
      return res.status(400).json({ error: 'Cannot edit a deleted message' });
    }

    message.text = text.trim();
    message.edited = true;
    message.mentions = await parseMentions(message.text);
    await message.save();

    const payload = {
      _id: message._id,
      room: message.room,
      text: message.text,
      edited: true,
      mentions: message.mentions
    };

    const io = req.app.get('io');
    if (io) {
      io.to(message.room.toString()).emit('message_edited', payload);
    }

    res.json(payload);
  } catch (err) {
    console.error('Edit message error:', err.message);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// POST /api/messages/:messageId/react - toggle a reaction on a message.
// If the requester already reacted with this exact emoji, it's removed
// (un-react); otherwise it's added. Any room member can react to any message.
router.post('/:messageId/react', requireAuth, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) {
      return res.status(400).json({ error: 'emoji is required' });
    }

    const message = await Message.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    let entry = message.reactions.find((r) => r.emoji === emoji);
    if (!entry) {
      entry = { emoji, users: [] };
      message.reactions.push(entry);
    }

    const userIndex = entry.users.findIndex((u) => u.toString() === req.user.id);
    if (userIndex === -1) {
      entry.users.push(req.user.id);
    } else {
      entry.users.splice(userIndex, 1);
    }

    // Drop the whole emoji entry once nobody has it anymore, so reactions
    // don't accumulate empty entries over time.
    message.reactions = message.reactions.filter((r) => r.users.length > 0);
    await message.save();

    const payload = { _id: message._id, room: message.room, reactions: message.reactions };

    const io = req.app.get('io');
    if (io) {
      io.to(message.room.toString()).emit('message_reaction_updated', payload);
    }

    res.json(payload);
  } catch (err) {
    console.error('React to message error:', err.message);
    res.status(500).json({ error: 'Failed to update reaction' });
  }
});

module.exports = router;
