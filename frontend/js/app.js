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

const registerEmailInput = document.getElementById('register-email');
const registerOtpForm = document.getElementById('register-otp-form');
const registerOtpInput = document.getElementById('register-otp-input');
const registerResendOtpLink = document.getElementById('register-resend-otp-link');

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
const restrictToggleBtn = document.getElementById('restrict-toggle-btn');

// Messaging enhancements
const pinnedToggleBtn = document.getElementById('pinned-toggle-btn');
const pinnedCountEl = document.getElementById('pinned-count');
const pinnedPanel = document.getElementById('pinned-panel');
const pinnedList = document.getElementById('pinned-list');
const pinnedEmptyMsg = document.getElementById('pinned-empty-msg');
const closePinnedBtn = document.getElementById('close-pinned-btn');

const searchToggleBtn = document.getElementById('search-toggle-btn');
const searchPanel = document.getElementById('search-panel');
const searchInput = document.getElementById('search-input');
const searchResultsEl = document.getElementById('search-results');
const closeSearchBtn = document.getElementById('close-search-btn');

const replyPreviewBar = document.getElementById('reply-preview-bar');
const replyPreviewName = document.getElementById('reply-preview-name');
const replyPreviewText = document.getElementById('reply-preview-text');
const cancelReplyBtn = document.getElementById('cancel-reply-btn');

const mentionAutocomplete = document.getElementById('mention-autocomplete');
const emptyStateEl = document.getElementById('empty-state');
const messagesEl = document.getElementById('messages');
const typingIndicatorEl = document.getElementById('typing-indicator');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const emojiBtn = document.getElementById('emoji-btn');
const emojiPopover = document.getElementById('emoji-popover');
const emojiTabsEl = document.getElementById('emoji-tabs');
const emojiGridEl = document.getElementById('emoji-grid');
const emojiSearchInput = document.getElementById('emoji-search-input');
const emojiNoResults = document.getElementById('emoji-no-results');
const micBtn = document.getElementById('mic-btn');
const micErrorMsg = document.getElementById('mic-error-msg');

