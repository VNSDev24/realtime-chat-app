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

const forgotLinks = document.getElementById('forgot-links');
const forgotUsernameLink = document.getElementById('forgot-username-link');
const forgotPasswordLink = document.getElementById('forgot-password-link');
const forgotUsernameForm = document.getElementById('forgot-username-form');
const forgotUsernameEmail = document.getElementById('forgot-username-email');
const forgotUsernameMsg = document.getElementById('forgot-username-msg');
const forgotPasswordForm = document.getElementById('forgot-password-form');
const forgotPasswordEmail = document.getElementById('forgot-password-email');
const forgotPasswordMsg = document.getElementById('forgot-password-msg');
const backToLoginLinks = document.querySelectorAll('.back-to-login-link');

const resetPasswordScreen = document.getElementById('reset-password-screen');
const resetPasswordForm = document.getElementById('reset-password-form');
const resetNewPassword = document.getElementById('reset-new-password');
const resetConfirmPassword = document.getElementById('reset-confirm-password');
const resetPasswordMsg = document.getElementById('reset-password-msg');
const resetBackToLoginLink = document.getElementById('reset-back-to-login-link');

const emailForm = document.getElementById('email-form');
const emailInput = document.getElementById('email-input');
const emailOtpForm = document.getElementById('email-otp-form');
const emailOtpInput = document.getElementById('email-otp-input');
const emailStatus = document.getElementById('email-status');
const emailFormMsg = document.getElementById('email-form-msg');

const roomList = document.getElementById('room-list');
const newRoomBtn = document.getElementById('new-room-btn');
const roomModal = document.getElementById('room-modal');
const roomForm = document.getElementById('room-form');
const cancelRoomBtn = document.getElementById('cancel-room-btn');
const roomRestrictedCheckbox = document.getElementById('room-restricted-checkbox');

const requestsModal = document.getElementById('requests-modal');
const requestsModalTitle = document.getElementById('requests-modal-title');
const requestsList = document.getElementById('requests-list');
const requestsEmptyMsg = document.getElementById('requests-empty-msg');
const closeRequestsBtn = document.getElementById('close-requests-btn');

const blockedUsersModal = document.getElementById('blocked-users-modal');
const blockedUsersModalTitle = document.getElementById('blocked-users-modal-title');
const blockedUsersList = document.getElementById('blocked-users-list');
const blockedUsersEmptyMsg = document.getElementById('blocked-users-empty-msg');
const blockCandidatesList = document.getElementById('block-candidates-list');
const blockCandidatesEmptyMsg = document.getElementById('block-candidates-empty-msg');
const closeBlockedUsersBtn = document.getElementById('close-blocked-users-btn');

const activeRoomNameEl = document.getElementById('active-room-name');
const onlineUsersToggle = document.getElementById('online-users-toggle');
const onlineUsersDropdown = document.getElementById('online-users-dropdown');
const onlineUsersList = document.getElementById('online-users-list');
const deleteRoomBtn = document.getElementById('delete-room-btn');
const blockedUsersBtn = document.getElementById('blocked-users-btn');
const messagesEl = document.getElementById('messages');
const typingIndicatorEl = document.getElementById('typing-indicator');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

const currentUsernameEl = document.getElementById('current-username');
const logoutBtn = document.getElementById('logout-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');

// Profile screen refs
const profileScreen = document.getElementById('profile-screen');
const backToChatBtn = document.getElementById('back-to-chat-btn');
const usernameForm = document.getElementById('username-form');
const newUsernameInput = document.getElementById('new-username-input');
const usernameFormMsg = document.getElementById('username-form-msg');
const passwordForm = document.getElementById('password-form');
const currentPasswordInput = document.getElementById('current-password-input');
const newPasswordInput = document.getElementById('new-password-input');
const confirmNewPasswordInput = document.getElementById('confirm-new-password-input');
const passwordFormMsg = document.getElementById('password-form-msg');
const deleteAccountForm = document.getElementById('delete-account-form');
const deletePasswordInput = document.getElementById('delete-password-input');
const deleteFormMsg = document.getElementById('delete-form-msg');

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

