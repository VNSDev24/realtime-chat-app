const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    senderName: {
      type: String,
      required: true
    },
    text: {
      type: String,
      required: true,
      maxlength: 2000
    },
    // Set to true when the sender soft-deletes this message. `text` is
    // overwritten with a placeholder at that point; the row itself is kept.
    deleted: {
      type: Boolean,
      default: false
    },
    // Set to true after the sender edits this message's text at least once.
    edited: {
      type: Boolean,
      default: false
    },
    // Reactions: one entry per distinct emoji used on this message, each
    // holding the list of user IDs who reacted with it. Toggling the same
    // emoji again removes that user from the list rather than adding a duplicate.
    reactions: [{
      emoji: { type: String, required: true },
      users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    }],
    // Quote-reply: an optional reference to the message being replied to.
    // Kept as just an ID reference — the referenced message's sender/text
    // snippet is looked up and attached when messages are fetched, so an
    // edit/delete of the original is always reflected in the quoted preview
    // rather than freezing a stale copy of it.
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null
    },
    // Users @mentioned in this message's text, parsed server-side at send
    // time from @username patterns matched against real usernames.
    mentions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  { timestamps: true }
);

// Fast retrieval of the most recent messages for a room
messageSchema.index({ room: 1, createdAt: -1 });

// Text index for in-room keyword search (Section 6). Scoped per-room at
// query time via an additional filter — this index just makes the keyword
// matching itself efficient rather than scanning every message's text.
messageSchema.index({ text: 'text' });

module.exports = mongoose.model('Message', messageSchema);
