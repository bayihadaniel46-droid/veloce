const mongoose = require("mongoose");
const User = require("../models/User");
const Post = require("../models/Post");
const Clan = require("../models/Clan");
const ContentReport = require("../models/ContentReport");
const UserReport = require("../models/UserReport");
const PizTransaction = require("../models/PizTransaction");

const getAdminOverview = async (_req, res) => {
  try {
    const now = Date.now();
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const pending = { $in: ["open", "reviewing"] };

    const [members, newMembers30d, posts, clans, contentReports, accountReports, pizMovements30d, failedPizMovements7d] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ createdAt: { $gte: monthAgo } }),
      Post.countDocuments({}),
      Clan.countDocuments({}),
      ContentReport.countDocuments({ status: pending }),
      UserReport.countDocuments({ status: pending }),
      PizTransaction.countDocuments({ status: "completed", createdAt: { $gte: monthAgo } }),
      PizTransaction.countDocuments({ status: "failed", createdAt: { $gte: weekAgo } })
    ]);

    return res.json({
      stats: {
        members,
        newMembers30d,
        posts,
        clans,
        contentReports,
        accountReports,
        pizMovements30d,
        failedPizMovements7d
      },
      database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Vue d’administration indisponible :", error.message);
    return res.status(500).json({ message: "Impossible de charger le tableau de bord administratif." });
  }
};

module.exports = { getAdminOverview };
