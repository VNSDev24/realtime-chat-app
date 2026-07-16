const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Room = require('../models/Room');

// roomId -> Map<socketId, { userId, username }>
const presenceByRoom = new Map();

// userId -> Set<socketId>. Tracked independently of room presence so we can
// reach a specific user directly (e.g. "your join request was approved")
// even for a room they are NOT currently a member of / haven't joined yet.
const socketsByUser = new Map();

function getOnlineUsers(roomId) {
  const members = presenceByRoom.get(roomId);
  if (!members) return [];
  const unique = new Map();
  for (const { userId, username } of members.values()) {
    unique.set(userId, username);
  }
  return Array.from(unique, ([userId, username]) => ({ userId, username }));
}

function addPresence(roomId, socketId, user) {
  if (!presenceByRoom.has(roomId)) presenceByRoom.set(roomId, new Map());
  presenceByRoom.get(roomId).set(socketId, user);
}

function removePresence(roomId, socketId) {
  const members = presenceByRoom.get(roomId);
  if (!members) return;
  members.delete(socketId);
  if (members.size === 0) presenceByRoom.delete(roomId);
}

// Removes ALL of a user's presence entries from a room (they may have more
// than one tab/socket open). Used when forcibly evicting a blocked user.
function removePresenceForUser(roomId, userId) {
  const members = presenceByRoom.get(roomId);
  if (!members) return;
  for (const [socketId, info] of members.entries()) {
    if (info.userId === userId) members.delete(socketId);
  }
  if (members.size === 0) presenceByRoom.delete(roomId);
}

// A blocked user is rejected regardless of whether the room is restricted —
// blocking is a per-user override, not tied to the restricted-room concept.
// Beyond that, a restricted room additionally requires being the creator, an
// admin, or an approved member. Unrestricted rooms otherwise have no access
// check at all, preserving existing behavior for every room from before
// these features existed.
async function canAccessRoom(userId, roomId) {
  const room = await Room.findById(roomId).select('createdBy isRestricted members admins blockedUsers');
  if (!room) return { allowed: false, reason: 'Room not found' };

  if ((room.blockedUsers || []).some((b) => b.toString() === userId)) {
    return { allowed: false, reason: 'You have been blocked from this room by an admin', blocked: true };
  }
  if (!room.isRestricted) return { allowed: true };
  if (room.createdBy && room.createdBy.toString() === userId) return { allowed: true };
  if ((room.admins || []).some((a) => a.toString() === userId)) return { allowed: true };
  if (room.members.some((m) => m.toString() === userId)) return { allowed: true };
  return { allowed: false, reason: 'This room requires the creator\'s approval to join' };
}

