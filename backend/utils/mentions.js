const User = require('../models/User');

// Matches @username patterns (letters, numbers, underscore — matching the
// existing username validation rules used at registration). The (?<![\w.])
// negative lookbehind stops this from false-matching inside an email address
// like test@example.com, where @example is NOT an intended mention.
const MENTION_REGEX = /(?<![\w.])@([a-zA-Z0-9_]{3,30})/g;

// Extracts @username patterns from message text and resolves them against
// real, existing usernames — so mentioning a typo or a nonexistent user
// doesn't create a bogus mention. Returns an array of matching User IDs.
async function parseMentions(text) {
  const matches = [...text.matchAll(MENTION_REGEX)].map((m) => m[1]);
  if (matches.length === 0) return [];

  const uniqueUsernames = [...new Set(matches)];
  const users = await User.find({ username: { $in: uniqueUsernames } }).select('_id');
  return users.map((u) => u._id);
}

module.exports = { parseMentions, MENTION_REGEX };