const currentUsernameEl = document.getElementById('current-username');
const logoutBtn = document.getElementById('logout-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const collapseSidebarBtn = document.getElementById('collapse-sidebar-btn');
const expandSidebarBtn = document.getElementById('expand-sidebar-btn');
const chatScreenSection = document.getElementById('chat-screen');

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

// ---------- Sidebar collapse/expand ----------
function applySidebarCollapsed(collapsed) {
  chatScreenSection.classList.toggle('sidebar-collapsed', collapsed);
  expandSidebarBtn.classList.toggle('hidden', !collapsed);
  localStorage.setItem('chat_sidebar_collapsed', collapsed ? '1' : '0');
}

collapseSidebarBtn.addEventListener('click', () => applySidebarCollapsed(true));
expandSidebarBtn.addEventListener('click', () => applySidebarCollapsed(false));

// Apply saved preference immediately (defaults to expanded if none saved)
applySidebarCollapsed(localStorage.getItem('chat_sidebar_collapsed') === '1');

// ---------- Emoji picker ----------
// A small, curated, self-hosted set — plain Unicode characters, no images,
// no external library or CDN. Deliberately avoids repeating the cdn.socket.io
// lesson from earlier in this project: no new external dependency for
// something this replaceable.
const EMOJI_CATEGORIES = {
  'Smileys': [{ e: '😀', k: 'grinning happy smile' }, { e: '😃', k: 'happy smile joy' }, { e: '😄', k: 'happy laugh smile' }, { e: '😁', k: 'grin happy smile' }, { e: '😆', k: 'laugh happy haha' }, { e: '😅', k: 'sweat laugh nervous relief' }, { e: '😂', k: 'laugh cry funny lol' }, { e: '🤣', k: 'rofl laugh funny hilarious' }, { e: '😊', k: 'smile happy blush' }, { e: '😇', k: 'angel innocent halo' }, { e: '🙂', k: 'smile slight' }, { e: '🙃', k: 'upside down silly' }, { e: '😉', k: 'wink flirt' }, { e: '😌', k: 'relieved calm content' }, { e: '😍', k: 'love heart eyes crush' }, { e: '🥰', k: 'love adore hearts' }, { e: '😘', k: 'kiss love' }, { e: '😗', k: 'kiss whistle' }, { e: '😙', k: 'kiss smile' }, { e: '😚', k: 'kiss closed eyes' }, { e: '😋', k: 'yum delicious tasty tongue' }, { e: '😛', k: 'tongue playful silly' }, { e: '😝', k: 'tongue silly wink' }, { e: '😜', k: 'wink tongue silly crazy' }, { e: '🤪', k: 'crazy wild goofy' }, { e: '🤨', k: 'skeptical suspicious raised eyebrow' }, { e: '🧐', k: 'monocle curious inspect' }, { e: '🤓', k: 'nerd glasses geek' }, { e: '😎', k: 'cool sunglasses awesome' }, { e: '🥳', k: 'party celebrate birthday' }, { e: '😏', k: 'smirk sly confident' }, { e: '😒', k: 'unamused annoyed meh' }, { e: '😞', k: 'sad disappointed' }, { e: '😔', k: 'sad pensive down' }, { e: '😟', k: 'worried concerned' }, { e: '😕', k: 'confused unsure' }, { e: '🙁', k: 'sad frown' }, { e: '☹️', k: 'sad frown upset' }, { e: '😣', k: 'persevere struggle frustrated' }, { e: '😖', k: 'confounded distress' }, { e: '😫', k: 'tired exhausted fed up' }, { e: '😩', k: 'tired weary exhausted' }, { e: '🥺', k: 'pleading puppy eyes sad' }, { e: '😢', k: 'cry sad tear' }, { e: '😭', k: 'crying sob sad tears' }, { e: '😤', k: 'frustrated huff proud steam' }, { e: '😠', k: 'angry mad' }, { e: '😡', k: 'angry rage mad furious' }, { e: '🤬', k: 'angry curse swearing' }, { e: '🤯', k: 'mind blown shocked' }, { e: '😳', k: 'flushed embarrassed shocked' }, { e: '🥵', k: 'hot sweating overheated' }, { e: '🥶', k: 'cold freezing' }, { e: '😱', k: 'scream shocked scared' }, { e: '😨', k: 'fearful scared afraid' }, { e: '😰', k: 'anxious nervous sweat' }, { e: '😥', k: 'sad relieved disappointed' }, { e: '😓', k: 'sweat nervous tired' }, { e: '🤗', k: 'hug welcome warm' }, { e: '🤔', k: 'thinking hmm ponder' }, { e: '🤭', k: 'giggle oops shy' }, { e: '🤫', k: 'shush quiet secret' }, { e: '🤥', k: 'lying pinocchio nose' }, { e: '😶', k: 'speechless quiet no mouth' }, { e: '😐', k: 'neutral blank' }, { e: '😑', k: 'expressionless blank annoyed' }, { e: '😬', k: 'grimace awkward yikes' }, { e: '🙄', k: 'eye roll annoyed sarcastic' }, { e: '😯', k: 'surprised gasp' }, { e: '😦', k: 'frown open mouth shock' }, { e: '😧', k: 'anguished shocked' }, { e: '😮', k: 'surprised open mouth wow' }, { e: '😲', k: 'astonished shocked wow' }, { e: '😴', k: 'sleep tired zzz' }, { e: '🤤', k: 'drool sleepy hungry' }, { e: '😪', k: 'sleepy tired' }, { e: '😵', k: 'dizzy confused knocked out' }, { e: '🤐', k: 'zipper mouth quiet secret' }, { e: '🥴', k: 'woozy dizzy drunk' }, { e: '🤢', k: 'sick nauseous gross' }, { e: '🤮', k: 'vomit sick gross' }, { e: '🤧', k: 'sneeze sick allergy' }, { e: '😷', k: 'mask sick ill' }, { e: '🤒', k: 'sick thermometer fever' }, { e: '🤕', k: 'hurt bandage injured' }],
  'Gestures': [{ e: '👍', k: 'thumbs up good yes approve' }, { e: '👎', k: 'thumbs down bad no disapprove' }, { e: '👌', k: 'ok perfect' }, { e: '✌️', k: 'peace victory' }, { e: '🤞', k: 'fingers crossed luck hope' }, { e: '🤟', k: 'love you sign' }, { e: '🤘', k: 'rock horns metal' }, { e: '🤙', k: 'call me shaka' }, { e: '👈', k: 'point left' }, { e: '👉', k: 'point right' }, { e: '👆', k: 'point up' }, { e: '👇', k: 'point down' }, { e: '☝️', k: 'point up one' }, { e: '✋', k: 'stop hand raised' }, { e: '🤚', k: 'back hand raised stop' }, { e: '🖐️', k: 'hand five fingers stop' }, { e: '🖖', k: 'vulcan spock salute' }, { e: '👋', k: 'wave hello bye' }, { e: '🤝', k: 'handshake deal agreement' }, { e: '👏', k: 'clap applause well done' }, { e: '🙌', k: 'hooray raised hands celebrate' }, { e: '👐', k: 'open hands hug' }, { e: '🤲', k: 'palms up pray hands' }, { e: '🙏', k: 'pray please thanks hope' }, { e: '✊', k: 'fist power solidarity' }, { e: '👊', k: 'fist bump punch' }, { e: '🤛', k: 'fist bump left' }, { e: '🤜', k: 'fist bump right' }, { e: '💪', k: 'muscle strong flex' }, { e: '🦾', k: 'robot arm strong prosthetic' }, { e: '🖕', k: 'middle finger rude' }, { e: '✍️', k: 'writing hand signature' }, { e: '🤳', k: 'selfie' }],
  'Hearts': [{ e: '❤️', k: 'heart love red' }, { e: '🧡', k: 'heart love orange' }, { e: '💛', k: 'heart love yellow' }, { e: '💚', k: 'heart love green' }, { e: '💙', k: 'heart love blue' }, { e: '💜', k: 'heart love purple' }, { e: '🖤', k: 'heart love black' }, { e: '🤍', k: 'heart love white' }, { e: '🤎', k: 'heart love brown' }, { e: '💔', k: 'broken heart heartbreak sad' }, { e: '❣️', k: 'heart exclamation love' }, { e: '💕', k: 'hearts love two' }, { e: '💞', k: 'hearts revolving love' }, { e: '💓', k: 'heart beating love pulse' }, { e: '💗', k: 'heart growing love' }, { e: '💖', k: 'heart sparkle love shining' }, { e: '💘', k: 'heart arrow cupid love' }, { e: '💝', k: 'heart gift love ribbon' }, { e: '💟', k: 'heart decoration love' }, { e: '♥️', k: 'heart love suit' }],
  'Animals & Nature': [{ e: '🐶', k: 'dog puppy pet' }, { e: '🐱', k: 'cat kitten pet' }, { e: '🐭', k: 'mouse' }, { e: '🐹', k: 'hamster pet' }, { e: '🐰', k: 'rabbit bunny' }, { e: '🦊', k: 'fox' }, { e: '🐻', k: 'bear' }, { e: '🐼', k: 'panda' }, { e: '🐨', k: 'koala' }, { e: '🐯', k: 'tiger' }, { e: '🦁', k: 'lion' }, { e: '🐮', k: 'cow' }, { e: '🐷', k: 'pig' }, { e: '🐸', k: 'frog' }, { e: '🐵', k: 'monkey' }, { e: '🐔', k: 'chicken' }, { e: '🐧', k: 'penguin' }, { e: '🐦', k: 'bird' }, { e: '🐤', k: 'chick baby bird' }, { e: '🦆', k: 'duck' }, { e: '🦅', k: 'eagle' }, { e: '🦉', k: 'owl' }, { e: '🐺', k: 'wolf' }, { e: '🐗', k: 'boar' }, { e: '🐴', k: 'horse' }, { e: '🦄', k: 'unicorn' }, { e: '🐝', k: 'bee' }, { e: '🐛', k: 'caterpillar bug' }, { e: '🦋', k: 'butterfly' }, { e: '🐌', k: 'snail slow' }, { e: '🐞', k: 'ladybug bug' }, { e: '🐢', k: 'turtle slow' }, { e: '🐍', k: 'snake' }, { e: '🦖', k: 'dinosaur trex' }, { e: '🐙', k: 'octopus' }, { e: '🐬', k: 'dolphin' }, { e: '🐳', k: 'whale' }, { e: '🐘', k: 'elephant' }, { e: '🦒', k: 'giraffe' }, { e: '🌸', k: 'flower blossom cherry' }, { e: '🌻', k: 'sunflower flower' }, { e: '🌼', k: 'flower daisy' }, { e: '🌷', k: 'tulip flower' }, { e: '🌹', k: 'rose flower love' }, { e: '🍀', k: 'clover luck lucky' }, { e: '🌈', k: 'rainbow pride' }, { e: '☀️', k: 'sun sunny weather' }, { e: '⭐', k: 'star' }, { e: '🌙', k: 'moon night' }],
  'Food': [{ e: '🍏', k: 'apple green fruit' }, { e: '🍎', k: 'apple red fruit' }, { e: '🍊', k: 'orange fruit' }, { e: '🍋', k: 'lemon fruit sour' }, { e: '🍌', k: 'banana fruit' }, { e: '🍉', k: 'watermelon fruit' }, { e: '🍇', k: 'grapes fruit' }, { e: '🍓', k: 'strawberry fruit' }, { e: '🍒', k: 'cherry fruit' }, { e: '🍑', k: 'peach fruit butt' }, { e: '🥭', k: 'mango fruit' }, { e: '🍍', k: 'pineapple fruit' }, { e: '🥥', k: 'coconut fruit' }, { e: '🥝', k: 'kiwi fruit' }, { e: '🍅', k: 'tomato' }, { e: '🥑', k: 'avocado' }, { e: '🍕', k: 'pizza food' }, { e: '🍔', k: 'burger hamburger food' }, { e: '🍟', k: 'fries food' }, { e: '🌭', k: 'hotdog food' }, { e: '🍿', k: 'popcorn movie snack' }, { e: '🧂', k: 'salt seasoning' }, { e: '🥓', k: 'bacon food' }, { e: '🥚', k: 'egg food' }, { e: '🍳', k: 'fried egg cooking' }, { e: '🥞', k: 'pancakes food breakfast' }, { e: '🧇', k: 'waffle food breakfast' }, { e: '🍞', k: 'bread food' }, { e: '🥐', k: 'croissant bread food' }, { e: '🧀', k: 'cheese food' }, { e: '🍗', k: 'chicken leg food meat' }, { e: '🍖', k: 'meat food' }, { e: '🥩', k: 'steak meat food' }, { e: '🌮', k: 'taco food mexican' }, { e: '🌯', k: 'burrito food mexican' }, { e: '🍝', k: 'spaghetti pasta food' }, { e: '🍜', k: 'noodles ramen soup food' }, { e: '🍣', k: 'sushi food' }, { e: '🍩', k: 'donut food sweet' }, { e: '🍪', k: 'cookie food sweet' }, { e: '🎂', k: 'cake birthday' }, { e: '🍰', k: 'cake slice sweet dessert' }, { e: '🧁', k: 'cupcake dessert sweet' }, { e: '🍫', k: 'chocolate sweet' }, { e: '🍬', k: 'candy sweet' }, { e: '🍭', k: 'lollipop candy sweet' }, { e: '☕', k: 'coffee drink' }, { e: '🍵', k: 'tea drink' }, { e: '🥤', k: 'soda drink cup' }, { e: '🍺', k: 'beer drink alcohol' }, { e: '🍷', k: 'wine drink alcohol' }],
  'Objects': [{ e: '⚽', k: 'soccer football ball sport' }, { e: '🏀', k: 'basketball ball sport' }, { e: '🏈', k: 'football american ball sport' }, { e: '⚾', k: 'baseball ball sport' }, { e: '🎾', k: 'tennis ball sport' }, { e: '🏐', k: 'volleyball ball sport' }, { e: '🎱', k: 'pool billiards 8ball' }, { e: '🏓', k: 'ping pong table tennis' }, { e: '🎮', k: 'game controller video games' }, { e: '🎲', k: 'dice game random' }, { e: '🎧', k: 'headphones music audio' }, { e: '🎸', k: 'guitar music' }, { e: '🎹', k: 'piano keyboard music' }, { e: '🎨', k: 'art paint palette creative' }, { e: '📷', k: 'camera photo' }, { e: '💻', k: 'laptop computer' }, { e: '📱', k: 'phone mobile' }, { e: '⌚', k: 'watch time clock' }, { e: '💡', k: 'idea light bulb bright' }, { e: '🔦', k: 'flashlight torch light' }, { e: '📚', k: 'books read study' }, { e: '✏️', k: 'pencil write' }, { e: '📌', k: 'pin note important' }, { e: '🔒', k: 'lock secure private' }, { e: '🔑', k: 'key unlock' }, { e: '🎁', k: 'gift present birthday' }, { e: '🎉', k: 'party celebrate confetti' }, { e: '🎈', k: 'balloon party celebrate' }, { e: '🏆', k: 'trophy win award champion' }, { e: '💯', k: 'hundred perfect score' }, { e: '🔥', k: 'fire hot lit awesome' }, { e: '✨', k: 'sparkles shiny magic' }, { e: '💤', k: 'sleep zzz tired' }, { e: '💬', k: 'chat speech bubble message' }, { e: '👀', k: 'eyes look watching' }]
};

let currentEmojiCategory = 'Smileys';

function renderEmojiTabs() {
  emojiTabsEl.innerHTML = '';
  Object.keys(EMOJI_CATEGORIES).forEach((category) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'emoji-tab' + (category === currentEmojiCategory ? ' active' : '');
    tab.textContent = EMOJI_CATEGORIES[category][0].e; // use the category's first emoji as its tab icon
    tab.title = category;
    tab.addEventListener('click', () => {
      currentEmojiCategory = category;
      renderEmojiTabs();
      renderEmojiGrid();
    });
    emojiTabsEl.appendChild(tab);
  });
}