function initSocket(io) {
  // Authenticate every socket connection using the JWT issued at login
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication token missing'));

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { id: payload.id, username: payload.username };
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  // Lets REST route handlers (via req.app.get('io')) push an event directly
  // to a specific user, regardless of which room(s) they currently have open.
  // Used for join-request approval/denial notifications.
  io.notifyUser = (userId, event, payload) => {
    const socketIds = socketsByUser.get(userId);
    if (!socketIds) return;
    for (const socketId of socketIds) {
      io.to(socketId).emit(event, payload);
    }
  };

  // Forcibly removes a user's live socket(s) from a room's Socket.io session
  // (not just notifying them — actually revoking their real-time presence),
  // then notifies them why. Used when an admin blocks someone who is
  // currently sitting in that room.
  io.evictUserFromRoom = (userId, roomId, event, payload) => {
    const socketIds = socketsByUser.get(userId);
    if (!socketIds) return;
    for (const socketId of socketIds) {
      const targetSocket = io.sockets.sockets.get(socketId);
      if (targetSocket) {
        targetSocket.leave(roomId);
        targetSocket.emit(event, payload);
      }
    }
    removePresenceForUser(roomId, userId);
    io.to(roomId).emit('presence_update', getOnlineUsers(roomId));
  };

  // Lets REST route handlers (via req.app.get('io')) read who is CURRENTLY
  // online in a room, without needing their own copy of the presence map.
  // Used when converting a room to restricted, to grandfather in everyone
  // currently present at the moment of the toggle.
  io.getOnlineUserIds = (roomId) => getOnlineUsers(roomId).map((u) => u.userId);

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (${socket.user.username})`);

    if (!socketsByUser.has(socket.user.id)) socketsByUser.set(socket.user.id, new Set());
    socketsByUser.get(socket.user.id).add(socket.id);

    let currentRoomId = null;

    socket.on('join_room', async ({ roomId }) => {
      if (!roomId) return;

      const access = await canAccessRoom(socket.user.id, roomId);
      if (!access.allowed) {
        socket.emit('room_access_denied', { roomId, reason: access.reason });
        return;
      }

      // Leave the previous room first (a socket is only ever in one room here)
      if (currentRoomId) {
        socket.leave(currentRoomId);
        removePresence(currentRoomId, socket.id);
        socket.to(currentRoomId).emit('user_left', { username: socket.user.username });
        io.to(currentRoomId).emit('presence_update', getOnlineUsers(currentRoomId));
      }

      currentRoomId = roomId;
      socket.join(roomId);
      addPresence(roomId, socket.id, { userId: socket.user.id, username: socket.user.username });

      socket.to(roomId).emit('user_joined', { username: socket.user.username });
      io.to(roomId).emit('presence_update', getOnlineUsers(roomId));
    });

    // Leaves the current room WITHOUT joining a different one afterward —
    // used when the user presses Escape to close the chat, rather than
    // switching directly to another room (join_room handles that case by
    // leaving the previous room as a side effect, but assumes a new room
    // follows immediately, which isn't true here).
    socket.on('leave_room', () => {
      if (!currentRoomId) return;
      socket.leave(currentRoomId);
      removePresence(currentRoomId, socket.id);
      socket.to(currentRoomId).emit('user_left', { username: socket.user.username });
      io.to(currentRoomId).emit('presence_update', getOnlineUsers(currentRoomId));
      currentRoomId = null;
    });

    socket.on('send_message', async ({ roomId, text }) => {
      try {
        if (!roomId || !text || !text.trim()) return;

        // Defense in depth: a restricted room could otherwise be written to by
        // emitting send_message directly, bypassing the join_room gate above.
        const access = await canAccessRoom(socket.user.id, roomId);
        if (!access.allowed) {
          socket.emit('room_access_denied', { roomId, reason: access.reason });
          return;
        }

        const message = await Message.create({
          room: roomId,
          sender: socket.user.id,
          senderName: socket.user.username,
          text: text.trim()
        });

        io.to(roomId).emit('receive_message', {
          _id: message._id,
          room: roomId,
          sender: socket.user.id,
          senderName: socket.user.username,
          text: message.text,
          createdAt: message.createdAt
        });
      } catch (err) {
        console.error('send_message error:', err.message);
        socket.emit('error_message', { error: 'Failed to send message' });
      }
    });

    socket.on('typing', ({ roomId, isTyping }) => {
      if (!roomId) return;
      socket.to(roomId).emit('typing', {
        username: socket.user.username,
        isTyping: Boolean(isTyping)
      });
    });

    // Relays a message deletion to everyone else currently in the room, so
    // their screens update live instead of waiting for a page refresh. The
    // actual deletion happens via the DELETE /api/messages/:messageId REST
    // route first; this event just notifies other connected clients. As a
    // safety check (so a client can't spoof a deletion for a message it
    // doesn't own), we re-verify against the database before relaying.
    socket.on('delete_message', async ({ roomId, messageId }) => {
      if (!roomId || !messageId) return;
      try {
        const message = await Message.findById(messageId);
        if (!message || !message.deleted || message.sender.toString() !== socket.user.id) {
          return; // not actually deleted, or not this user's message — ignore
        }
        io.to(roomId).emit('message_deleted', { messageId });
      } catch (err) {
        console.error('delete_message relay error:', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id} (${socket.user.username})`);

      const userSocketSet = socketsByUser.get(socket.user.id);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) socketsByUser.delete(socket.user.id);
      }

      if (currentRoomId) {
        removePresence(currentRoomId, socket.id);
        socket.to(currentRoomId).emit('user_left', { username: socket.user.username });
        io.to(currentRoomId).emit('presence_update', getOnlineUsers(currentRoomId));
      }
    });
  });
}

module.exports = { initSocket };
