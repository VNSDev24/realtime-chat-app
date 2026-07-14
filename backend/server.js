require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const { initSocket } = require('./socket/socketHandler');
const { authLimiter, generalApiLimiter } = require('./middleware/rateLimiter');
const { backfillRoomAdmins } = require('./migrations/backfillRoomAdmins');

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/realtime_chat';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

const app = express();

// Render (like most PaaS platforms) sits behind a reverse proxy. Without this,
// req.ip would return the proxy's internal IP for every request, making the
// rate limiters below treat all traffic as a single client — which would
// lock everyone out together instead of limiting individual abusive clients.
app.set('trust proxy', 1);

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Strict limiter on auth endpoints specifically — this is where brute-forcing
// a password or spamming account creation actually matters.
app.use('/api/auth', authLimiter, authRoutes);

// Moderate limiter for everything else. Deliberately generous — see
// middleware/rateLimiter.js for the reasoning — so normal usage (sending
// messages, switching rooms, checking your profile) is never throttled.
app.use('/api/rooms', generalApiLimiter, roomRoutes);
app.use('/api/messages', generalApiLimiter, messageRoutes);
app.use('/api/users', generalApiLimiter, userRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] }
});
app.set('io', io); // lets REST route handlers broadcast live socket events (e.g. room renames)

initSocket(io);

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // One-time (per-restart) data fix — see migrations/backfillRoomAdmins.js
    // for why this is needed and why it's safe to run unconditionally.
    await backfillRoomAdmins();

    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
