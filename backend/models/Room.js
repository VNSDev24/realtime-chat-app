const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 2,
      maxlength: 40
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200,
      default: ''
    },
    // Room admins — the creator is automatically included here at creation
    // and can never be removed from this array by anyone (enforced in the
    // route handlers, not the schema). Any admin may promote a new admin or
    // demote another non-creator admin.
    admins: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    // If true, users must be approved by the creator before they can view
    // messages in or join this room. Off by default so existing rooms (and
    // the default behavior for new rooms) are unaffected.
    isRestricted: {
      type: Boolean,
      default: false
    },
    // Approved members. Only meaningful when isRestricted is true — for open
    // rooms, membership isn't checked anywhere, so this stays unused.
    members: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    // Users blocked by an admin from this room. Applies regardless of
    // isRestricted — blocking is a per-user override that works the same way
    // on open rooms as on restricted ones. Reversible (see the unblock route).
    blockedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    // Users who have asked to join but haven't been approved/denied yet.
    // A denial simply removes the user from this array — it is not a
    // permanent ban, so they are free to request again later.
    pendingRequests: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    // Pinned messages, most-recently-pinned first (managed as a simple
    // array, not a separate collection — pin counts per room are small).
    pinnedMessages: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    }]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Room', roomSchema);