// Renders either the currently selected category (normal browsing) or a
// flat list of search results across ALL categories (while actively searching).
function renderEmojiGrid(items) {
  const entries = items || EMOJI_CATEGORIES[currentEmojiCategory];
  emojiGridEl.innerHTML = '';
  emojiNoResults.classList.toggle('hidden', entries.length > 0);

  entries.forEach(({ e: emoji }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-item';
    btn.textContent = emoji;
    btn.addEventListener('click', () => {
      if (reactionTargetMessageId) {
        handleToggleReaction(reactionTargetMessageId, emoji);
        reactionTargetMessageId = null;
        emojiPopover.classList.add('hidden');
      } else {
        insertEmojiAtCursor(emoji);
      }
    });
    emojiGridEl.appendChild(btn);
  });
}

// Searches keywords across every category at once, not just the currently
// open tab — e.g. typing "fire" finds 🔥 even while sitting on "Smileys".
function searchEmoji(query) {
  const q = query.trim().toLowerCase();
  const results = [];
  Object.values(EMOJI_CATEGORIES).forEach((entries) => {
    entries.forEach((entry) => {
      if (entry.k.includes(q)) results.push(entry);
    });
  });
  return results;
}

emojiSearchInput.addEventListener('input', () => {
  const query = emojiSearchInput.value;
  if (!query.trim()) {
    emojiTabsEl.classList.remove('hidden');
    renderEmojiGrid();
    return;
  }
  emojiTabsEl.classList.add('hidden');
  renderEmojiGrid(searchEmoji(query));
});

