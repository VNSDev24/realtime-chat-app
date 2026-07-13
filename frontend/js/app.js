// ---------- Config ----------
const API_BASE = 'https://vnsdev24-chatspace-api.onrender.com/api';

// ---------- State ----------
let authMode = 'login'; // 'login' | 'register'
let token = localStorage.getItem('chat_token') || null;
let currentUser = JSON.parse(localStorage.getItem('chat_user') || 'null');
let socket = null;
let activeRoomId = null;
let activeRoomName = '';
let typingTimeout = null;

// roomId -> unread message count, for rooms currently NOT being viewed.
const unreadCounts = new Map();

// ---------- DOM refs ----------
const authScreen = document.getElementById('auth-screen');
const chatScreen = document.getElementById('chat-screen');
const authForm = document.getElementById('auth-form');
const authSubmit = document.getElementById('auth-submit');
const authError = document.getElementById('auth-error');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');

const roomList = document.getElementById('room-list');
const newRoomBtn = document.getElementById('new-room-btn');
const roomModal = document.getElementById('room-modal');
const roomForm = document.getElementById('room-form');
const cancelRoomBtn = document.getElementById('cancel-room-btn');

const activeRoomNameEl = document.getElementById('active-room-name');
const onlineUsersEl = document.getElementById('online-users');
const messagesEl = document.getElementById('messages');
const typingIndicatorEl = document.getElementById('typing-indicator');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

const currentUsernameEl = document.getElementById('current-username');
const logoutBtn = document.getElementById('logout-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');

// ---------- Theme toggle (dark/light) ----------
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  themeToggleBtn.textContent = theme === 'light' ? '☀️' : '🌙';
  localStorage.setItem('chat_theme', theme);
}

themeToggleBtn.addEventListener('click', () => {
  const current = document.body.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  applyTheme(current === 'light' ? 'dark' : 'light');
});

// Apply saved preference immediately (defaults to the original dark theme if none saved)
applyTheme(localStorage.getItem('chat_theme') || 'dark');

// ---------- Auth tab switching ----------
tabLogin.addEventListener('click', () => setAuthMode('login'));
tabRegister.addEventListener('click', () => setAuthMode('register'));

function setAuthMode(mode) {
  authMode = mode;
  tabLogin.classList.toggle('active', mode === 'login');
  tabRegister.classList.toggle('active', mode === 'register');
  authSubmit.textContent = mode === 'login' ? 'Login' : 'Create account';
  authError.textContent = '';
}

// ---------- Auth submit ----------
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.textContent = '';

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const res = await fetch(`${API_BASE}/auth/${authMode === 'login' ? 'login' : 'register'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');

    token = data.token;
    currentUser = data.user;
    localStorage.setItem('chat_token', token);
    localStorage.setItem('chat_user', JSON.stringify(currentUser));

    enterChat();
  } catch (err) {
    authError.textContent = err.message;
  }
});

// ---------- Logout ----------
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('chat_token');
  localStorage.removeItem('chat_user');
  token = null;
  currentUser = null;
  if (socket) socket.disconnect();
  location.reload();
});

// ---------- Enter chat (after login or on page load with valid token) ----------
async function enterChat() {
  authScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  currentUsernameEl.textContent = currentUser.username;

  connectSocket();
  await loadRooms();
}

function connectSocket() {
  socket = io('https://vnsdev24-chatspace-api.onrender.com', { auth: { token } });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });

  socket.on('receive_message', (msg) => {
    if (msg.room === activeRoomId) {
      renderMessage(msg);
    } else {
      unreadCounts.set(msg.room, (unreadCounts.get(msg.room) || 0) + 1);
      updateRoomBadge(msg.room);
    }
  });

  socket.on('message_deleted', ({ messageId }) => {
    markMessageDeletedInDom(messageId);
  });

  socket.on('user_joined', ({ username }) => {
    renderSystemNote(`${username} joined the room`);
  });

  socket.on('user_left', ({ username }) => {
    renderSystemNote(`${username} left the room`);
  });

  socket.on('presence_update', (users) => {
    const names = users.map((u) => u.username).join(', ');
    onlineUsersEl.textContent = users.length ? `● Online: ${names}` : '';
  });

  socket.on('typing', ({ username, isTyping }) => {
    typingIndicatorEl.textContent = isTyping ? `${username} is typing...` : '';
  });
}

// ---------- Rooms ----------
async function loadRooms() {
  const res = await apiFetch('/rooms');
  const rooms = await res.json();
  roomList.innerHTML = '';

  rooms.forEach((room) => {
    const li = document.createElement('li');
    li.dataset.roomId = room._id;
    li.innerHTML = `<span class="room-name">${escapeHtml(room.name)}</span><span class="unread-badge hidden"></span>`;
    li.addEventListener('click', () => selectRoom(room._id, room.name));
    roomList.appendChild(li);
  });

  if (rooms.length && !activeRoomId) {
    selectRoom(rooms[0]._id, rooms[0].name);
  }
}

// Shows/hides and updates the small unread-count badge next to a room's name
// in the sidebar, based on unreadCounts. Safe to call even if the room isn't
// currently rendered in the list.
function updateRoomBadge(roomId) {
  const li = document.querySelector(`#room-list li[data-room-id="${roomId}"]`);
  if (!li) return;
  const badge = li.querySelector('.unread-badge');
  if (!badge) return;

  const count = unreadCounts.get(roomId) || 0;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.remove('hidden');
  } else {
    badge.textContent = '';
    badge.classList.add('hidden');
  }
}

