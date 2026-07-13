const rateLimit = require('express-rate-limit');

// ----------------------------------------------------------------------------
// Rate limiting design notes (worth reading before adjusting these numbers):
//
// - These use express-rate-limit's default IN-MEMORY store. That's a deliberate
//   choice, not an oversight: this app runs as a single Render backend
//   instance (no horizontal scaling), so an in-memory counter is sufficient —
//   there's no second instance for counts to be inconsistent across.
// - One real limitation: in-memory counters reset to zero whenever the backend
//   process restarts (e.g. Render's free-tier "cold start" after ~15 minutes
//   of inactivity). This means a determined attacker could reset the clock on
//   these limits by simply waiting for a natural sleep/wake cycle. That's an
//   accepted trade-off for a project at this stage, not something masked or
//   ignored — a persistent (e.g. DB-backed) rate limit store would be the
//   fix if this app ever needed to resist a more determined attacker.
// ----------------------------------------------------------------------------

// Strict limiter for login/register — this is where brute-forcing actually matters.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts from this network. Please try again in a few minutes.' }
});

// Moderate limiter for general authenticated API traffic (rooms, messages, users).
// Deliberately generous: normal usage patterns (sending messages, switching rooms,
// checking presence) should never realistically hit this — it exists to blunt
// abusive/scripted traffic, not to throttle real users.
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300, // 300 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again shortly.' }
});

module.exports = { authLimiter, generalApiLimiter };
