const AccountAppeal = require("../models/AccountAppeal");
const User = require("../models/User");

const getMyAccountAppeals = async (req, res) => {
  try {
    const [user, appeals] = await Promise.all([
      User.findById(req.user.userId).select("accountStatus suspensionReason suspendedAt suspendedUntil").lean(),
      AccountAppeal.find({ user: req.user.userId }).sort({ submittedAt: -1 }).limit(5).lean()
    ]);
    if (!user) return res.status(404).json({ message: "Compte introuvable." });
    return res.json({ account: user, appeals });
  } catch (error) {
    console.error("Historique des recours inaccessible :", error.message);
    return res.status(500).json({ message: "Impossible de charger le recours." });
  }
};

const submitAccountAppeal = async (req, res) => {
  const reason = String(req.body?.reason || "").trim();
  if (reason.length < 30 || reason.length > 2000) {
    return res.status(400).json({ message: "Explique ta demande en 30 à 2 000 caractères." });
  }
  try {
    const user = await User.findById(req.user.userId).select("accountStatus suspendedUntil");
    if (!user) return res.status(404).json({ message: "Compte introuvable." });
    const suspended = user.accountStatus === "suspended" && (!user.suspendedUntil || user.suspendedUntil > new Date());
    if (!suspended) return res.status(409).json({ message: "Ce compte n’est plus suspendu." });

    const pending = await AccountAppeal.findOne({ user: user._id, status: "pending" }).select("_id");
    if (pending) return res.status(409).json({ message: "Un recours est déjà en attente." });
    const recent = await AccountAppeal.exists({ user: user._id, submittedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } });
    if (recent) return res.status(429).json({ message: "Tu pourras envoyer un nouveau recours après sept jours." });

    const appeal = await AccountAppeal.create({ user: user._id, reason });
    return res.status(201).json({ appeal: { _id: appeal._id, reason: appeal.reason, status: appeal.status, submittedAt: appeal.submittedAt } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Un recours est déjà en attente." });
    console.error("Envoi du recours impossible :", error.message);
    return res.status(500).json({ message: "Impossible d’envoyer le recours." });
  }
};

module.exports = { getMyAccountAppeals, submitAccountAppeal };
