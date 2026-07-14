const express = require('express');
const Room = require('../models/Room');
const Message = require('../models/Message');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Always treats the room's creator as an admin, even if (due to older data
// created before the admin-roles feature existed) the admins array doesn't
// actually contain them yet. This is what should have been checked everywhere
// from the start — the admins array is the source of truth for PROMOTED
// admins, but the creator's admin status should never depend on it.
function isAdminOf(room, userId) {
  if (room.createdBy && room.createdBy.toString() === userId) return true;
  return (room.admins || []).some((a) => a.toString() === userId);
}

// GET /api/rooms - list all rooms, enriched with per-user membership info
// (so the frontend can show "Join" vs "Request to Join" vs a pending badge
// without a separate round trip per room).
router.get('/', requireAuth, async (req, res) => {
  try {
    const rooms = await Room.find().sort({ createdAt: 1 }).lean();

    const enriched = rooms.map((room) => {
      const isCreator = room.createdBy && room.createdBy.toString() === req.user.id;
      const isAdmin = isAdminOf(room, req.user.id);
      const isBlocked = (room.blockedUsers || []).some((b) => b.toString() === req.user.id);
      const isMember = !isBlocked && (
        !room.isRestricted
        || isAdmin
        || (room.members || []).some((m) => m.toString() === req.user.id)
      );
      const hasPendingRequest = (room.pendingRequests || []).some((p) => p.toString() === req.user.id);

      return {
        ...room,
        isCreator,
        isAdmin,
        isMember,
        isBlocked,
        hasPendingRequest,
        // Only meaningful to admins, but just a count — not sensitive on its own.
        pendingRequestCount: isAdmin ? (room.pendingRequests || []).length : 0
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
      admins: [req.user.id], // creator is always the first admin, and can never be removed
      isRestricted: Boolean(isRestricted),
      members: [req.user.id] // creator is always an implicit member
    });

    res.status(201).json(room);
  } catch (err) {
    console.error('Create room error:', err.message);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// PATCH /api/rooms/:roomId - rename a room. Any admin (creator or promoted) may do this.
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
    if (!isAdminOf(room, req.user.id)) {
      return res.status(403).json({ error: 'Only a room admin can rename this room' });
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

// POST /api/rooms/:roomId/admins/:userId - promote a user to admin.
// Allowed for the creator OR any existing admin.
router.post('/:roomId/admins/:userId', requireAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!isAdminOf(room, req.user.id)) {
      return res.status(403).json({ error: 'Only a room admin can promote a new admin' });
    }

    const { userId } = req.params;
    if (isAdminOf(room, userId)) {
      return res.status(400).json({ error: 'That user is already an admin' });
    }

    room.admins.push(userId);
    // Promotion implies membership for restricted rooms too, so a newly
    // promoted admin never gets locked out of the room they now help manage.
    if (!room.members.some((m) => m.toString() === userId)) {
      room.members.push(userId);
    }
    await room.save();

    const io = req.app.get('io');
    if (io) {
      io.notifyUser(userId, 'admin_granted', { roomId: room._id, roomName: room.name });
    }

    res.json({ status: 'promoted' });
  } catch (err) {
    console.error('Promote admin error:', err.message);
    res.status(500).json({ error: 'Failed to promote admin' });
  }
});

// DELETE /api/rooms/:roomId/admins/:userId - demote an admin.
// Allowed for ANY admin (not just the creator) — but the creator can never
// be targeted, by anyone, including themselves.
router.delete('/:roomId/admins/:userId', requireAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!isAdminOf(room, req.user.id)) {
      return res.status(403).json({ error: 'Only a room admin can demote another admin' });
    }

    const { userId } = req.params;
    if (room.createdBy && room.createdBy.toString() === userId) {
      return res.status(403).json({ error: 'The room creator cannot be demoted' });
    }

    room.admins = room.admins.filter((a) => a.toString() !== userId);
    await room.save();

    const io = req.app.get('io');
    if (io) {
      io.notifyUser(userId, 'admin_revoked', { roomId: room._id, roomName: room.name });
    }

    res.json({ status: 'demoted' });
  } catch (err) {
    console.error('Demote admin error:', err.message);
    res.status(500).json({ error: 'Failed to demote admin' });
  }
});

