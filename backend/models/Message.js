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
    }
  },
  { timestamps: true }
);

// Fast retrieval of the most recent messages for a room
messageSchema.index({ room: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
