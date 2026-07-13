// ---------- Config ----------
const API_BASE = 'http://localhost:5000/api';

// ---------- State ----------
let authMode = 'login'; // 'login' | 'register'
let token = localStorage.getItem('chat_token') || null;
let currentUser = JSON.parse(localStorage.getItem('chat_user') || 'null');
let socket = null;
let activeRoomId = null;
let activeRoomName = '';
let typingTimeout = null;

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
  socket = io('http://localhost:5000', { auth: { token } });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });

  socket.on('receive_message', (msg) => {
    if (msg.room === activeRoomId) renderMessage(msg);
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
    li.textContent = room.name;
    li.dataset.roomId = room._id;
    li.addEventListener('click', () => selectRoom(room._id, room.name));
    roomList.appendChild(li);
  });

  if (rooms.length && !activeRoomId) {
    selectRoom(rooms[0]._id, rooms[0].name);
  }
}

async function selectRoom(roomId, roomName) {
  activeRoomId = roomId;
  activeRoomName = roomName;

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

  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  wrapper.innerHTML = `
    <div class="meta">${isOwn ? 'You' : escapeHtml(msg.senderName)} · ${time}</div>
    <div class="bubble">${escapeHtml(msg.text)}</div>
  `;

  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
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
