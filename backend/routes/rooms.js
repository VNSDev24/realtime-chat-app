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

// PATCH /api/rooms/:roomId - rename a room. Only the room's original creator may do this.
router.patch('/:roomId', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'room name is required' });
    }
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 40) {
      return res.status(400).json({ error: 'room name must be between 2 and 40 characters' });
    }

    const room = await Room.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!room.createdBy || room.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only the room creator can rename this room' });
    }

    const existing = await Room.findOne({ name: trimmed, _id: { $ne: room._id } });
    if (existing) {
      return res.status(409).json({ error: 'a room with this name already exists' });
    }

    room.name = trimmed;
    await room.save();

    // Broadcast the rename live to anyone currently in this room, so their
    // sidebar/chat header update immediately rather than only on next refresh.
    const io = req.app.get('io');
    if (io) {
      io.to(room._id.toString()).emit('room_renamed', { roomId: room._id, name: room.name });
    }

    res.json(room);
  } catch (err) {
    console.error('Rename room error:', err.message);
    res.status(500).json({ error: 'Failed to rename room' });
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
