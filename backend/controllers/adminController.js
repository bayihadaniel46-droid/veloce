const mongoose = require("mongoose");
const User = require("../models/User");
const Post = require("../models/Post");
const Clan = require("../models/Clan");
const ContentReport = require("../models/ContentReport");
const UserReport = require("../models/UserReport");
const PizTransaction = require("../models/PizTransaction");
const AccountAppeal = require("../models/AccountAppeal");
const AdminAuditLog = require("../models/AdminAuditLog");
const { isVeloceAdmin } = require("../utils/adminAccess");
const { recordAdminAction } = require("../utils/adminAudit");

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

    const [members, newMembers30d, posts, clans, contentReports, accountReports, pizMovements30d, failedPizMovements7d, pendingAppeals, adminActions30d] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ createdAt: { $gte: monthAgo } }),
      Post.countDocuments({}),
      Clan.countDocuments({}),
      ContentReport.countDocuments({ status: pending }),
      UserReport.countDocuments({ status: pending }),
      PizTransaction.countDocuments({ status: "completed", createdAt: { $gte: monthAgo } }),
      PizTransaction.countDocuments({ status: "failed", createdAt: { $gte: weekAgo } }),
      AccountAppeal.countDocuments({ status: "pending" }),
      AdminAuditLog.countDocuments({ createdAt: { $gte: monthAgo } })
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
        failedPizMovements7d,
        pendingAppeals,
        adminActions30d
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
    const clauses = [];
    if (query) clauses.push({ username: { $regex: escapeRegex(query), $options: "i" } });
    if (req.query.status === "suspended") clauses.push({
      accountStatus: "suspended",
      $or: [{ suspendedUntil: null }, { suspendedUntil: { $gt: new Date() } }]
    });
    if (req.query.status === "active") clauses.push({ $or: [{ accountStatus: "active" }, { accountStatus: { $exists: false } }] });
    const filter = clauses.length ? { $and: clauses } : {};
    const [members, total] = await Promise.all([
      User.find(filter).select("username avatar bio createdAt activeSeconds accountStatus suspensionReason suspendedAt suspendedUntil").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter)
    ]);
    const now = new Date();
    const items = members.map((member) => ({
      ...member,
      accountStatus: member.accountStatus === "suspended" && (!member.suspendedUntil || member.suspendedUntil > now) ? "suspended" : "active",
      isAdmin: isVeloceAdmin(member._id)
    }));
    return res.json(paginatedResponse(items, total, page, limit));
  } catch (error) {
    console.error("Liste des membres inaccessible :", error.message);
    return res.status(500).json({ message: "Impossible de charger les membres." });
  }
};

const suspendMember = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) return res.status(404).json({ message: "Membre introuvable." });
  const duration = String(req.body?.duration || "");
  const reason = String(req.body?.reason || "").trim();
  const durationHours = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };
  if (!Object.prototype.hasOwnProperty.call(durationHours, duration) && duration !== "permanent") return res.status(400).json({ message: "Choisis une durée de suspension valide." });
  if (reason.length < 10 || reason.length > 1000) return res.status(400).json({ message: "Le motif doit contenir entre 10 et 1 000 caractères." });
  if (String(req.user.userId) === String(req.params.userId)) return res.status(409).json({ message: "Tu ne peux pas suspendre ton propre compte administrateur." });
  if (isVeloceAdmin(req.params.userId)) return res.status(409).json({ message: "Un compte administrateur ne peut pas être suspendu depuis ce panneau." });
  try {
    const member = await User.findById(req.params.userId).select("username accountStatus suspendedUntil");
    if (!member) return res.status(404).json({ message: "Membre introuvable." });
    if (member.accountStatus === "suspended" && (!member.suspendedUntil || member.suspendedUntil > new Date())) return res.status(409).json({ message: "Ce membre est déjà suspendu." });
    const suspendedAt = new Date();
    const suspendedUntil = duration === "permanent" ? null : new Date(suspendedAt.getTime() + durationHours[duration] * 60 * 60 * 1000);
    member.accountStatus = "suspended";
    member.suspensionReason = reason;
    member.suspendedAt = suspendedAt;
    member.suspendedUntil = suspendedUntil;
    member.suspendedBy = req.user.userId;
    await member.save();
    await recordAdminAction({ actorId: req.user.userId, action: "member.suspended", targetType: "user", targetId: member._id, targetLabel: `@${member.username}`, reason, details: { duration, suspendedUntil } });
    return res.json({ member: { _id: member._id, username: member.username, accountStatus: member.accountStatus, suspensionReason: member.suspensionReason, suspendedAt, suspendedUntil } });
  } catch (error) {
    console.error("Suspension du compte impossible :", error.message);
    return res.status(500).json({ message: "Impossible de suspendre ce compte." });
  }
};