async function selectRoom(roomId, roomName) {
  activeRoomId = roomId;
  activeRoomName = roomName;

  // Entering a room clears its unread badge, since its messages are now being viewed.
  unreadCounts.set(roomId, 0);
  updateRoomBadge(roomId);

  document.querySelectorAll('#room-list li').forEach((li) => {
    li.classList.toggle('active', li.dataset.roomId === roomId);
  });

  activeRoomNameEl.textContent = `# ${roomName}`;
  messageInput.disabled = false;
  sendBtn.disabled = false;
  messagesEl.innerHTML = '';
  typingIndicatorEl.textContent = '';

  socket.emit('join_room', { roomId });

  const res = await apiFetch(`/rooms/${roomId}/messages?limit=50`);
  const history = await res.json();
  history.forEach(renderMessage);
}

// ---------- New room modal ----------
newRoomBtn.addEventListener('click', () => roomModal.classList.remove('hidden'));
cancelRoomBtn.addEventListener('click', () => roomModal.classList.add('hidden'));

roomForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('room-name').value.trim();
  const description = document.getElementById('room-description').value.trim();

  try {
    const res = await apiFetch('/rooms', {
      method: 'POST',
      body: JSON.stringify({ name, description })
    });
    const room = await res.json();
    if (!res.ok) throw new Error(room.error);

    roomModal.classList.add('hidden');
    roomForm.reset();
    await loadRooms();
    selectRoom(room._id, room.name);
  } catch (err) {
    alert(err.message);
  }
});

// ---------- Messages ----------
messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !activeRoomId) return;

  socket.emit('send_message', { roomId: activeRoomId, text });
  messageInput.value = '';
  socket.emit('typing', { roomId: activeRoomId, isTyping: false });
});

messageInput.addEventListener('input', () => {
  if (!activeRoomId) return;
  socket.emit('typing', { roomId: activeRoomId, isTyping: true });

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing', { roomId: activeRoomId, isTyping: false });
  }, 1500);
});

function renderMessage(msg) {
  const isOwn = msg.senderName === currentUser.username;
  const wrapper = document.createElement('div');
  wrapper.className = `message ${isOwn ? 'own' : ''}`;
  wrapper.dataset.messageId = msg._id;

  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const relativeTime = getRelativeTime(msg.createdAt);
  const isDeleted = msg.deleted || msg.text === 'Message deleted';

  const deleteBtnHtml = (isOwn && !isDeleted)
    ? `<button class="delete-msg-btn" title="Delete this message" data-message-id="${msg._id}">🗑</button>`
    : '';

  wrapper.innerHTML = `
    <div class="meta">${isOwn ? 'You' : escapeHtml(msg.senderName)} · <span class="msg-time" data-ts="${msg.createdAt}" title="${relativeTime}">${time}</span></div>
    <div class="bubble-row">
      <div class="bubble ${isDeleted ? 'deleted' : ''}">${isDeleted ? 'Message deleted' : escapeHtml(msg.text)}</div>
      ${deleteBtnHtml}
    </div>
  `;

  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  const deleteBtn = wrapper.querySelector('.delete-msg-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => handleDeleteMessage(msg._id, msg.room || activeRoomId));
  }
}

// Calls the REST delete endpoint (server verifies ownership), then updates
// this browser's own view and notifies other connected clients via socket.
async function handleDeleteMessage(messageId, roomId) {
  if (!confirm('Delete this message? This cannot be undone.')) return;

  try {
    const res = await apiFetch(`/messages/${messageId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete message');

    markMessageDeletedInDom(messageId);
    socket.emit('delete_message', { roomId, messageId });
  } catch (err) {
    alert(err.message);
  }
}

function markMessageDeletedInDom(messageId) {
  const wrapper = document.querySelector(`.message[data-message-id="${messageId}"]`);
  if (!wrapper) return;
  const bubble = wrapper.querySelector('.bubble');
  if (bubble) {
    bubble.textContent = 'Message deleted';
    bubble.classList.add('deleted');
  }
  const btn = wrapper.querySelector('.delete-msg-btn');
  if (btn) btn.remove();
}

function renderSystemNote(text) {
  const note = document.createElement('div');
  note.className = 'meta';
  note.style.textAlign = 'center';
  note.textContent = text;
  messagesEl.appendChild(note);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Relative time (shown as a hover tooltip on each message's clock time) ----------
function getRelativeTime(isoString) {
  const then = new Date(isoString).getTime();
  const now = Date.now();
  const diffSeconds = Math.max(0, Math.round((now - then) / 1000));

  if (diffSeconds < 30) return 'Just now';
  if (diffSeconds < 60) return `${diffSeconds} seconds ago`;

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  // Beyond a week, just show the actual date rather than an increasingly vague relative string.
  return new Date(isoString).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

// Keep every visible message's hover tooltip accurate over time (e.g. "Just now"
// should become "2 minutes ago" without needing a page refresh).
setInterval(() => {
  document.querySelectorAll('.msg-time').forEach((el) => {
    const ts = el.getAttribute('data-ts');
    if (ts) el.setAttribute('title', getRelativeTime(ts));
  });
}, 30000);

// ---------- Helper: authenticated fetch ----------
function apiFetch(path, options = {}) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
}

// ---------- Boot ----------
setAuthMode('login');
if (token && currentUser) {
  enterChat();
}
