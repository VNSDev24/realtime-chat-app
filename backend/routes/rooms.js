const express = require('express');
const Room = require('../models/Room');
const Message = require('../models/Message');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/rooms - list all rooms
router.get('/', requireAuth, async (req, res) => {
  try {
    const rooms = await Room.find().sort({ createdAt: 1 });
    res.json(rooms);
  } catch (err) {
    console.error('List rooms error:', err.message);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// POST /api/rooms - create a room
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'room name is required' });
    }

    const existing = await Room.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({ error: 'a room with this name already exists' });
    }

    const room = await Room.create({
      name: name.trim(),
      description: description || '',
      createdBy: req.user.id
    });

    res.status(201).json(room);
  } catch (err) {
    console.error('Create room error:', err.message);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// GET /api/rooms/:roomId/messages?limit=50&before=<ISO date>
router.get('/:roomId/messages', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const before = req.query.before ? new Date(req.query.before) : new Date();

    const messages = await Message.find({
      room: roomId,
      createdAt: { $lt: before }
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Return in chronological order (oldest first) for easy rendering
    res.json(messages.reverse());
  } catch (err) {
    console.error('Fetch messages error:', err.message);
    res.status(500).json({ error: 'Failed to fetch message history' });
  }
});

module.exports = router;