const restoreMember = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) return res.status(404).json({ message: "Membre introuvable." });
  try {
    const member = await User.findById(req.params.userId).select("username accountStatus suspensionReason");
    if (!member) return res.status(404).json({ message: "Membre introuvable." });
    if (member.accountStatus !== "suspended") return res.status(409).json({ message: "Ce compte est déjà actif." });
    const previousReason = member.suspensionReason;
    member.accountStatus = "active";
    member.suspensionReason = "";
    member.suspendedAt = null;
    member.suspendedUntil = null;
    member.suspendedBy = null;
    await member.save();
    await recordAdminAction({ actorId: req.user.userId, action: "member.restored", targetType: "user", targetId: member._id, targetLabel: `@${member.username}`, reason: "Rétablissement du compte", details: { previousSuspensionReason: previousReason } });
    return res.json({ member: { _id: member._id, username: member.username, accountStatus: member.accountStatus } });
  } catch (error) {
    console.error("Rétablissement du compte impossible :", error.message);
    return res.status(500).json({ message: "Impossible de rétablir ce compte." });
  }
};

const listAccountAppeals = async (req, res) => {
  try {
    const page = getPage(req);
    const limit = getLimit(req);
    const filter = req.query.status === "all" ? {} : { status: "pending" };
    const query = getSearch(req);
    if (query) {
      const search = escapeRegex(query);
      const matchingUsers = await User.find({ username: { $regex: search, $options: "i" } }).select("_id").limit(100).lean();
      filter.$or = [{ reason: { $regex: search, $options: "i" } }, { user: { $in: matchingUsers.map((member) => member._id) } }];
    }
    const [appeals, total] = await Promise.all([
      AccountAppeal.find(filter).populate("user", "username avatar accountStatus suspensionReason suspendedUntil").populate("reviewedBy", "username").sort({ submittedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AccountAppeal.countDocuments(filter)
    ]);
    return res.json(paginatedResponse(appeals, total, page, limit));
  } catch (error) {
    console.error("Recours de compte inaccessibles :", error.message);
    return res.status(500).json({ message: "Impossible de charger les recours." });
  }
};

const reviewAccountAppeal = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.appealId)) return res.status(404).json({ message: "Recours introuvable." });
  const decision = String(req.body?.decision || "");
  const decisionNote = String(req.body?.decisionNote || "").trim().slice(0, 1000);
  if (!["accepted", "rejected"].includes(decision)) return res.status(400).json({ message: "Décision invalide." });
  if (decisionNote.length < 10) return res.status(400).json({ message: "Ajoute une justification d’au moins 10 caractères." });
  try {
    const appeal = await AccountAppeal.findById(req.params.appealId).populate("user", "username accountStatus suspensionReason");
    if (!appeal) return res.status(404).json({ message: "Recours introuvable." });
    if (appeal.status !== "pending") return res.status(409).json({ message: "Ce recours a déjà été traité." });
    if (decision === "accepted" && appeal.user) {
      await User.updateOne({ _id: appeal.user._id }, { $set: { accountStatus: "active", suspensionReason: "", suspendedAt: null, suspendedUntil: null, suspendedBy: null } });
    }
    appeal.status = decision;
    appeal.reviewedAt = new Date();
    appeal.reviewedBy = req.user.userId;
    appeal.decisionNote = decisionNote;
    await appeal.save();
    await recordAdminAction({ actorId: req.user.userId, action: `appeal.${decision}`, targetType: "account-appeal", targetId: appeal._id, targetLabel: `@${appeal.user?.username || "compte indisponible"}`, reason: decisionNote, details: { accountId: appeal.user?._id ? String(appeal.user._id) : "" } });
    return res.json({ appeal: { _id: appeal._id, status: appeal.status, reviewedAt: appeal.reviewedAt, decisionNote: appeal.decisionNote } });
  } catch (error) {
    console.error("Décision du recours impossible :", error.message);
    return res.status(500).json({ message: "Impossible de traiter ce recours." });
  }
};

const listAdminAuditLog = async (req, res) => {
  try {
    const page = getPage(req);
    const limit = getLimit(req);
    const query = getSearch(req);
    const search = query ? escapeRegex(query) : "";
    const filter = search ? { $or: [{ action: { $regex: search, $options: "i" } }, { targetLabel: { $regex: search, $options: "i" } }, { reason: { $regex: search, $options: "i" } }] } : {};
    const [logs, total] = await Promise.all([
      AdminAuditLog.find(filter).populate("actor", "username").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AdminAuditLog.countDocuments(filter)
    ]);
    return res.json(paginatedResponse(logs, total, page, limit));
  } catch (error) {
    console.error("Journal d’administration inaccessible :", error.message);
    return res.status(500).json({ message: "Impossible de charger le journal." });
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

module.exports = {
  getAdminOverview,
  listMembers,
  listPosts,
  listClans,
  listPizTransactions,
  suspendMember,
  restoreMember,
  listAccountAppeals,
  reviewAccountAppeal,
  listAdminAuditLog
};