// Inserts at the current cursor position (not just appended to the end), so
// picking an emoji mid-sentence works the way anyone would expect.
function insertEmojiAtCursor(emoji) {
  const start = messageInput.selectionStart ?? messageInput.value.length;
  const end = messageInput.selectionEnd ?? messageInput.value.length;
  const before = messageInput.value.slice(0, start);
  const after = messageInput.value.slice(end);
  messageInput.value = before + emoji + after;

  const newCursorPos = start + emoji.length;
  messageInput.focus();
  messageInput.setSelectionRange(newCursorPos, newCursorPos);
}

emojiBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const opening = emojiPopover.classList.contains('hidden');
  emojiPopover.classList.toggle('hidden');

  if (opening) {
    // Reset to a clean browsing state and auto-focus the search box, so the
    // user can start typing a search immediately with no extra click.
    reactionTargetMessageId = null; // opening via the compose button is always insert-mode
    emojiSearchInput.value = '';
    emojiTabsEl.classList.remove('hidden');
    renderEmojiGrid();
    emojiSearchInput.focus();
  }
});

document.addEventListener('click', (e) => {
  if (!emojiPopover.contains(e.target) && e.target !== emojiBtn) {
    emojiPopover.classList.add('hidden');
  }
});

renderEmojiTabs();
renderEmojiGrid();

// ---------- Speech-to-text (microphone dictation) ----------
// Uses the browser's built-in Web Speech API — no audio is sent to our own
// backend. In Chrome/Edge, transcription happens via the browser vendor's
// speech servers (standard browser behavior, not something specific to this
// app). Firefox and some Safari versions don't implement this API at all;
// the button is hidden entirely for them rather than shown broken.
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

if (SpeechRecognitionAPI) {
  micBtn.classList.remove('hidden');

  recognition = new SpeechRecognitionAPI();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  let baseText = ''; // message input's text before this dictation session started

  recognition.addEventListener('start', () => {
    isListening = true;
    micBtn.classList.add('listening');
    micErrorMsg.classList.add('hidden');
    baseText = messageInput.value ? messageInput.value + ' ' : '';
  });

  recognition.addEventListener('result', (event) => {
    let transcript = '';
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    messageInput.value = baseText + transcript;
  });

  recognition.addEventListener('end', () => {
    isListening = false;
    micBtn.classList.remove('listening');
  });

  recognition.addEventListener('error', (event) => {
    isListening = false;
    micBtn.classList.remove('listening');

    if (event.error === 'not-allowed' || event.error === 'permission-denied') {
      micErrorMsg.textContent = 'Microphone access denied — enable it in your browser\'s site settings to use dictation.';
    } else if (event.error === 'no-speech') {
      micErrorMsg.textContent = 'No speech detected — try again.';
    } else {
      micErrorMsg.textContent = 'Dictation failed. Please try again.';
    }
    micErrorMsg.classList.remove('hidden');
  });

  micBtn.addEventListener('click', () => {
    if (isListening) {
      recognition.stop();
    } else {
      // The browser's own native permission prompt IS the consent step here —
      // no separate custom dialog is shown before this, since one would just
      // duplicate what the browser already asks.
      recognition.start();
    }
  });
}
// If SpeechRecognitionAPI is unsupported, micBtn simply stays hidden
// (it already has the `hidden` class by default in the HTML).

// ---------- Auth tab switching ----------
tabLogin.addEventListener('click', () => setAuthMode('login'));
tabRegister.addEventListener('click', () => setAuthMode('register'));

function setAuthMode(mode) {
  authMode = mode;
  tabLogin.classList.toggle('active', mode === 'login');
  tabRegister.classList.toggle('active', mode === 'register');
  authSubmit.textContent = mode === 'login' ? 'Login' : 'Create account';
  authError.textContent = '';
  authError.classList.remove('success-text');
  registerEmailInput.classList.toggle('hidden', mode !== 'register');
  registerEmailInput.required = mode === 'register';
}

// Tracks the username currently awaiting OTP verification, so the
// verify/resend calls know which pending registration to act on.
let pendingRegistrationUsername = null;