// POST /api/rooms/:roomId/block/:userId - block a user from this room.
// Allowed for any admin. Cannot target another admin or the creator — they
// would need to be demoted first, as a deliberate separate step.
router.post('/:roomId/block/:userId', requireAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!isAdminOf(room, req.user.id)) {
      return res.status(403).json({ error: 'Only a room admin can block a user' });
    }

    const { userId } = req.params;
    if (isAdminOf(room, userId)) {
      return res.status(403).json({ error: 'Admins (including the creator) cannot be blocked — demote them first' });
    }
    if (room.blockedUsers.some((b) => b.toString() === userId)) {
      return res.status(400).json({ error: 'That user is already blocked' });
    }

    room.blockedUsers.push(userId);
    // Blocking supersedes any prior membership/pending request.
    room.members = room.members.filter((m) => m.toString() !== userId);
    room.pendingRequests = room.pendingRequests.filter((p) => p.toString() !== userId);
    await room.save();

    // If they're currently sitting in this room live, actually evict them —
    // not just record the block for next time.
    const io = req.app.get('io');
    if (io) {
      io.evictUserFromRoom(userId, room._id.toString(), 'room_blocked', {
        roomId: room._id,
        roomName: room.name
      });
    }

    res.json({ status: 'blocked' });
  } catch (err) {
    console.error('Block user error:', err.message);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// DELETE /api/rooms/:roomId/block/:userId - unblock a user. Allowed for any admin.
router.delete('/:roomId/block/:userId', requireAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!isAdminOf(room, req.user.id)) {
      return res.status(403).json({ error: 'Only a room admin can unblock a user' });
    }

    const { userId } = req.params;
    room.blockedUsers = room.blockedUsers.filter((b) => b.toString() !== userId);
    await room.save();

    const io = req.app.get('io');
    if (io) {
      io.notifyUser(userId, 'room_unblocked', { roomId: room._id, roomName: room.name });
    }

    res.json({ status: 'unblocked' });
  } catch (err) {
    console.error('Unblock user error:', err.message);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// GET /api/rooms/:roomId/blocked - list currently blocked users. Admin only.
router.get('/:roomId/blocked', requireAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId).populate('blockedUsers', 'username');
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!isAdminOf(room, req.user.id)) {
      return res.status(403).json({ error: 'Only a room admin can view blocked users' });
    }

    const blocked = room.blockedUsers.map((u) => ({ userId: u._id, username: u.username }));
    res.json(blocked);
  } catch (err) {
    console.error('List blocked users error:', err.message);
    res.status(500).json({ error: 'Failed to fetch blocked users' });
  }
});

// GET /api/rooms/:roomId/candidates - users eligible to be blocked, i.e.
// anyone who has ever sent a message in this room, excluding admins and
// anyone already blocked. Admin only. This app has no formal membership
// roster for open rooms, so message history is the only real record of
// "who has actually used this room."
router.get('/:roomId/candidates', requireAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!isAdminOf(room, req.user.id)) {
      return res.status(403).json({ error: 'Only a room admin can view block candidates' });
    }

    const senderIds = await Message.distinct('sender', { room: room._id });
    const blockedSet = new Set(room.blockedUsers.map((b) => b.toString()));
    const adminSet = new Set(room.admins.map((a) => a.toString()));

    const eligibleIds = senderIds
      .map((id) => id.toString())
      .filter((id) => !blockedSet.has(id) && !adminSet.has(id));

    const users = await User.find({ _id: { $in: eligibleIds } }).select('username');
    res.json(users.map((u) => ({ userId: u._id, username: u.username })));
  } catch (err) {
    console.error('List block candidates error:', err.message);
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

// DELETE /api/rooms/:roomId - permanently delete a room AND all of its
// messages. Allowed for any admin (creator or promoted). Irreversible —
// the frontend is expected to confirm this explicitly before calling it.
router.delete('/:roomId', requireAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!isAdminOf(room, req.user.id)) {
      return res.status(403).json({ error: 'Only a room admin can delete this room' });
    }

    await Message.deleteMany({ room: room._id });
    await Room.findByIdAndDelete(room._id);

    // Notify anyone currently viewing this room so their screen doesn't just
    // silently break — kicks them back to the room list with a clear reason.
    const io = req.app.get('io');
    if (io) {
      io.to(room._id.toString()).emit('room_deleted', { roomId: room._id, roomName: room.name });
    }

    res.json({ status: 'deleted' });
  } catch (err) {
    console.error('Delete room error:', err.message);
    res.status(500).json({ error: 'Failed to delete room' });
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

// GET /api/rooms/:roomId/requests - list pending join requests. Any admin may view.
router.get('/:roomId/requests', requireAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId).populate('pendingRequests', 'username');
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!isAdminOf(room, req.user.id)) {
      return res.status(403).json({ error: 'Only a room admin can view join requests' });
    }

    const requests = room.pendingRequests.map((u) => ({ userId: u._id, username: u.username }));
    res.json(requests);
  } catch (err) {
    console.error('List join requests error:', err.message);
    res.status(500).json({ error: 'Failed to fetch join requests' });
  }
});

// POST /api/rooms/:roomId/requests/:userId/approve - Any admin may approve.
router.post('/:roomId/requests/:userId/approve', requireAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!isAdminOf(room, req.user.id)) {
      return res.status(403).json({ error: 'Only a room admin can approve join requests' });
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

// POST /api/rooms/:roomId/requests/:userId/deny - Any admin may deny. Not a
// permanent ban — the user is simply removed from the pending list and may ask again.
router.post('/:roomId/requests/:userId/deny', requireAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!isAdminOf(room, req.user.id)) {
      return res.status(403).json({ error: 'Only a room admin can deny join requests' });
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
    const room = await Room.findById(roomId).select('createdBy isRestricted members admins blockedUsers');
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if ((room.blockedUsers || []).some((b) => b.toString() === req.user.id)) {
      return res.status(403).json({ error: 'You have been blocked from this room by an admin' });
    }
    if (room.isRestricted) {
      const isMember = room.members.some((m) => m.toString() === req.user.id);
      if (!isAdminOf(room, req.user.id) && !isMember) {
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
