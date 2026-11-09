const mongoose = require("mongoose");
const ContentReport = require("../models/ContentReport");
const UserReport = require("../models/UserReport");
const Post = require("../models/Post");
const Comment = require("../models/comment");
const CarrefourItem = require("../models/CarrefourItem");
const Message = require("../models/Message");
const ClanMessage = require("../models/ClanMessage");
const CommunityMessage = require("../models/CommunityMessage");
const Clan = require("../models/Clan");
const { PRIVATE_BUCKET_NAME } = require("../utils/messageAttachments");
const { isVeloceModerator } = require("../utils/adminAccess");

const reportableModels = {
  post: { Model: Post, ownerField: "author" },
  comment: { Model: Comment, ownerField: "userId" },
  carrefour: { Model: CarrefourItem, ownerField: "author" },
  message: { Model: Message, ownerField: "sender" },
  "clan-message": { Model: ClanMessage, ownerField: "sender" },
  "community-message": { Model: CommunityMessage, ownerField: "sender" }
};

const deleteGridFsAttachments = async (bucketName, attachments = []) => {
  const fileIds = [...new Map(attachments.map((item) => [String(item.fileId), item.fileId]).filter(([id, value]) => id && value)).values()];
  if (!fileIds.length || !mongoose.connection.db) return;
  const files = await mongoose.connection.db.collection(`${bucketName}.files`).find({ _id: { $in: fileIds } }, { projection: { _id: 1 } }).toArray();
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName });
  await Promise.all(files.map((file) => bucket.delete(file._id)));
};

const submitContentReport = async (req, res) => {
  const contentType = String(req.body?.contentType || "");
  const contentId = String(req.body?.contentId || "");
  const category = String(req.body?.category || "");
  const details = String(req.body?.details || "").trim().slice(0, 800);
  const categories = ["harassment", "hate", "sexual", "violence", "spam", "fraud", "privacy", "other"];
  const definition = reportableModels[contentType];
  if (!definition || !mongoose.isValidObjectId(contentId)) return res.status(400).json({ message: "Contenu à signaler invalide." });
  if (!categories.includes(category)) return res.status(400).json({ message: "Choisis un motif de signalement." });

  try {
    const content = await definition.Model.findById(contentId).select(`${definition.ownerField} clan recipient sender`).lean();
    if (!content) return res.status(404).json({ message: "Ce contenu n’existe plus." });
    const reporterId = String(req.user.userId);
    if (contentType === "message" && ![String(content.sender), String(content.recipient)].includes(reporterId)) {
      return res.status(403).json({ message: "Seuls les participants à cette conversation peuvent signaler ce message." });
    }
    if (contentType === "clan-message") {
      const member = await Clan.exists({ _id: content.clan, $or: [
        { owner: req.user.userId },
        { members: req.user.userId },
        { administrators: req.user.userId },
        { moderators: req.user.userId }
      ] });
      if (!member) return res.status(403).json({ message: "Ce message n’est pas accessible à ton compte." });
    }
    const recent = await ContentReport.exists({ reporter: req.user.userId, contentType, contentId, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
    if (recent) return res.status(409).json({ message: "Tu as déjà signalé ce contenu récemment." });
    const report = await ContentReport.create({ reporter: req.user.userId, contentType, contentId, contentOwner: content[definition.ownerField] || null, category, details });
    return res.status(201).json({ submitted: true, reportId: String(report._id) });
  } catch (error) {
    console.error("Signalement de contenu impossible :", error.message);
    return res.status(500).json({ message: "Impossible d’envoyer ce signalement." });
  }
};

const listContentReports = async (req, res) => {
  if (!isVeloceModerator(req.user.userId)) return res.status(403).json({ message: "Accès réservé à l’équipe de modération." });
  try {
    const [rawReports, accountReports] = await Promise.all([
      ContentReport.find({ status: { $in: ["open", "reviewing"] } })
        .populate("reporter", "username")
        .populate("contentOwner", "username")
        .sort({ createdAt: 1 }).limit(200).lean(),
      UserReport.find({ status: { $in: ["open", "reviewing"] } })
        .populate("reporter", "username")
        .populate("reportedUser", "username")
        .sort({ createdAt: 1 }).limit(100).lean()
    ]);
    const contentQueue = await Promise.all(rawReports.map(async (report) => {
      const definition = reportableModels[report.contentType];
      const content = definition ? await definition.Model.findById(report.contentId).select("content").lean() : null;
      return { ...report, moderationType: "content", preview: content?.content ? String(content.content).slice(0, 360) : "Contenu indisponible ou média" };
    }));
    const accountQueue = accountReports.map((report) => ({
      ...report,
      moderationType: "account",
      contentType: "account",
      contentOwner: report.reportedUser,
      preview: report.details || "Signalement du compte"
    }));
    const reports = [...contentQueue, ...accountQueue].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return res.json({ reports });
  } catch (error) {
    console.error("File de modération inaccessible :", error.message);
    return res.status(500).json({ message: "Impossible de charger la file de modération." });
  }
};

const reviewContentReport = async (req, res) => {
  if (!isVeloceModerator(req.user.userId)) return res.status(403).json({ message: "Accès réservé à l’équipe de modération." });
  if (!mongoose.isValidObjectId(req.params.reportId)) return res.status(404).json({ message: "Signalement introuvable." });
  const { status, action, moderationType = "content" } = req.body || {};
  if (!["reviewing", "resolved"].includes(status) || ![undefined, "keep", "remove"].includes(action)) {
    return res.status(400).json({ message: "Décision de modération invalide." });
  }
  try {
    if (moderationType === "account") {
      if (action === "remove") return res.status(400).json({ message: "Un signalement de compte ne peut pas supprimer directement le compte." });
      const accountReport = await UserReport.findById(req.params.reportId);
      if (!accountReport) return res.status(404).json({ message: "Signalement introuvable." });
      accountReport.status = status;
      await accountReport.save();
      return res.json({ report: accountReport, moderationType: "account" });
    }
    if (moderationType !== "content") return res.status(400).json({ message: "Type de signalement invalide." });
    const report = await ContentReport.findById(req.params.reportId);
    if (!report) return res.status(404).json({ message: "Signalement introuvable." });
    if (action === "remove") {
      const definition = reportableModels[report.contentType];
      const target = definition ? await definition.Model.findById(report.contentId).select("attachments postId") : null;
      if (target?.attachments?.length) {
        const bucketName = report.contentType === "post" ? "veloceFiles" : PRIVATE_BUCKET_NAME;
        await deleteGridFsAttachments(bucketName, target.attachments);
      }
      const deletion = definition ? await definition.Model.deleteOne({ _id: report.contentId }) : null;
      if (report.contentType === "post") {
        await Promise.all([Comment.deleteMany({ postId: report.contentId }), require("../models/Like").deleteMany({ postId: report.contentId })]);
      } else if (report.contentType === "comment" && deletion?.deletedCount) {
        await Post.updateOne({ _id: target.postId, comments: { $gt: 0 } }, { $inc: { comments: -1 } });
      }
    }
    report.status = status;
    await report.save();
    return res.json({ report });
  } catch (error) {
    console.error("Traitement d’un signalement impossible :", error.message);
    return res.status(500).json({ message: "Impossible d’enregistrer cette décision." });
  }
};

module.exports = { submitContentReport, listContentReports, reviewContentReport };