// ---------- Forgot Username / Forgot Password (login screen) ----------
function showAuthDefaultView() {
  authForm.classList.remove('hidden');
  document.querySelector('.tabs').classList.remove('hidden');
  forgotLinks.classList.remove('hidden');
  forgotUsernameForm.classList.add('hidden');
  forgotPasswordForm.classList.add('hidden');
  forgotUsernameMsg.textContent = '';
  forgotPasswordMsg.textContent = '';
}

forgotUsernameLink.addEventListener('click', (e) => {
  e.preventDefault();
  authForm.classList.add('hidden');
  document.querySelector('.tabs').classList.add('hidden');
  forgotLinks.classList.add('hidden');
  forgotUsernameForm.classList.remove('hidden');
});

forgotPasswordLink.addEventListener('click', (e) => {
  e.preventDefault();
  authForm.classList.add('hidden');
  document.querySelector('.tabs').classList.add('hidden');
  forgotLinks.classList.add('hidden');
  forgotPasswordForm.classList.remove('hidden');
});

backToLoginLinks.forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    showAuthDefaultView();
  });
});

forgotUsernameForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  forgotUsernameMsg.textContent = '';
  const email = forgotUsernameEmail.value.trim();

  try {
    const res = await fetch(`${API_BASE}/auth/forgot-username`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    forgotUsernameMsg.textContent = data.message;
    forgotUsernameMsg.classList.add('success-text');
  } catch (err) {
    forgotUsernameMsg.textContent = err.message;
    forgotUsernameMsg.classList.remove('success-text');
  }
});

forgotPasswordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  forgotPasswordMsg.textContent = '';
  const email = forgotPasswordEmail.value.trim();

  try {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    forgotPasswordMsg.textContent = data.message;
    forgotPasswordMsg.classList.add('success-text');
  } catch (err) {
    forgotPasswordMsg.textContent = err.message;
    forgotPasswordMsg.classList.remove('success-text');
  }
});

// ---------- Reset Password screen (reached via emailed link with ?resetToken=) ----------
const urlParams = new URLSearchParams(window.location.search);
const resetTokenFromUrl = urlParams.get('resetToken');

if (resetTokenFromUrl) {
  authScreen.classList.add('hidden');
  resetPasswordScreen.classList.remove('hidden');
}

resetPasswordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  resetPasswordMsg.textContent = '';

  const newPassword = resetNewPassword.value;
  const confirmPassword = resetConfirmPassword.value;
  if (newPassword !== confirmPassword) {
    resetPasswordMsg.textContent = 'Passwords do not match.';
    resetPasswordMsg.classList.remove('success-text');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetTokenFromUrl, newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');

    resetPasswordMsg.textContent = data.message;
    resetPasswordMsg.classList.add('success-text');
    resetPasswordForm.classList.add('hidden');
  } catch (err) {
    resetPasswordMsg.textContent = err.message;
    resetPasswordMsg.classList.remove('success-text');
  }
});

resetBackToLoginLink.addEventListener('click', (e) => {
  e.preventDefault();
  // Strip the token from the URL so a page refresh doesn't re-show this screen.
  window.history.replaceState({}, document.title, window.location.pathname);
  resetPasswordScreen.classList.add('hidden');
  authScreen.classList.remove('hidden');
  showAuthDefaultView();
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

// ---------- Profile screen ----------
currentUsernameEl.addEventListener('click', openProfileScreen);
backToChatBtn.addEventListener('click', closeProfileScreen);

function openProfileScreen() {
  chatScreen.classList.add('hidden');
  profileScreen.classList.remove('hidden');

  newUsernameInput.value = currentUser.username;
  currentPasswordInput.value = '';
  newPasswordInput.value = '';
  confirmNewPasswordInput.value = '';
  deletePasswordInput.value = '';
  usernameFormMsg.textContent = '';
  passwordFormMsg.textContent = '';
  deleteFormMsg.textContent = '';

  loadEmailStatus();
}

async function loadEmailStatus() {
  emailFormMsg.textContent = '';
  emailOtpInput.value = '';

  try {
    const res = await apiFetch('/users/me');
    const profile = await res.json();
    if (!res.ok) throw new Error(profile.error || 'Failed to load profile');

    if (profile.emailVerified && profile.email) {
      emailStatus.textContent = `✅ Verified: ${profile.email}`;
      emailStatus.className = 'email-status verified';
      emailForm.classList.remove('hidden');
      emailOtpForm.classList.add('hidden');
      emailInput.value = profile.email;
    } else if (profile.pendingEmail) {
      emailStatus.textContent = `⏳ Awaiting verification: ${profile.pendingEmail}`;
      emailStatus.className = 'email-status pending';
      emailForm.classList.add('hidden');
      emailOtpForm.classList.remove('hidden');
    } else {
      emailStatus.textContent = 'No email on file yet — add one to enable account recovery.';
      emailStatus.className = 'email-status';
      emailForm.classList.remove('hidden');
      emailOtpForm.classList.add('hidden');
      emailInput.value = '';
    }
  } catch (err) {
    emailStatus.textContent = '';
    emailFormMsg.textContent = err.message;
  }
}

emailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  emailFormMsg.textContent = '';
  const email = emailInput.value.trim();

  try {
    const res = await apiFetch('/users/me/email/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send verification code');

    emailFormMsg.textContent = 'Verification code sent — check your inbox.';
    emailFormMsg.classList.add('success-text');
    emailForm.classList.add('hidden');
    emailOtpForm.classList.remove('hidden');
  } catch (err) {
    emailFormMsg.textContent = err.message;
    emailFormMsg.classList.remove('success-text');
  }
});

emailOtpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  emailFormMsg.textContent = '';
  const otp = emailOtpInput.value.trim();

  try {
    const res = await apiFetch('/users/me/email/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ otp })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to verify code');

    emailFormMsg.textContent = 'Email verified successfully!';
    emailFormMsg.classList.add('success-text');
    await loadEmailStatus();
  } catch (err) {
    emailFormMsg.textContent = err.message;
    emailFormMsg.classList.remove('success-text');
  }
});

function closeProfileScreen() {
  profileScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
}

usernameForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  usernameFormMsg.textContent = '';
  const newUsername = newUsernameInput.value.trim();

  try {
    const res = await apiFetch('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ username: newUsername })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update username');

    // The old token has the previous username baked in — swap in the fresh one.
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('chat_token', token);
    localStorage.setItem('chat_user', JSON.stringify(currentUser));
    currentUsernameEl.textContent = currentUser.username;

    // Reconnect the socket so other online users see the new name immediately,
    // rather than only after this browser's next refresh.
    if (socket) socket.disconnect();
    connectSocket();
    if (activeRoomId) socket.emit('join_room', { roomId: activeRoomId });

    usernameFormMsg.textContent = 'Username updated successfully.';
    usernameFormMsg.classList.remove('error-text');
    usernameFormMsg.classList.add('success-text');
  } catch (err) {
    usernameFormMsg.textContent = err.message;
    usernameFormMsg.classList.remove('success-text');
    usernameFormMsg.classList.add('error-text');
  }
});

passwordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  passwordFormMsg.textContent = '';
  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmNewPassword = confirmNewPasswordInput.value;

  if (newPassword !== confirmNewPassword) {
    passwordFormMsg.textContent = 'New password and confirmation do not match.';
    passwordFormMsg.classList.remove('success-text');
    passwordFormMsg.classList.add('error-text');
    return;
  }

  try {
    const res = await apiFetch('/users/me/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update password');

    currentPasswordInput.value = '';
    newPasswordInput.value = '';
    confirmNewPasswordInput.value = '';
    passwordFormMsg.textContent = 'Password updated successfully.';
    passwordFormMsg.classList.remove('error-text');
    passwordFormMsg.classList.add('success-text');
  } catch (err) {
    passwordFormMsg.textContent = err.message;
    passwordFormMsg.classList.remove('success-text');
    passwordFormMsg.classList.add('error-text');
  }
});

deleteAccountForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  deleteFormMsg.textContent = '';
  const password = deletePasswordInput.value;

  const confirmed = confirm(
    'This will permanently delete your account. Your past messages will remain visible to others as "Deleted User". This cannot be undone. Continue?'
  );
  if (!confirmed) return;

  try {
    const res = await apiFetch('/users/me', {
      method: 'DELETE',
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete account');

    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    if (socket) socket.disconnect();
    location.reload();
  } catch (err) {
    deleteFormMsg.textContent = err.message;
    deleteFormMsg.classList.add('error-text');
  }
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

  // Someone (possibly another browser tab, or the actual room creator) renamed
  // a room we're currently in — update the sidebar entry and header live.
  socket.on('room_renamed', ({ roomId, name }) => {
    const li = document.querySelector(`#room-list li[data-room-id="${roomId}"]`);
    if (li) {
      const nameSpan = li.querySelector('.room-name');
      if (nameSpan) nameSpan.textContent = name;
    }
    if (roomId === activeRoomId) {
      activeRoomName = name;
      activeRoomNameEl.textContent = `# ${name}`;
      activeRoomNameEl.title = name;
    }
  });

  socket.on('user_joined', ({ username }) => {
    renderSystemNote(`${username} joined the room`);
  });

  // Someone requested to join one of our restricted rooms — refresh the
  // sidebar so the pending-requests badge appears/updates immediately.
  socket.on('join_request_received', ({ roomName, requesterUsername }) => {
    renderSystemNote(`${requesterUsername} requested to join "${roomName}"`);
    loadRooms();
  });

  // We were approved for a room we'd requested to join — refresh so it now
  // shows as joinable instead of "Request Sent".
  socket.on('join_request_approved', ({ roomName }) => {
    alert(`Your request to join "${roomName}" was approved!`);
    loadRooms();
  });

  // We were denied — refresh so the button reverts to "Request to Join"
  // (this is not a permanent block; the user is free to ask again).
  socket.on('join_request_denied', ({ roomName }) => {
    alert(`Your request to join "${roomName}" was denied.`);
    loadRooms();
  });

  // Safety-net: the server rejected a join/send attempt at the socket level
  // (e.g. a stale client tried to act on a room it was removed from).
  socket.on('room_access_denied', ({ reason }) => {
    alert(reason || 'You do not have access to this room.');
  });

  // We were just promoted to admin in some room — refresh so the rename
  // icon, delete-room button, and requests badge become visible for us.
  socket.on('admin_granted', ({ roomName }) => {
    alert(`You are now an admin of "${roomName}". You can rename it, delete it, and approve join requests.`);
    loadRooms();
  });

  // We were demoted (by another admin) — refresh so those controls disappear.
  socket.on('admin_revoked', ({ roomName }) => {
    alert(`Your admin status for "${roomName}" was revoked.`);
    loadRooms();
  });

  // An admin deleted a room we're currently sitting in — don't let the UI
  // just silently break; bounce back to the room list with a clear reason.
  socket.on('room_deleted', ({ roomId, roomName }) => {
    if (roomId === activeRoomId) {
      activeRoomId = null;
      messagesEl.innerHTML = '';
      activeRoomNameEl.textContent = 'Select a room';
      resetPresenceDropdown();
      deleteRoomBtn.classList.add('hidden');
      blockedUsersBtn.classList.add('hidden');
      alert(`This room ("${roomName}") was deleted by an admin.`);
    }
    loadRooms();
  });

  // An admin blocked us from a room we're currently sitting in — the server
  // has already forcibly removed our socket from it; update our own UI to match.
  socket.on('room_blocked', ({ roomId, roomName }) => {
    if (roomId === activeRoomId) {
      activeRoomId = null;
      messagesEl.innerHTML = '';
      activeRoomNameEl.textContent = 'Select a room';
      resetPresenceDropdown();
      deleteRoomBtn.classList.add('hidden');
      blockedUsersBtn.classList.add('hidden');
      alert(`You have been blocked from "${roomName}" by an admin.`);
    }
    loadRooms();
  });

  // We were unblocked — refresh so the room shows as accessible again
  // instead of the "🚫 Admin blocked you" label.
  socket.on('room_unblocked', ({ roomName }) => {
    alert(`You have been unblocked from "${roomName}".`);
    loadRooms();
  });

  socket.on('user_left', ({ username }) => {
    renderSystemNote(`${username} left the room`);
  });

  socket.on('presence_update', (users) => {
    lastPresenceUsers = users;
    renderPresenceList(users);
  });

  socket.on('typing', ({ username, isTyping }) => {
    typingIndicatorEl.textContent = isTyping ? `${username} is typing...` : '';
  });
}

// ---------- Rooms ----------
// Cache of the last-loaded room list, keyed by ID, so other handlers (socket
// events, click handlers) can look up a room's restriction/membership state
// without a separate round trip.
let roomsById = {};

async function loadRooms() {
  const res = await apiFetch('/rooms');
  const rooms = await res.json();
  roomList.innerHTML = '';
  roomsById = {};

  rooms.forEach((room) => {
    roomsById[room._id] = room;

    const li = document.createElement('li');
    li.dataset.roomId = room._id;

    const lockIcon = room.isRestricted ? '🔒 ' : '';
    const renameBtnHtml = room.isCreator
      ? `<button class="rename-room-btn" title="Rename room" data-room-id="${room._id}">✏️</button>`
      : '';
    const requestsBadgeHtml = (room.isCreator && room.pendingRequestCount > 0)
      ? `<button class="requests-badge" title="View join requests" data-room-id="${room._id}">🔔 ${room.pendingRequestCount}</button>`
      : '';

    if (room.isBlocked) {
      // Blocked users can't request access either — just show the label.
      li.classList.add('restricted-not-member');
      li.innerHTML = `
        <span class="room-name" title="${escapeHtml(room.name)}">${escapeHtml(room.name)}</span>
        <span class="blocked-label">🚫 Admin blocked you</span>
      `;
    } else if (room.isRestricted && !room.isMember) {
      // Not a member of a restricted room — show a request button instead of
      // letting them click straight into the chat.
      const requestBtnHtml = room.hasPendingRequest
        ? `<button class="request-join-btn" disabled>Request Sent</button>`
        : `<button class="request-join-btn" data-room-id="${room._id}">Request to Join</button>`;

      li.classList.add('restricted-not-member');
      li.innerHTML = `
        <span class="room-name" title="${escapeHtml(room.name)}">${lockIcon}${escapeHtml(room.name)}</span>
        ${requestBtnHtml}
      `;

      const requestBtn = li.querySelector('.request-join-btn:not([disabled])');
      if (requestBtn) {
        requestBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleRequestJoin(room._id);
        });
      }
    } else {
      li.innerHTML = `
        <span class="room-name" title="${escapeHtml(room.name)}">${lockIcon}${escapeHtml(room.name)}</span>
        <span class="unread-badge hidden"></span>
        ${requestsBadgeHtml}
        ${renameBtnHtml}
      `;
      li.addEventListener('click', () => selectRoom(room._id, room.name));

      const renameBtn = li.querySelector('.rename-room-btn');
      if (renameBtn) {
        renameBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          startRenameRoom(li, room._id, room.name);
        });
      }

      const requestsBadge = li.querySelector('.requests-badge');
      if (requestsBadge) {
        requestsBadge.addEventListener('click', (e) => {
          e.stopPropagation();
          openRequestsModal(room._id, room.name);
        });
      }
    }

    roomList.appendChild(li);
  });

  const firstJoinableRoom = rooms.find((r) => r.isMember);
  if (firstJoinableRoom && !activeRoomId) {
    selectRoom(firstJoinableRoom._id, firstJoinableRoom.name);
  }

  // Keep the Delete Room / Blocked Users buttons in sync even if admin status
  // changed for the CURRENTLY active room without switching rooms (e.g. just got promoted).
  if (activeRoomId && roomsById[activeRoomId]) {
    const isAdmin = roomsById[activeRoomId].isAdmin;
    deleteRoomBtn.classList.toggle('hidden', !isAdmin);
    blockedUsersBtn.classList.toggle('hidden', !isAdmin);
  }
}

async function handleRequestJoin(roomId) {
  try {
    const res = await apiFetch(`/rooms/${roomId}/request-join`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send join request');
    await loadRooms(); // refresh so this room now shows "Request Sent"
  } catch (err) {
    alert(err.message);
  }
}

// Cache of the last presence_update payload, so we can re-render the dropdown
// immediately after an admin promotion/demotion (which changes role tags and
// button visibility) without waiting for the next actual join/leave event.
let lastPresenceUsers = [];

onlineUsersToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  onlineUsersDropdown.classList.toggle('hidden');
});

// Close the dropdown when clicking anywhere else on the page.
document.addEventListener('click', (e) => {
  if (!onlineUsersDropdown.contains(e.target) && e.target !== onlineUsersToggle) {
    onlineUsersDropdown.classList.add('hidden');
  }
});

function resetPresenceDropdown() {
  lastPresenceUsers = [];
  onlineUsersToggle.textContent = '● 0 Online ▾';
  onlineUsersList.innerHTML = '';
  onlineUsersDropdown.classList.add('hidden');
}

// Renders the "N Online" dropdown: every online user's name, their role tag
// (Creator / Admin / nothing), and — only for an admin viewer, and never on
// their own row — a "Make Admin" or "Remove Admin Rights" action button.
function renderPresenceList(users) {
  onlineUsersToggle.textContent = `● ${users.length} Online ▾`;
  onlineUsersList.innerHTML = '';
  if (!users.length) return;

  const activeRoom = roomsById[activeRoomId];
  const viewerIsAdmin = Boolean(activeRoom && activeRoom.isAdmin);
  const roomAdmins = (activeRoom && activeRoom.admins) || [];
  const creatorId = activeRoom && activeRoom.createdBy;

  users.forEach((u) => {
    const isCreator = u.userId === creatorId;
    const isAdmin = roomAdmins.some((a) => a === u.userId);
    const isSelf = u.userId === currentUser._id;

    let roleTagHtml = '';
    if (isCreator) roleTagHtml = '<span class="role-tag role-tag-creator">Creator</span>';
    else if (isAdmin) roleTagHtml = '<span class="role-tag role-tag-admin">Admin</span>';

    let actionBtnHtml = '';
    if (viewerIsAdmin && !isSelf && !isCreator) {
      if (isAdmin) {
        actionBtnHtml = `<button class="admin-action-btn remove-admin-btn" data-user-id="${u.userId}">Remove Admin Rights</button>`;
      } else {
        // Regular (non-admin) online user — an admin can either promote them
        // or block them, but blocking an admin isn't allowed (demote first).
        actionBtnHtml = `
          <button class="admin-action-btn make-admin-btn-row" data-user-id="${u.userId}">Make Admin</button>
          <button class="admin-action-btn block-user-btn" data-user-id="${u.userId}">Block</button>
        `;
      }
    }

    const li = document.createElement('li');
    li.className = 'online-user-row';
    li.innerHTML = `
      <span class="online-user-info">${getInitialsAvatar(u.username)}${escapeHtml(u.username)}${roleTagHtml}</span>
      <span class="online-user-actions">${actionBtnHtml}</span>
    `;

    const makeBtn = li.querySelector('.make-admin-btn-row');
    if (makeBtn) makeBtn.addEventListener('click', () => handlePromoteAdmin(activeRoomId, u.userId, u.username));

    const removeBtn = li.querySelector('.remove-admin-btn');
    if (removeBtn) removeBtn.addEventListener('click', () => handleDemoteAdmin(activeRoomId, u.userId, u.username));

    const blockBtn = li.querySelector('.block-user-btn');
    if (blockBtn) blockBtn.addEventListener('click', () => handleBlockUser(activeRoomId, u.userId, u.username));

    onlineUsersList.appendChild(li);
  });
}

