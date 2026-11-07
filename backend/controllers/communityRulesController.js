const User = require("../models/User");

const getCommunityRulesStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("communityRulesAcceptedAt").lean();
    if (!user) return res.status(404).json({ message: "Compte introuvable." });
    return res.json({ accepted: Boolean(user.communityRulesAcceptedAt), acceptedAt: user.communityRulesAcceptedAt || null });
  } catch (error) {
    return res.status(500).json({ message: "Impossible de vérifier les règles." });
  }
};

const acceptCommunityRules = async (req, res) => {
  if (req.body?.accepted !== true) return res.status(400).json({ message: "Confirme ton acceptation des règles." });
  try {
    const acceptedAt = new Date();
    const user = await User.findByIdAndUpdate(req.user.userId, { $set: {
      communityRulesAcceptedAt: acceptedAt,
      termsAcceptedAt: acceptedAt,
      privacyAcknowledgedAt: acceptedAt
    } }, { new: true }).select("communityRulesAcceptedAt termsAcceptedAt privacyAcknowledgedAt");
    if (!user) return res.status(404).json({ message: "Compte introuvable." });
    return res.json({ accepted: true, acceptedAt: user.communityRulesAcceptedAt });
  } catch (error) {
    return res.status(500).json({ message: "Impossible d’enregistrer ton acceptation." });
  }
};

module.exports = { getCommunityRulesStatus, acceptCommunityRules };
