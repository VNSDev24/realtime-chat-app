const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // A token can be validly signed yet belong to an account that no longer
    // exists (e.g. deleted after the token was issued, but before its natural
    // 7-day expiry). Checking here closes that gap immediately rather than
    // relying on expiry alone.
    const user = await User.findById(payload.id).select('_id username');
    if (!user) {
      return res.status(401).json({ error: 'This account no longer exists' });
    }

    req.user = { id: user._id.toString(), username: user.username };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };
