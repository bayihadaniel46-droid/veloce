const mongoose = require("mongoose");
const User = require("../models/User");
const Post = require("../models/Post");
const Clan = require("../models/Clan");
const ContentReport = require("../models/ContentReport");
const UserReport = require("../models/UserReport");
const PizTransaction = require("../models/PizTransaction");

const getPage = (req) => Math.max(1, Number.parseInt(req.query.page, 10) || 1);
const getLimit = (req) => Math.min(50, Math.max(5, Number.parseInt(req.query.limit, 10) || 20));
const getSearch = (req) => String(req.query.q || "").trim().slice(0, 80);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const paginatedResponse = (items, total, page, limit) => ({
  items,
  pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
});

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

const listMembers = async (req, res) => {
  try {
    const page = getPage(req);
    const limit = getLimit(req);
    const query = getSearch(req);
    const filter = query ? { username: { $regex: escapeRegex(query), $options: "i" } } : {};
    const [members, total] = await Promise.all([
      User.find(filter).select("username avatar bio createdAt activeSeconds").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter)
    ]);
    return res.json(paginatedResponse(members, total, page, limit));
  } catch (error) {
    console.error("Liste des membres inaccessible :", error.message);
    return res.status(500).json({ message: "Impossible de charger les membres." });
  }
};

const listPosts = async (req, res) => {
  try {
    const page = getPage(req);
    const limit = getLimit(req);
    const query = getSearch(req);
    const search = query ? escapeRegex(query) : "";
    const filter = search ? { $or: [{ content: { $regex: search, $options: "i" } }, { username: { $regex: search, $options: "i" } }] } : {};
    const [posts, total] = await Promise.all([
      Post.find(filter).select("username content attachments likes comments reposts createdAt author").populate("author", "username avatar").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Post.countDocuments(filter)
    ]);
    const items = posts.map((post) => ({
      ...post,
      preview: String(post.content || "").slice(0, 480),
      attachmentCount: Array.isArray(post.attachments) ? post.attachments.length : 0
    }));
    return res.json(paginatedResponse(items, total, page, limit));
  } catch (error) {
    console.error("Liste des publications inaccessible :", error.message);
    return res.status(500).json({ message: "Impossible de charger les publications." });
  }
};

const listClans = async (req, res) => {
  try {
    const page = getPage(req);
    const limit = getLimit(req);
    const query = getSearch(req);
    const search = query ? escapeRegex(query) : "";
    const filter = search ? { $or: [{ name: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }] } : {};
    const [clans, total] = await Promise.all([
      Clan.find(filter).select("name description owner members membershipPolicy createdAt").populate("owner", "username").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Clan.countDocuments(filter)
    ]);
    const items = clans.map(({ members = [], ...clan }) => ({ ...clan, memberCount: members.length }));
    return res.json(paginatedResponse(items, total, page, limit));
  } catch (error) {
    console.error("Liste des clans inaccessible :", error.message);
    return res.status(500).json({ message: "Impossible de charger les clans." });
  }
};

const listPizTransactions = async (req, res) => {
  try {
    const page = getPage(req);
    const limit = getLimit(req);
    const query = getSearch(req);
    const filter = {};
    if (["completed", "failed", "pending"].includes(req.query.status)) {
      filter.status = req.query.status;
      const periodDays = req.query.status === "completed" ? 30 : req.query.status === "failed" ? 7 : 0;
      if (periodDays) filter.createdAt = { $gte: new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000) };
    }
    if (query) {
      const search = escapeRegex(query);
      filter.$or = [{ type: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }];
    }
    const [transactions, total] = await Promise.all([
      PizTransaction.find(filter)
        .select("type fromUser toUser fromClan toClan amountUnits platformUnits description status createdAt")
        .populate("fromUser", "username")
        .populate("toUser", "username")
        .populate("fromClan", "name")
        .populate("toClan", "name")
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      PizTransaction.countDocuments(filter)
    ]);
    const items = transactions.map((transaction) => ({
      ...transaction,
      amount: Number((Number(transaction.amountUnits || 0) / 1_000_000).toFixed(3))
    }));
    return res.json(paginatedResponse(items, total, page, limit));
  } catch (error) {
    console.error("Mouvements Piz inaccessibles :", error.message);
    return res.status(500).json({ message: "Impossible de charger les mouvements Piz." });
  }
};

module.exports = { getAdminOverview, listMembers, listPosts, listClans, listPizTransactions };
