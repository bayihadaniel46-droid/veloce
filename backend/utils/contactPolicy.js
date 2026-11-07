const User = require("../models/User");

const getBlockedContactIds = async (userId) => {
  const [current, blockingCurrent] = await Promise.all([
    User.findById(userId).select("blockedUsers").lean(),
    User.find({ blockedUsers: userId }).select("_id").lean()
  ]);
  return new Set([
    ...(current?.blockedUsers || []).map(String),
    ...blockingCurrent.map((user) => String(user._id))
  ]);
};

const isContactBlocked = async (userId, otherUserId) => {
  if (String(userId) === String(otherUserId)) return false;
  const blockedIds = await getBlockedContactIds(userId);
  return blockedIds.has(String(otherUserId));
};

module.exports = { getBlockedContactIds, isContactBlocked };
