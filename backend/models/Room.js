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
    // Users who have asked to join but haven't been approved/denied yet.
    // A denial simply removes the user from this array — it is not a
    // permanent ban, so they are free to request again later.
    pendingRequests: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Room', roomSchema);
