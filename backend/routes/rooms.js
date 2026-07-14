const express = require('express');
const Room = require('../models/Room');
const Message = require('../models/Message');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/rooms - list all rooms, enriched with per-user membership info
// (so the frontend can show "Join" vs "Request to Join" vs a pending badge
// without a separate round trip per room).
router.get('/', requireAuth, async (req, res) => {
  try {
    const rooms = await Room.find().sort({ createdAt: 1 }).lean();

    const enriched = rooms.map((room) => {
      const isCreator = room.createdBy && room.createdBy.toString() === req.user.id;
      const isMember = !room.isRestricted
        || isCreator
        || (room.members || []).some((m) => m.toString() === req.user.id);
      const hasPendingRequest = (room.pendingRequests || []).some((p) => p.toString() === req.user.id);

      return {
        ...room,
        isCreator,
        isMember,
        hasPendingRequest,
        // Only meaningful to the creator, but just a count — not sensitive on its own.
        pendingRequestCount: isCreator ? (room.pendingRequests || []).length : 0
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error('List rooms error:', err.message);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// POST /api/rooms - create a room
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description, isRestricted } = req.body;
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
      createdBy: req.user.id,
      isRestricted: Boolean(isRestricted),
      members: [req.user.id] // creator is always an implicit member
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

// POST /api/rooms/:roomId/request-join - ask the creator for access to a restricted room
router.post('/:roomId/request-join', requireAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!room.isRestricted) {
      return res.status(400).json({ error: 'This room does not require approval to join' });
    }
    if (room.createdBy && room.createdBy.toString() === req.user.id) {
      return res.status(400).json({ error: 'You created this room' });
    }
    if (room.members.some((m) => m.toString() === req.user.id)) {
      return res.status(400).json({ error: 'You are already a member of this room' });
    }
    if (room.pendingRequests.some((p) => p.toString() === req.user.id)) {
      return res.status(409).json({ error: 'You already have a pending request for this room' });
    }

    room.pendingRequests.push(req.user.id);
    await room.save();

    // Notify the creator live, if they're currently connected — regardless of
    // which room (if any) they currently have open.
    const io = req.app.get('io');
    if (io && room.createdBy) {
      io.notifyUser(room.createdBy.toString(), 'join_request_received', {
        roomId: room._id,
        roomName: room.name,
        requesterId: req.user.id,
        requesterUsername: req.user.username
      });
    }

    res.status(201).json({ status: 'request sent' });
  } catch (err) {
    console.error('Request join error:', err.message);
    res.status(500).json({ error: 'Failed to send join request' });
  }
});

// GET /api/rooms/:roomId/requests - list pending join requests. Creator only.
router.get('/:roomId/requests', requireAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId).populate('pendingRequests', 'username');
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!room.createdBy || room.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only the room creator can view join requests' });
    }

    const requests = room.pendingRequests.map((u) => ({ userId: u._id, username: u.username }));
    res.json(requests);
  } catch (err) {
    console.error('List join requests error:', err.message);
    res.status(500).json({ error: 'Failed to fetch join requests' });
  }
});

// POST /api/rooms/:roomId/requests/:userId/approve - Creator only.
router.post('/:roomId/requests/:userId/approve', requireAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!room.createdBy || room.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only the room creator can approve join requests' });
    }

    const { userId } = req.params;
    room.pendingRequests = room.pendingRequests.filter((p) => p.toString() !== userId);
    if (!room.members.some((m) => m.toString() === userId)) {
      room.members.push(userId);
    }
    await room.save();

    const io = req.app.get('io');
    if (io) {
      io.notifyUser(userId, 'join_request_approved', { roomId: room._id, roomName: room.name });
    }

    res.json({ status: 'approved' });
  } catch (err) {
    console.error('Approve join request error:', err.message);
    res.status(500).json({ error: 'Failed to approve join request' });
  }
});

// POST /api/rooms/:roomId/requests/:userId/deny - Creator only. Not a permanent
// ban — the user is simply removed from the pending list and may ask again.
router.post('/:roomId/requests/:userId/deny', requireAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!room.createdBy || room.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only the room creator can deny join requests' });
    }

    const { userId } = req.params;
    room.pendingRequests = room.pendingRequests.filter((p) => p.toString() !== userId);
    await room.save();

    const io = req.app.get('io');
    if (io) {
      io.notifyUser(userId, 'join_request_denied', { roomId: room._id, roomName: room.name });
    }

    res.json({ status: 'denied' });
  } catch (err) {
    console.error('Deny join request error:', err.message);
    res.status(500).json({ error: 'Failed to deny join request' });
  }
});

// GET /api/rooms/:roomId/messages?limit=50&before=<ISO date>
router.get('/:roomId/messages', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;

    // Enforce the same restriction here as on the socket join — otherwise
    // someone could read a restricted room's history via the REST API
    // directly, bypassing the socket-level gate entirely.
    const room = await Room.findById(roomId).select('createdBy isRestricted members');
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (room.isRestricted) {
      const isCreator = room.createdBy && room.createdBy.toString() === req.user.id;
      const isMember = room.members.some((m) => m.toString() === req.user.id);
      if (!isCreator && !isMember) {
        return res.status(403).json({ error: 'This room requires the creator\'s approval to join' });
      }
    }

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