// ---------- Auth submit ----------
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.textContent = '';
  authError.classList.remove('success-text');

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    if (authMode === 'login') {
      const res = await fetch(`${API_BASE}/auth/login`, {
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
    } else {
      // Registration is now two steps: start (validates + emails a code),
      // then verify (which is what actually creates the account).
      const email = registerEmailInput.value.trim();

      const res = await fetch(`${API_BASE}/auth/register/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');

      pendingRegistrationUsername = username;
      authForm.classList.add('hidden');
      document.querySelector('.tabs').classList.add('hidden');
      forgotLinks.classList.add('hidden');
      registerOtpForm.classList.remove('hidden');
      registerOtpInput.value = '';
    }
  } catch (err) {
    authError.textContent = err.message;
  }
});

registerOtpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.textContent = '';
  authError.classList.remove('success-text');
  const otp = registerOtpInput.value.trim();

  try {
    const res = await fetch(`${API_BASE}/auth/register/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: pendingRegistrationUsername, otp })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');

    token = data.token;
    currentUser = data.user;
    localStorage.setItem('chat_token', token);
    localStorage.setItem('chat_user', JSON.stringify(currentUser));

    pendingRegistrationUsername = null;
    registerOtpForm.classList.add('hidden');
    showAuthDefaultView();

    enterChat();
  } catch (err) {
    authError.textContent = err.message;
  }
});

registerResendOtpLink.addEventListener('click', async (e) => {
  e.preventDefault();
  authError.textContent = '';
  authError.classList.remove('success-text');

  try {
    const res = await fetch(`${API_BASE}/auth/register/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: pendingRegistrationUsername })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    authError.textContent = data.message;
    authError.classList.add('success-text');
  } catch (err) {
    authError.textContent = err.message;
    authError.classList.remove('success-text');
  }
});

// ---------- Forgot Username / Forgot Password (login screen) ----------
function showAuthDefaultView() {
  authForm.classList.remove('hidden');
  document.querySelector('.tabs').classList.remove('hidden');
  forgotLinks.classList.remove('hidden');
  forgotUsernameForm.classList.add('hidden');
  forgotPasswordForm.classList.add('hidden');
  registerOtpForm.classList.add('hidden');
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

  socket.on('message_edited', ({ _id, text, edited }) => {
    const wrapper = messagesEl.querySelector(`[data-message-id="${_id}"]`);
    if (!wrapper) return;
    const bubble = wrapper.querySelector('.bubble');
    if (bubble) bubble.innerHTML = highlightMentions(escapeHtml(text));
    if (edited && !wrapper.querySelector('.edited-tag')) {
      wrapper.querySelector('.meta').insertAdjacentHTML('beforeend', ' <span class="edited-tag">(edited)</span>');
    }
  });

  socket.on('message_reaction_updated', ({ _id, reactions }) => {
    const wrapper = messagesEl.querySelector(`[data-message-id="${_id}"]`);
    if (!wrapper) return;
    renderReactionsBar(wrapper, reactions);
  });

  socket.on('message_pinned', () => {
    if (activeRoomId) refreshPinnedCount(activeRoomId);
  });

  socket.on('message_unpinned', () => {
    if (activeRoomId) refreshPinnedCount(activeRoomId);
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

  // A room's approval requirement changed live (toggled by an admin, possibly
  // in another tab). Refresh the room list so the lock icon, "Request to
  // Join" state, and the header toggle button all reflect the new state
  // immediately — for anyone currently in the room OR who has it in view.
  socket.on('room_restricted', ({ roomId }) => {
    if (roomId === activeRoomId) renderSystemNote('This room now requires approval to join.');
    loadRooms();
  });

  socket.on('room_unrestricted', ({ roomId }) => {
    if (roomId === activeRoomId) renderSystemNote('This room is now open to everyone.');
    loadRooms();
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
      showEmptyState();
      alert(`This room ("${roomName}") was deleted by an admin.`);
    }
    loadRooms();
  });

  // An admin blocked us from a room we're currently sitting in — the server
  // has already forcibly removed our socket from it; update our own UI to match.
  socket.on('room_blocked', ({ roomId, roomName }) => {
    if (roomId === activeRoomId) {
      activeRoomId = null;
      showEmptyState();
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

  // Keep the Delete Room / Blocked Users / Restrict buttons in sync even if
  // admin status or restriction state changed for the CURRENTLY active room
  // without switching rooms (e.g. just got promoted, or someone else toggled it).
  if (activeRoomId && roomsById[activeRoomId]) {
    const isAdmin = roomsById[activeRoomId].isAdmin;
    deleteRoomBtn.classList.toggle('hidden', !isAdmin);
    blockedUsersBtn.classList.toggle('hidden', !isAdmin);
    updateRestrictToggleBtn(roomsById[activeRoomId]);
  }
}

// Shows/hides the restrict/open toggle (admin only) and sets its label and
// action based on the room's CURRENT restriction state.
function updateRestrictToggleBtn(room) {
  const isAdmin = Boolean(room && room.isAdmin);
  restrictToggleBtn.classList.toggle('hidden', !isAdmin);
  if (!isAdmin) return;

  if (room.isRestricted) {
    restrictToggleBtn.textContent = '🔓 Open Room';
    restrictToggleBtn.dataset.action = 'unrestrict';
  } else {
    restrictToggleBtn.textContent = '🔒 Restrict Room';
    restrictToggleBtn.dataset.action = 'restrict';
  }
}

restrictToggleBtn.addEventListener('click', async () => {
  if (!activeRoomId) return;
  const action = restrictToggleBtn.dataset.action;

  const confirmed = action === 'restrict'
    ? confirm('Make this room approval-required? Everyone currently online or who has previously posted here will keep access. Anyone new will need to request approval to join.')
    : confirm('Open this room back up? Anyone will be able to join freely again. Blocked users will remain blocked regardless.');
  if (!confirmed) return;

  try {
    const res = await apiFetch(`/rooms/${activeRoomId}/${action}`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Failed to ${action} room`);
    await loadRooms();
  } catch (err) {
    alert(err.message);
  }
});

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

