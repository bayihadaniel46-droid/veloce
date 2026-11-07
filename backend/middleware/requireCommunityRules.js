const User = require("../models/User");

const requireCommunityRules = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select("communityRulesAcceptedAt").lean();
    if (!user) return res.status(401).json({ message: "Compte introuvable. Reconnecte-toi." });
    if (!user.communityRulesAcceptedAt) {
      return res.status(428).json({ message: "Lis puis accepte les règles de la communauté dans Paramètres avant de publier." });
    }
    return next();
  } catch (error) {
    console.error("Vérification des règles communautaires impossible :", error.message);
    return res.status(500).json({ message: "Impossible de vérifier l’acceptation des règles." });
  }
};

module.exports = requireCommunityRules;
