const User = require("../models/User");
const AdminAuditLog = require("../models/AdminAuditLog");

const recordAdminAction = async ({ actorId, action, targetType, targetId = "", targetLabel = "", reason = "", details = {} }) => {
  try {
    const actor = await User.findById(actorId).select("username").lean();
    await AdminAuditLog.create({
      actor: actorId,
      actorUsername: actor?.username || "Administrateur",
      action,
      targetType,
      targetId: String(targetId || "").slice(0, 80),
      targetLabel: String(targetLabel || "").slice(0, 140),
      reason: String(reason || "").slice(0, 1000),
      details
    });
    return true;
  } catch (error) {
    console.error("Journal d’administration indisponible :", error.message);
    return false;
  }
};

module.exports = { recordAdminAction };