// Shows the friendly "no room selected" view — used both before any room has
// ever been picked, and after leaving a room via Escape.
function showEmptyState() {
  emptyStateEl.classList.remove('hidden');
  messagesEl.classList.add('hidden');
  messageForm.classList.add('hidden');
  messagesEl.innerHTML = '';
  typingIndicatorEl.textContent = '';
  activeRoomNameEl.textContent = 'Select a room';
  activeRoomNameEl.title = '';
  messageInput.disabled = true;
  sendBtn.disabled = true;
  resetPresenceDropdown();
  deleteRoomBtn.classList.add('hidden');
  blockedUsersBtn.classList.add('hidden');
  restrictToggleBtn.classList.add('hidden');
  pinnedToggleBtn.classList.add('hidden');
  pinnedPanel.classList.add('hidden');
  searchPanel.classList.add('hidden');
  replyingToMessage = null;
  replyPreviewBar.classList.add('hidden');
  document.querySelectorAll('#room-list li').forEach((li) => li.classList.remove('active'));
}

// Shows the actual chat view — used whenever a room is selected.
function showActiveRoomView() {
  emptyStateEl.classList.add('hidden');
  messagesEl.classList.remove('hidden');
  messageForm.classList.remove('hidden');
}

// Pressing Escape closes the currently open room: actually leaves its live
// Socket.io session (so other members' presence stays accurate — see
// leave_room on the backend) and returns to the friendly empty-state view.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !activeRoomId) return;
  if (socket) socket.emit('leave_room');
  activeRoomId = null;
  showEmptyState();
});

async function selectRoom(roomId, roomName) {
  activeRoomId = roomId;
  activeRoomName = roomName;

  showActiveRoomView();

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
  updateRestrictToggleBtn(room);
  refreshPinnedCount(roomId);
  pinnedPanel.classList.add('hidden');
  searchPanel.classList.add('hidden');
  replyingToMessage = null;
  replyPreviewBar.classList.add('hidden');

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

  socket.emit('send_message', {
    roomId: activeRoomId,
    text,
    replyTo: replyingToMessage ? replyingToMessage._id : null
  });
  messageInput.value = '';
  socket.emit('typing', { roomId: activeRoomId, isTyping: false });

  replyingToMessage = null;
  replyPreviewBar.classList.add('hidden');
});

messageInput.addEventListener('input', () => {
  if (!activeRoomId) return;
  socket.emit('typing', { roomId: activeRoomId, isTyping: true });

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing', { roomId: activeRoomId, isTyping: false });
  }, 1500);

  updateMentionAutocomplete();
});

// ---------- @Mention autocomplete ----------
// Candidates are drawn from currently-online users (already tracked via
// lastPresenceUsers for the presence dropdown) — a reasonable proxy for
// "who's actually here to mention" without a separate membership lookup.
function updateMentionAutocomplete() {
  const cursorPos = messageInput.selectionStart;
  const textBeforeCursor = messageInput.value.slice(0, cursorPos);
  const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);

  if (!match) {
    mentionAutocomplete.classList.add('hidden');
    return;
  }

  const partial = match[1].toLowerCase();
  const candidates = lastPresenceUsers.filter((u) =>
    u.username.toLowerCase().startsWith(partial) && u.username !== currentUser.username
  );

  if (candidates.length === 0) {
    mentionAutocomplete.classList.add('hidden');
    return;
  }

  mentionAutocomplete.innerHTML = '';
  candidates.slice(0, 6).forEach((u) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'mention-autocomplete-item';
    item.textContent = u.username;
    item.addEventListener('click', () => applyMentionAutocomplete(u.username, match[0].length));
    mentionAutocomplete.appendChild(item);
  });
  mentionAutocomplete.classList.remove('hidden');
}

function applyMentionAutocomplete(username, matchLength) {
  const cursorPos = messageInput.selectionStart;
  const before = messageInput.value.slice(0, cursorPos - matchLength);
  const after = messageInput.value.slice(cursorPos);
  const insertion = (before.length > 0 && !before.endsWith(' ') ? ' ' : '') + `@${username} `;
  messageInput.value = before + insertion + after;

  const newCursorPos = before.length + insertion.length;
  messageInput.focus();
  messageInput.setSelectionRange(newCursorPos, newCursorPos);
  mentionAutocomplete.classList.add('hidden');
}

document.addEventListener('click', (e) => {
  if (e.target !== messageInput && !mentionAutocomplete.contains(e.target)) {
    mentionAutocomplete.classList.add('hidden');
  }
});

// Tracks which message (if any) is currently being replied to.
let replyingToMessage = null; // { _id, senderName, text } or null

