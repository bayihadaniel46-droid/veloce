const mongoose = require("mongoose");
const User = require("../models/User");
const UserReport = require("../models/UserReport");

const listBlockedUsers = async (req, res) => {
  try {
    const current = await User.findById(req.user.userId).select("blockedUsers").populate("blockedUsers", "username avatar");
    if (!current) return res.status(404).json({ message: "Compte introuvable." });
    return res.json({ users: current.blockedUsers || [] });
  } catch (error) {
    console.error("Liste des comptes bloqués :", error.message);
    return res.status(500).json({ message: "Impossible de charger les comptes bloqués." });
  }
};

const setUserBlocked = async (req, res) => {
  const userId = String(req.params.userId || "");
  const currentId = String(req.user.userId);
  if (!mongoose.isValidObjectId(userId) || userId === currentId) return res.status(400).json({ message: "Compte à bloquer invalide." });
  try {
    const target = await User.findById(userId).select("_id username avatar");
    if (!target) return res.status(404).json({ message: "Ce compte n’existe plus." });
    await User.updateOne({ _id: currentId }, { $addToSet: { blockedUsers: target._id } });
    return res.json({ blocked: true, user: target });
  } catch (error) {
    console.error("Blocage d’un compte :", error.message);
    return res.status(500).json({ message: "Impossible de bloquer ce compte." });
  }
};

const removeUserBlock = async (req, res) => {
  const userId = String(req.params.userId || "");
  if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Compte à débloquer invalide." });
  try {
    await User.updateOne({ _id: req.user.userId }, { $pull: { blockedUsers: userId } });
    return res.json({ blocked: false });
  } catch (error) {
    console.error("Déblocage d’un compte :", error.message);
    return res.status(500).json({ message: "Impossible de débloquer ce compte." });
  }
};

const reportUser = async (req, res) => {
  const reportedUser = String(req.params.userId || "");
  const reporter = String(req.user.userId);
  const categories = ["harassment", "spam", "impersonation", "inappropriate", "other"];
  const category = String(req.body?.category || "");
  const details = String(req.body?.details || "").trim().slice(0, 800);
  if (!mongoose.isValidObjectId(reportedUser) || reportedUser === reporter) return res.status(400).json({ message: "Compte à signaler invalide." });
  if (!categories.includes(category)) return res.status(400).json({ message: "Choisis un motif de signalement." });
  try {
    if (!await User.exists({ _id: reportedUser })) return res.status(404).json({ message: "Ce compte n’existe plus." });
    const recentReport = await UserReport.exists({ reporter, reportedUser, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
    if (recentReport) return res.status(409).json({ message: "Tu as déjà signalé ce compte récemment. L’équipe pourra examiner le premier signalement." });
    const report = await UserReport.create({ reporter, reportedUser, category, details });
    return res.status(201).json({ submitted: true, reportId: String(report._id) });
  } catch (error) {
    console.error("Signalement d’un compte :", error.message);
    return res.status(500).json({ message: "Impossible d’envoyer ce signalement." });
  }
};

module.exports = { listBlockedUsers, setUserBlocked, removeUserBlock, reportUser };
