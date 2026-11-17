const idOf = (value) => String(value?._id || value || "");

const activeTemporaryMembers = (clan, now = new Date()) => (clan?.temporaryMembers || [])
  .filter((entry) => entry.expiresAt && new Date(entry.expiresAt) > now);

const hasClanAccess = (clan, userId, now = new Date()) => {
  const id = String(userId);
  if (idOf(clan?.owner) === id) return true;
  if ((clan?.members || []).some((member) => idOf(member) === id)) return true;
  if ([...(clan?.administrators || []), ...(clan?.moderators || [])].some((member) => idOf(member) === id)) return true;
  return activeTemporaryMembers(clan, now).some((entry) => idOf(entry.user) === id);
};

const activeClanMemberCount = (clan, now = new Date()) => {
  const permanentIds = new Set((clan?.members || []).map(idOf));
  if (clan?.owner) permanentIds.add(idOf(clan.owner));
  const activeGuests = activeTemporaryMembers(clan, now).filter((entry) => !permanentIds.has(idOf(entry.user)));
  return permanentIds.size + new Set(activeGuests.map((entry) => idOf(entry.user))).size;
};

const clanAccessFilter = (userId, now = new Date()) => ({
  $or: [
    { owner: userId },
    { members: userId },
    { administrators: userId },
    { moderators: userId },
    { temporaryMembers: { $elemMatch: { user: userId, expiresAt: { $gt: now } } } }
  ]
});

module.exports = { idOf, activeTemporaryMembers, hasClanAccess, activeClanMemberCount, clanAccessFilter };