// When set, clicking an emoji in the popover reacts to this message instead
// of inserting into the compose box (see the emoji-btn click handler below).
let reactionTargetMessageId = null;

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

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

  const editedTagHtml = (msg.edited && !isDeleted) ? ' <span class="edited-tag">(edited)</span>' : '';

  const deleteBtnHtml = (isOwn && !isDeleted)
    ? `<button class="msg-action-btn delete-msg-btn" title="Delete this message">🗑</button>`
    : '';
  const editBtnHtml = (isOwn && !isDeleted)
    ? `<button class="msg-action-btn edit-msg-btn" title="Edit this message">✏️</button>`
    : '';
  const replyBtnHtml = !isDeleted
    ? `<button class="msg-action-btn reply-msg-btn" title="Reply">↩️</button>`
    : '';
  const reactBtnHtml = !isDeleted
    ? `<button class="msg-action-btn react-msg-btn" title="Add reaction">😊</button>`
    : '';

  const activeRoom = roomsById[activeRoomId];
  const viewerIsAdmin = Boolean(activeRoom && activeRoom.isAdmin);
  const isPinned = ((activeRoom && activeRoom.pinnedMessages) || []).includes(msg._id);
  const pinBtnHtml = (viewerIsAdmin && !isDeleted)
    ? `<button class="msg-action-btn pin-msg-btn" title="${isPinned ? 'Unpin' : 'Pin'} this message">${isPinned ? '📌' : '📍'}</button>`
    : '';

  const replyPreviewHtml = renderReplyPreviewSnippet(msg.replyTo);
  const bubbleText = isDeleted ? 'Message deleted' : highlightMentions(escapeHtml(msg.text));

  wrapper.innerHTML = `
    <div class="meta">${getInitialsAvatar(msg.senderName)}${isOwn ? 'You' : escapeHtml(msg.senderName)} · <span class="msg-time" data-ts="${msg.createdAt}" title="${relativeTime}">${time}</span>${editedTagHtml}</div>
    <div class="bubble-row">
      ${replyPreviewHtml}
      <div class="bubble ${isDeleted ? 'deleted' : ''}">${bubbleText}</div>
      <div class="msg-actions">${replyBtnHtml}${reactBtnHtml}${pinBtnHtml}${editBtnHtml}${deleteBtnHtml}</div>
    </div>
    <div class="reactions-bar"></div>
  `;

  messagesEl.appendChild(wrapper);
  renderReactionsBar(wrapper, msg.reactions || []);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  const deleteBtn = wrapper.querySelector('.delete-msg-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => handleDeleteMessage(msg._id, msg.room || activeRoomId));
  }

  const editBtn = wrapper.querySelector('.edit-msg-btn');
  if (editBtn) {
    editBtn.addEventListener('click', () => startEditMessage(wrapper, msg));
  }

  const replyBtn = wrapper.querySelector('.reply-msg-btn');
  if (replyBtn) {
    replyBtn.addEventListener('click', () => startReplyTo(msg));
  }

  const reactBtn = wrapper.querySelector('.react-msg-btn');
  if (reactBtn) {
    reactBtn.addEventListener('click', (e) => openQuickReactPicker(e, msg._id));
  }

  const pinBtn = wrapper.querySelector('.pin-msg-btn');
  if (pinBtn) {
    pinBtn.addEventListener('click', () => handleTogglePin(msg._id, isPinned));
  }

  const replyQuote = wrapper.querySelector('.reply-quote');
  if (replyQuote) {
    replyQuote.addEventListener('click', () => jumpToMessage(replyQuote.dataset.replyId));
  }
}

// Renders the small quoted snippet above a message that is itself a reply.
// `replyTo` here is the lightweight {_id, senderName, text, deleted} object
// the backend already attaches — no separate lookup needed.
function renderReplyPreviewSnippet(replyTo) {
  if (!replyTo) return '';
  const snippetText = replyTo.deleted ? 'Message deleted' : escapeHtml(replyTo.text).slice(0, 80);
  return `
    <div class="reply-quote" data-reply-id="${replyTo._id}">
      <span class="reply-quote-name">${escapeHtml(replyTo.senderName)}</span>
      <span class="reply-quote-text">${snippetText}</span>
    </div>
  `;
}

// Highlights @username mentions in already-HTML-escaped text. Purely a
// visual affordance — it doesn't need to match the backend's validated
// mention list exactly; a cosmetic false-positive highlight is harmless.
function highlightMentions(escapedText) {
  return escapedText.replace(/(?<![\w.])@([a-zA-Z0-9_]{3,30})/g, '<span class="mention-highlight">@$1</span>');
}

function renderReactionsBar(wrapper, reactions) {
  const bar = wrapper.querySelector('.reactions-bar');
  bar.innerHTML = '';
  reactions.forEach(({ emoji, users }) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'reaction-pill' + (users.includes(currentUser._id) ? ' reacted' : '');
    pill.textContent = `${emoji} ${users.length}`;
    pill.title = users.length === 1 ? '1 reaction' : `${users.length} reactions`;
    pill.addEventListener('click', () => handleToggleReaction(wrapper.dataset.messageId, emoji));
    bar.appendChild(pill);
  });
}

async function handleToggleReaction(messageId, emoji) {
  try {
    await apiFetch(`/messages/${messageId}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji })
    });
    // No local re-render here — the message_reaction_updated broadcast
    // (which we also receive ourselves) handles updating the UI.
  } catch (err) {
    console.error('Failed to toggle reaction:', err.message);
  }
}

// A small popover of 6 common quick-react emoji, plus a "+" that reuses the
// full emoji picker (in "react mode" — see the emoji-btn handler).
function openQuickReactPicker(e, messageId) {
  e.stopPropagation();
  document.querySelectorAll('.quick-react-popover').forEach((el) => el.remove());

  const popover = document.createElement('div');
  popover.className = 'quick-react-popover';
  QUICK_REACTIONS.forEach((emoji) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = emoji;
    btn.addEventListener('click', () => {
      handleToggleReaction(messageId, emoji);
      popover.remove();
    });
    popover.appendChild(btn);
  });

  const moreBtn = document.createElement('button');
  moreBtn.type = 'button';
  moreBtn.className = 'quick-react-more';
  moreBtn.textContent = '+';
  moreBtn.title = 'More emoji';
  moreBtn.addEventListener('click', () => {
    reactionTargetMessageId = messageId;
    popover.remove();
    emojiPopover.classList.remove('hidden');
    emojiSearchInput.value = '';
    emojiTabsEl.classList.remove('hidden');
    renderEmojiGrid();
    emojiSearchInput.focus();
  });
  popover.appendChild(moreBtn);

  e.target.closest('.msg-actions').appendChild(popover);

  const closeOnOutsideClick = (evt) => {
    if (!popover.contains(evt.target)) {
      popover.remove();
      document.removeEventListener('click', closeOnOutsideClick);
    }
  };
  setTimeout(() => document.addEventListener('click', closeOnOutsideClick), 0);
}

// ---------- Reply-to ----------
function startReplyTo(msg) {
  replyingToMessage = { _id: msg._id, senderName: msg.senderName, text: msg.deleted ? 'Message deleted' : msg.text };
  replyPreviewName.textContent = msg.senderName;
  replyPreviewText.textContent = (msg.deleted ? 'Message deleted' : msg.text).slice(0, 80);
  replyPreviewBar.classList.remove('hidden');
  messageInput.focus();
}

cancelReplyBtn.addEventListener('click', () => {
  replyingToMessage = null;
  replyPreviewBar.classList.add('hidden');
});

function jumpToMessage(messageId) {
  const target = messagesEl.querySelector(`[data-message-id="${messageId}"]`);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('highlight-flash');
  setTimeout(() => target.classList.remove('highlight-flash'), 1500);
}

// ---------- Edit message ----------
function startEditMessage(wrapper, msg) {
  const bubble = wrapper.querySelector('.bubble');
  const originalText = msg.text;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'edit-msg-input';
  input.value = originalText;
  input.maxLength = 2000;

  bubble.replaceWith(input);
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);

  let settled = false;

  async function submit() {
    if (settled) return;
    settled = true;
    const newText = input.value.trim();

    if (!newText || newText === originalText) {
      input.replaceWith(bubble);
      return;
    }

    try {
      const res = await apiFetch(`/messages/${msg._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ text: newText })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to edit message');
      // The message_edited broadcast (received by us too) updates the DOM.
    } catch (err) {
      alert(err.message);
      input.replaceWith(bubble);
    }
  }

  function cancel() {
    if (settled) return;
    settled = true;
    input.replaceWith(bubble);
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') { e.stopPropagation(); cancel(); }
  });
  input.addEventListener('blur', submit);
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

