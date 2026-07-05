# ChatSpace — Real-Time Chat & Collaboration App

A Slack-lite, real-time chat application built with **Node.js, Express, Socket.io, and MongoDB**. It supports multiple rooms, live presence indicators, typing indicators, and persistent message history — the same core building blocks used in enterprise collaboration tools like Webex or Slack.

Built as a portfolio project to demonstrate real-time systems design, WebSocket architecture, and full-stack development.

![Node](https://img.shields.io/badge/Node.js-18%2B-green)
![Socket.io](https://img.shields.io/badge/Socket.io-4.7-black)
![MongoDB](https://img.shields.io/badge/MongoDB-7-brightgreen)
![License](https://img.shields.io/badge/license-VNSDev24-blue)

---

## Why this project

Real-time collaboration software has to solve a few hard problems well: keeping many clients in sync with low latency, tracking who's online, and never losing a message even if a client reconnects. This project implements all three from scratch (no chat-as-a-service SDKs) to show an understanding of the underlying mechanics rather than just wiring up a third-party API.

## Features

- **JWT authentication** — register/login with hashed passwords (bcrypt)
- **Multiple chat rooms** — create rooms, switch between them instantly
- **Real-time messaging** — powered by Socket.io (WebSocket with polling fallback)
- **Message persistence** — every message is stored in MongoDB and reloaded on room join, so history survives refreshes and reconnects
- **Presence indicators** — see who is currently online in a room, updated live as users join/leave
- **Typing indicators** — see when another user is composing a message
- **Room-scoped broadcasting** — messages and presence events are scoped per room using Socket.io rooms, not broadcast globally
- **Clean, dependency-light frontend** — vanilla HTML/CSS/JS client, no build step required

## Architecture

```
┌─────────────┐        HTTP (REST)        ┌──────────────────┐
│             │ ─────────────────────────▶ │                  │
│  Frontend   │   /api/auth, /api/rooms    │  Express Server  │
│ (HTML/JS)   │                            │                  │
│             │ ◀───────────────────────── │                  │
│             │                            └────────┬─────────┘
│             │        WebSocket (Socket.io)         │
│             │ ═════════════════════════════════════┤
│             │  join_room / send_message / typing   │
└─────────────┘                                       ▼
                                              ┌──────────────────┐
                                              │     MongoDB       │
                                              │ Users/Rooms/Msgs  │
                                              └──────────────────┘
```

- **REST API** handles auth and one-off data fetches (room list, message history pagination).
- **Socket.io** handles everything that needs to be pushed live: new messages, join/leave events, presence, typing.
- **In-memory presence map** (per server instance) tracks which sockets are in which room — fast, since presence doesn't need to be durable the way messages do.

## Tech stack

| Layer      | Technology                          |
|------------|--------------------------------------|
| Backend    | Node.js, Express, Socket.io          |
| Database   | MongoDB (via Mongoose)               |
| Auth       | JWT, bcryptjs                        |
| Frontend   | HTML, CSS, vanilla JavaScript        |
| Dev tooling| Docker Compose (for local MongoDB)   |

## Project structure

```
realtime-chat-app/
├── backend/
│   ├── models/          # Mongoose schemas: User, Room, Message
│   ├── routes/          # REST endpoints: auth.js, rooms.js
│   ├── middleware/       # JWT auth middleware
│   ├── socket/          # Socket.io connection & event handler
│   ├── server.js         # App entry point
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── docker-compose.yml    # Spins up local MongoDB
├── LICENSE
└── README.md
```

## Getting started

### Prerequisites
- Node.js 18+
- MongoDB (local install, Atlas cluster, or Docker)

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/realtime-chat-app.git
cd realtime-chat-app/backend
npm install
```

### 2. Start MongoDB

Using Docker (easiest):

```bash
cd ..
docker compose up -d
```

Or point `MONGO_URI` in your `.env` at an existing local install or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.

### 3. Configure environment variables

```bash
cd backend
cp .env.example .env
```

Edit `.env` and set a strong `JWT_SECRET`. Defaults work out of the box for local development.

### 4. Run the backend

```bash
npm run dev     # with nodemon (auto-restart)
# or
npm start
```

The API and Socket.io server will start on `http://localhost:5000`.

### 5. Run the frontend

The frontend is plain static files — no build step. Simplest option:

```bash
cd ../frontend
npx serve .
```

Or just open `frontend/index.html` directly in a browser (works fine for local testing since the API allows CORS from `http://localhost:3000` by default — adjust `CLIENT_ORIGIN` in `.env` to match whatever port you serve from).

### 6. Try it out

Open two browser windows (or one normal + one incognito) side by side, register two different users, join the same room, and watch messages, presence, and typing indicators sync in real time.

## API reference

| Method | Endpoint                        | Auth | Description                        |
|--------|----------------------------------|------|-------------------------------------|
| POST   | `/api/auth/register`             | No   | Create a new user account          |
| POST   | `/api/auth/login`                | No   | Log in and receive a JWT           |
| GET    | `/api/rooms`                     | Yes  | List all chat rooms                |
| POST   | `/api/rooms`                     | Yes  | Create a new chat room             |
| GET    | `/api/rooms/:roomId/messages`    | Yes  | Fetch paginated message history    |

### Socket.io events

| Event (client → server) | Payload                          | Description                     |
|--------------------------|-----------------------------------|----------------------------------|
| `join_room`               | `{ roomId }`                      | Join a room, leave the previous one |
| `send_message`             | `{ roomId, text }`                | Send a message to a room        |
| `typing`                   | `{ roomId, isTyping }`            | Broadcast typing status         |

| Event (server → client) | Payload                          | Description                     |
|--------------------------|-----------------------------------|----------------------------------|
| `receive_message`         | Message object                    | New message broadcast            |
| `presence_update`          | `[{ userId, username }]`          | Current online users in a room   |
| `user_joined` / `user_left` | `{ username }`                  | Join/leave notifications         |
| `typing`                   | `{ username, isTyping }`          | Someone else is typing           |

## Possible extensions

These are natural next steps if extending this for a more advanced portfolio piece or a resume interview discussion:

- Horizontal scaling with the [Socket.io Redis adapter](https://socket.io/docs/v4/redis-adapter/) so presence and broadcasts work correctly across multiple server instances
- Direct/private messaging between two users, not just room-based chat
- Message read receipts and unread counts
- File/image sharing via presigned S3 uploads
- Rate limiting on `send_message` to prevent spam
- Unit tests (Jest) for REST routes and integration tests for socket events

## License

MIT — see [LICENSE](./LICENSE).
