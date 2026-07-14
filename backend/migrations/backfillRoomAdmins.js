const Room = require('../models/Room');

// Backfills rooms created BEFORE the admin-roles feature existed. Those rooms
// have an empty `admins` array, which (before this bug was fixed) silently
// locked the creator out of every admin-gated action on their own room.
//
// This is safe to run every time the server starts: it only touches rooms
// where the creator is missing from `admins` or `members`, and is a no-op
// for every room created after the feature shipped (which already has the
// creator set correctly at creation time).
async function backfillRoomAdmins() {
  const rooms = await Room.find({ createdBy: { $ne: null } });
  let fixedCount = 0;

  for (const room of rooms) {
    let changed = false;

    const creatorId = room.createdBy.toString();
    const hasAdmin = room.admins.some((a) => a.toString() === creatorId);
    const hasMember = room.members.some((m) => m.toString() === creatorId);

    if (!hasAdmin) {
      room.admins.push(room.createdBy);
      changed = true;
    }
    if (!hasMember) {
      room.members.push(room.createdBy);
      changed = true;
    }

    if (changed) {
      await room.save();
      fixedCount += 1;
    }
  }

  if (fixedCount > 0) {
    console.log(`[migration] Backfilled creator admin/member status on ${fixedCount} room(s)`);
  }
}

module.exports = { backfillRoomAdmins };