// ---------- Pinned messages ----------
async function handleTogglePin(messageId, isPinned) {
  try {
    const res = await apiFetch(`/rooms/${activeRoomId}/pin/${messageId}`, {
      method: isPinned ? 'DELETE' : 'POST'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update pin');
    await loadRooms(); // refreshes roomsById[activeRoomId].pinnedMessages
    refreshPinnedCount(activeRoomId);
  } catch (err) {
    alert(err.message);
  }
}

async function refreshPinnedCount(roomId) {
  try {
    const res = await apiFetch(`/rooms/${roomId}/pinned`);
    const pinned = await res.json();
    if (!res.ok) return;
    pinnedCountEl.textContent = pinned.length;
    pinnedToggleBtn.classList.toggle('hidden', pinned.length === 0 && !(roomsById[roomId] && roomsById[roomId].isAdmin));
  } catch (err) {
    console.error('Failed to refresh pinned count:', err.message);
  }
}

async function openPinnedPanel() {
  if (!activeRoomId) return;
  pinnedPanel.classList.remove('hidden');
  searchPanel.classList.add('hidden');
  pinnedList.innerHTML = '';
  pinnedEmptyMsg.classList.add('hidden');

  try {
    const res = await apiFetch(`/rooms/${activeRoomId}/pinned`);
    const pinned = await res.json();
    if (!res.ok) throw new Error(pinned.error || 'Failed to load pinned messages');

    if (pinned.length === 0) {
      pinnedEmptyMsg.classList.remove('hidden');
      return;
    }

    pinned.forEach((msg) => {
      const li = document.createElement('li');
      li.className = 'pinned-item';
      const snippet = msg.deleted ? 'Message deleted' : escapeHtml(msg.text).slice(0, 100);
      li.innerHTML = `
        <div class="pinned-item-content" data-message-id="${msg._id}">
          <span class="pinned-item-name">${escapeHtml(msg.senderName)}</span>
          <span class="pinned-item-text">${snippet}</span>
        </div>
        <button class="pinned-unpin-btn" title="Unpin">✕</button>
      `;
      li.querySelector('.pinned-item-content').addEventListener('click', () => {
        pinnedPanel.classList.add('hidden');
        jumpToMessage(msg._id);
      });
      li.querySelector('.pinned-unpin-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        await handleTogglePin(msg._id, true);
        openPinnedPanel(); // refresh the panel's own list
      });
      pinnedList.appendChild(li);
    });
  } catch (err) {
    pinnedList.innerHTML = `<li>${escapeHtml(err.message)}</li>`;
  }
}

pinnedToggleBtn.addEventListener('click', openPinnedPanel);
closePinnedBtn.addEventListener('click', () => pinnedPanel.classList.add('hidden'));

// ---------- In-room message search ----------
searchToggleBtn.addEventListener('click', () => {
  pinnedPanel.classList.add('hidden');
  searchPanel.classList.toggle('hidden');
  if (!searchPanel.classList.contains('hidden')) {
    searchInput.value = '';
    searchResultsEl.innerHTML = '';
    searchInput.focus();
  }
});
closeSearchBtn.addEventListener('click', () => searchPanel.classList.add('hidden'));

let searchDebounceTimeout = null;
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounceTimeout);
  const query = searchInput.value.trim();
  if (!query) {
    searchResultsEl.innerHTML = '';
    return;
  }
  searchDebounceTimeout = setTimeout(() => runMessageSearch(query), 300);
});

async function runMessageSearch(query) {
  if (!activeRoomId) return;
  try {
    const res = await apiFetch(`/rooms/${activeRoomId}/search?q=${encodeURIComponent(query)}`);
    const results = await res.json();
    if (!res.ok) throw new Error(results.error || 'Search failed');

    searchResultsEl.innerHTML = '';
    if (results.length === 0) {
      searchResultsEl.innerHTML = '<p class="form-msg">No messages found.</p>';
      return;
    }

    results.forEach((msg) => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      const time = new Date(msg.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      item.innerHTML = `
        <span class="search-result-name">${escapeHtml(msg.senderName)}</span>
        <span class="search-result-time">${time}</span>
        <div class="search-result-text">${escapeHtml(msg.text)}</div>
      `;
      item.addEventListener('click', () => {
        searchPanel.classList.add('hidden');
        jumpToMessage(msg._id);
      });
      searchResultsEl.appendChild(item);
    });
  } catch (err) {
    searchResultsEl.innerHTML = `<p class="form-msg">${escapeHtml(err.message)}</p>`;
  }
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
