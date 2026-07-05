const jwt = require('jsonwebtoken');
const Message = require('../models/Message');

// roomId -> Map<socketId, { userId, username }>
const presenceByRoom = new Map();

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

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (${socket.user.username})`);

    let currentRoomId = null;

    socket.on('join_room', async ({ roomId }) => {
      if (!roomId) return;

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

    socket.on('send_message', async ({ roomId, text }) => {
      try {
        if (!roomId || !text || !text.trim()) return;

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

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id} (${socket.user.username})`);
      if (currentRoomId) {
        removePresence(currentRoomId, socket.id);
        socket.to(currentRoomId).emit('user_left', { username: socket.user.username });
        io.to(currentRoomId).emit('presence_update', getOnlineUsers(currentRoomId));
      }
    });
  });
}

module.exports = { initSocket };