async function handlePromoteAdmin(roomId, userId, username) {
  const confirmed = confirm(`Make ${username} an admin of this room? Admins can rename the room, delete it, and approve/deny join requests.`);
  if (!confirmed) return;

  try {
    const res = await apiFetch(`/rooms/${roomId}/admins/${userId}`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to promote admin');
    await loadRooms(); // refreshes roomsById with the new admins list
    renderPresenceList(lastPresenceUsers); // re-render immediately — dropdown stays open
  } catch (err) {
    alert(err.message);
  }
}

async function handleDemoteAdmin(roomId, userId, username) {
  const confirmed = confirm(`Remove admin rights from ${username}? They will no longer be able to rename this room, delete it, or approve/deny join requests.`);
  if (!confirmed) return;

  try {
    const res = await apiFetch(`/rooms/${roomId}/admins/${userId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to remove admin rights');
    await loadRooms();
    renderPresenceList(lastPresenceUsers); // re-render immediately — dropdown stays open
  } catch (err) {
    alert(err.message);
  }
}

// ---------- Block / unblock users (any admin) ----------
async function handleBlockUser(roomId, userId, username) {
  const confirmed = confirm(`Block ${username} from this room? They will be immediately removed if currently inside, and won't be able to rejoin until an admin unblocks them.`);
  if (!confirmed) return;

  try {
    const res = await apiFetch(`/rooms/${roomId}/block/${userId}`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to block user');
    await loadRooms();
    renderPresenceList(lastPresenceUsers); // the blocked user disappears from presence shortly after eviction
  } catch (err) {
    alert(err.message);
  }
}

async function handleUnblockUser(roomId, userId) {
  try {
    const res = await apiFetch(`/rooms/${roomId}/block/${userId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to unblock user');
    await openBlockedUsersModal(roomId, activeRoomName); // refresh both lists in the open modal
  } catch (err) {
    alert(err.message);
  }
}

async function openBlockedUsersModal(roomId, roomName) {
  blockedUsersModalTitle.textContent = `Blocked Users — ${roomName}`;
  blockedUsersModal.classList.remove('hidden');

  blockedUsersList.innerHTML = '';
  blockCandidatesList.innerHTML = '';
  blockedUsersEmptyMsg.classList.add('hidden');
  blockCandidatesEmptyMsg.classList.add('hidden');

  try {
    const [blockedRes, candidatesRes] = await Promise.all([
      apiFetch(`/rooms/${roomId}/blocked`),
      apiFetch(`/rooms/${roomId}/candidates`)
    ]);
    const blocked = await blockedRes.json();
    const candidates = await candidatesRes.json();
    if (!blockedRes.ok) throw new Error(blocked.error || 'Failed to load blocked users');
    if (!candidatesRes.ok) throw new Error(candidates.error || 'Failed to load candidates');

    if (blocked.length === 0) {
      blockedUsersEmptyMsg.classList.remove('hidden');
    } else {
      blocked.forEach((u) => {
        const li = document.createElement('li');
        li.className = 'request-item';
        li.innerHTML = `
          <span>${getInitialsAvatar(u.username)}${escapeHtml(u.username)}</span>
          <button class="approve-btn">Unblock</button>
        `;
        li.querySelector('button').addEventListener('click', () => handleUnblockUser(roomId, u.userId));
        blockedUsersList.appendChild(li);
      });
    }

    if (candidates.length === 0) {
      blockCandidatesEmptyMsg.classList.remove('hidden');
    } else {
      candidates.forEach((u) => {
        const li = document.createElement('li');
        li.className = 'request-item';
        li.innerHTML = `
          <span>${getInitialsAvatar(u.username)}${escapeHtml(u.username)}</span>
          <button class="deny-btn">Block</button>
        `;
        li.querySelector('button').addEventListener('click', () => handleBlockUser(roomId, u.userId, u.username));
        blockCandidatesList.appendChild(li);
      });
    }
  } catch (err) {
    blockedUsersList.innerHTML = `<li>${escapeHtml(err.message)}</li>`;
  }
}

blockedUsersBtn.addEventListener('click', () => {
  if (!activeRoomId) return;
  openBlockedUsersModal(activeRoomId, activeRoomName);
});
closeBlockedUsersBtn.addEventListener('click', () => blockedUsersModal.classList.add('hidden'));

// ---------- Delete room (any admin) ----------
async function handleDeleteRoom(roomId, roomName) {
  const confirmed = confirm(
    `Permanently delete "${roomName}"? ALL messages and data in this room will be lost for everyone. This cannot be undone.`
  );
  if (!confirmed) return;

  try {
    const res = await apiFetch(`/rooms/${roomId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete room');

    if (roomId === activeRoomId) {
      activeRoomId = null;
    }
    await loadRooms();
  } catch (err) {
    alert(err.message);
  }
}

// Swaps a room's sidebar entry into an inline rename input, focused and with
// the current name pre-selected for quick editing.
function startRenameRoom(li, roomId, currentName) {
  const nameSpan = li.querySelector('.room-name');
  if (!nameSpan) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'room-rename-input';
  input.value = currentName;
  input.maxLength = 40;

  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  let settled = false; // guards against both blur AND Enter firing the submit twice

  function cancel() {
    if (settled) return;
    settled = true;
    input.replaceWith(nameSpan);
  }

  async function submit() {
    if (settled) return;
    settled = true;

    const newName = input.value.trim();
    if (!newName || newName === currentName) {
      input.replaceWith(nameSpan);
      return;
    }

    try {
      const res = await apiFetch(`/rooms/${roomId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: newName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rename room');

      nameSpan.textContent = data.name;
      input.replaceWith(nameSpan);

      if (roomId === activeRoomId) {
        activeRoomName = data.name;
        activeRoomNameEl.textContent = `# ${data.name}`;
        activeRoomNameEl.title = data.name;
      }
    } catch (err) {
      alert(err.message);
      input.replaceWith(nameSpan);
    }
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') cancel();
  });
  input.addEventListener('blur', submit);
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
  activeRoomNameEl.title = roomName;
  messageInput.disabled = false;
  sendBtn.disabled = false;
  messagesEl.innerHTML = '';
  typingIndicatorEl.textContent = '';

  const room = roomsById[roomId];
  deleteRoomBtn.classList.toggle('hidden', !(room && room.isAdmin));
  blockedUsersBtn.classList.toggle('hidden', !(room && room.isAdmin));

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
  const isRestricted = roomRestrictedCheckbox.checked;

  try {
    const res = await apiFetch('/rooms', {
      method: 'POST',
      body: JSON.stringify({ name, description, isRestricted })
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

// ---------- Pending join requests (creator only) ----------
async function openRequestsModal(roomId, roomName) {
  requestsModalTitle.textContent = `Join Requests — ${roomName}`;
  requestsList.innerHTML = '';
  requestsEmptyMsg.classList.add('hidden');
  requestsModal.classList.remove('hidden');

  try {
    const res = await apiFetch(`/rooms/${roomId}/requests`);
    const requests = await res.json();
    if (!res.ok) throw new Error(requests.error || 'Failed to load requests');

    if (requests.length === 0) {
      requestsEmptyMsg.classList.remove('hidden');
      return;
    }

    requests.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'request-item';
      li.innerHTML = `
        <span>${getInitialsAvatar(r.username)}${escapeHtml(r.username)}</span>
        <span class="request-actions">
          <button class="approve-btn" data-user-id="${r.userId}">Approve</button>
          <button class="deny-btn" data-user-id="${r.userId}">Deny</button>
        </span>
      `;
      li.querySelector('.approve-btn').addEventListener('click', () => handleRequestDecision(roomId, r.userId, 'approve', li));
      li.querySelector('.deny-btn').addEventListener('click', () => handleRequestDecision(roomId, r.userId, 'deny', li));
      requestsList.appendChild(li);
    });
  } catch (err) {
    requestsList.innerHTML = `<li>${escapeHtml(err.message)}</li>`;
  }
}

async function handleRequestDecision(roomId, userId, decision, listItemEl) {
  try {
    const res = await apiFetch(`/rooms/${roomId}/requests/${userId}/${decision}`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Failed to ${decision} request`);

    listItemEl.remove();
    if (requestsList.children.length === 0) {
      requestsEmptyMsg.classList.remove('hidden');
    }
    await loadRooms(); // refresh sidebar badge count
  } catch (err) {
    alert(err.message);
  }
}

closeRequestsBtn.addEventListener('click', () => requestsModal.classList.add('hidden'));

deleteRoomBtn.addEventListener('click', () => {
  if (!activeRoomId) return;
  handleDeleteRoom(activeRoomId, activeRoomName);
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
  // ID-based ownership check: usernames are editable now, so comparing names
  // is no longer a safe way to know if this is "my" message.
  const isOwn = msg.sender === currentUser._id;
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
    <div class="meta">${getInitialsAvatar(msg.senderName)}${isOwn ? 'You' : escapeHtml(msg.senderName)} · <span class="msg-time" data-ts="${msg.createdAt}" title="${relativeTime}">${time}</span></div>
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

// Deterministically generates a small colored initials avatar for a given
// display name — no uploads, no storage, same name always yields same color.
const AVATAR_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
function getInitialsAvatar(name) {
  const safeName = (name || '?').trim();
  const initials = safeName
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  let hash = 0;
  for (let i = 0; i < safeName.length; i++) {
    hash = safeName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];

  return `<span class="avatar" style="background:${color}">${escapeHtml(initials)}</span>`;
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
