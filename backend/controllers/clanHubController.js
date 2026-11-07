const mongoose = require("mongoose");
const Clan = require("../models/Clan");
const ClanMessage = require("../models/ClanMessage");
const ClanRating = require("../models/ClanRating");
const ClanKnowledgeDocument = require("../models/ClanKnowledgeDocument");
const ClanKnowledgePurchase = require("../models/ClanKnowledgePurchase");
const ClanAssistantKnowledge = require("../models/ClanAssistantKnowledge");
const User = require("../models/User");
const { fromUnits, toUnits, transferPizToClan, transferPizFromClan } = require("../services/pizEconomy");

const idOf = (value) => String(value?._id || value || "");
const memberOf = (clan, userId) => (clan.members || []).some((item) => idOf(item) === String(userId));
const assignedRole = (clan, userId) => (clan.rankAssignments || []).find((item) => idOf(item.user) === String(userId))?.role || "member";
const chiefOf = (clan, userId) => idOf(clan.owner) === String(userId);
const managesClan = (clan, userId) => chiefOf(clan, userId) || assignedRole(clan, userId) === "subchief" || (clan.administrators || []).some((item) => idOf(item) === String(userId));
const canPublish = (clan, userId) => managesClan(clan, userId) || assignedRole(clan, userId) === "secretary";
const rankOf = (clan, userId) => chiefOf(clan, userId) ? "chef" : assignedRole(clan, userId);
const publicDocument = (doc, unlocked, clan) => ({
  _id: doc._id,
  clan: clan ? { _id: clan._id, name: clan.name } : undefined,
  author: doc.author,
  title: doc.title,
  summary: doc.summary,
  topics: doc.topics || [],
  price: fromUnits(doc.priceUnits),
  purchaseCount: doc.purchaseCount,
  createdAt: doc.createdAt,
  unlocked,
  content: unlocked ? doc.content : undefined
});

const discoverClans = async (req, res) => {
  try {
    const clans = await Clan.find({}).select("name description owner members membershipPolicy strategy createdAt updatedAt").sort({ createdAt: -1 }).limit(200).lean();
    const ids = clans.map((clan) => clan._id);
    const [ratings, documents, assistantInfo, activity] = await Promise.all([
      ClanRating.aggregate([{ $match: { clan: { $in: ids } } }, { $group: { _id: "$clan", average: { $avg: "$rating" }, count: { $sum: 1 } } }]),
      ClanKnowledgeDocument.aggregate([{ $match: { clan: { $in: ids }, published: true } }, { $group: { _id: "$clan", count: { $sum: 1 }, purchases: { $sum: "$purchaseCount" } } }]),
      ClanAssistantKnowledge.aggregate([{ $match: { clan: { $in: ids }, published: true } }, { $group: { _id: "$clan", count: { $sum: 1 }, uses: { $sum: "$usageCount" } } }]),
      ClanMessage.aggregate([{ $match: { clan: { $in: ids }, createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } } }, { $group: { _id: "$clan", count: { $sum: 1 } } }])
    ]);
    const ratingMap = new Map(ratings.map((item) => [String(item._id), item]));
    const docMap = new Map(documents.map((item) => [String(item._id), item]));
    const assistantMap = new Map(assistantInfo.map((item) => [String(item._id), item]));
    const activityMap = new Map(activity.map((item) => [String(item._id), item.count]));
    const result = clans.map((clan) => {
      const rating = ratingMap.get(String(clan._id));
      const knowledge = docMap.get(String(clan._id));
      const assistantKnowledge = assistantMap.get(String(clan._id));
      const messages = activityMap.get(String(clan._id)) || 0;
      const members = clan.members || [];
      const knowledgeCount = (knowledge?.count || 0) + (assistantKnowledge?.count || 0);
      const knowledgeUseCount = (knowledge?.purchases || 0) + (assistantKnowledge?.uses || 0);
      const score = (rating?.average || 0) * 10 + Math.min(20, members.length / 5) + Math.min(20, messages / 10) + Math.min(20, knowledgeUseCount / 2);
      return {
        _id: clan._id,
        name: clan.name,
        description: clan.description,
        membershipPolicy: clan.membershipPolicy || "approval",
        memberCount: members.length,
        rating: rating ? Number(rating.average.toFixed(1)) : 0,
        ratingCount: rating?.count || 0,
        knowledgeCount,
        knowledgePurchases: knowledgeUseCount,
        activity30Days: messages,
        recommendationScore: Number(score.toFixed(1)),
        isMember: memberOf(clan, req.user.userId),
        hasPendingRequest: (clan.membershipRequests || []).some((item) => idOf(item.user) === String(req.user.userId) && item.status === "pending")
      };
    }).sort((a, b) => b.recommendationScore - a.recommendationScore);
    return res.json(result);
  } catch (error) {
    console.error("Erreur découverte de clans :", error);
    return res.status(500).json({ message: "Impossible de charger les clans à découvrir." });
  }
};

const requestToJoin = async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.clanId);
    if (!clan) return res.status(404).json({ message: "Clan introuvable." });
    const userId = String(req.user.userId);
    if (memberOf(clan, userId)) return res.status(409).json({ message: "Tu fais déjà partie de ce clan." });
    if (clan.members.length >= 100) return res.status(409).json({ message: "Ce clan a atteint sa limite de 100 membres." });
    const previous = clan.membershipRequests.find((item) => idOf(item.user) === userId);
    if (previous?.status === "pending") return res.status(409).json({ message: "Ta demande est déjà en attente." });
    if (clan.membershipPolicy === "open") {
      clan.members.addToSet(req.user.userId);
      if (previous) { previous.status = "approved"; previous.reviewedAt = new Date(); previous.reviewedBy = clan.owner; }
      await clan.save();
      return res.json({ joined: true, message: "Tu as rejoint le clan.", clanId: clan._id });
    }
    if (previous) { previous.status = "pending"; previous.requestedAt = new Date(); previous.reviewedAt = null; previous.reviewedBy = null; }
    else clan.membershipRequests.push({ user: req.user.userId });
    await clan.save();
    return res.status(202).json({ joined: false, pending: true, message: "Ta demande a été envoyée au chef du clan." });
  } catch (error) {
    console.error("Erreur demande d’adhésion :", error);
    return res.status(500).json({ message: "Impossible d’envoyer cette demande." });
  }
};

const listMembershipRequests = async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.clanId).populate("membershipRequests.user", "username avatar");
    if (!clan) return res.status(404).json({ message: "Clan introuvable." });
    if (!managesClan(clan, req.user.userId)) return res.sendStatus(403);
    return res.json(clan.membershipRequests.filter((item) => item.status === "pending"));
  } catch (error) {
    console.error("Erreur chargement des demandes :", error);
    return res.status(500).json({ message: "Impossible de charger les demandes." });
  }
};

const reviewMembershipRequest = async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.clanId);
    if (!clan) return res.status(404).json({ message: "Clan introuvable." });
    if (!managesClan(clan, req.user.userId)) return res.sendStatus(403);
    const request = clan.membershipRequests.find((item) => idOf(item.user) === String(req.params.userId) && item.status === "pending");
    if (!request) return res.status(404).json({ message: "Demande en attente introuvable." });
    const approve = req.body.decision === "approve";
    if (!approve && req.body.decision !== "reject") return res.status(400).json({ message: "Décision invalide." });
    if (approve && !memberOf(clan, request.user)) {
      if (clan.members.length >= 100) return res.status(409).json({ message: "Le clan a atteint sa limite." });
      clan.members.addToSet(request.user);
    }
    request.status = approve ? "approved" : "rejected";
    request.reviewedAt = new Date();
    request.reviewedBy = req.user.userId;
    await clan.save();
    return res.json({ message: approve ? "Membre accepté dans le clan." : "Demande refusée." });
  } catch (error) {
    console.error("Erreur traitement demande :", error);
    return res.status(500).json({ message: "Impossible de traiter cette demande." });
  }
};

const updateClanSettings = async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.clanId);
    if (!clan) return res.status(404).json({ message: "Clan introuvable." });
    if (!managesClan(clan, req.user.userId)) return res.sendStatus(403);
    const { membershipPolicy, strategy, policyText, contributionCaps } = req.body;
    if (membershipPolicy !== undefined) {
      if (!["open", "approval"].includes(membershipPolicy)) return res.status(400).json({ message: "Politique d’adhésion invalide." });
      clan.membershipPolicy = membershipPolicy;
    }
    if (strategy !== undefined) {
      if (typeof strategy !== "string" || strategy.length > 2000) return res.status(400).json({ message: "La stratégie ne peut dépasser 2 000 caractères." });
      clan.strategy = strategy.trim();
    }
    if (policyText !== undefined) {
      if (typeof policyText !== "string" || policyText.length > 3000) return res.status(400).json({ message: "La politique ne peut dépasser 3 000 caractères." });
      clan.policyText = policyText.trim();
    }
    if (contributionCaps !== undefined) {
      if (!contributionCaps || typeof contributionCaps !== "object" || Array.isArray(contributionCaps)) return res.status(400).json({ message: "Plafonds invalides." });
      for (const role of ["chef", "subchief", "secretary", "envoy", "member"]) {
        if (contributionCaps[role] === undefined) continue;
        const amount = Number(contributionCaps[role]);
        if (!Number.isFinite(amount) || amount < 0 || amount > 100000) return res.status(400).json({ message: "Chaque plafond doit être entre 0 et 100 000 Piz." });
        clan.contributionCaps[role] = amount;
      }
      clan.markModified("contributionCaps");
    }
    await clan.save();
    return res.json({ membershipPolicy: clan.membershipPolicy, strategy: clan.strategy, policyText: clan.policyText, contributionCaps: clan.contributionCaps, treasuryPiz: fromUnits(clan.treasuryUnits) });
  } catch (error) {
    console.error("Erreur réglages du clan :", error);
    return res.status(500).json({ message: "Impossible d’enregistrer ces réglages." });
  }
};

const assignClanRole = async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.clanId);
    if (!clan) return res.status(404).json({ message: "Clan introuvable." });
    if (!chiefOf(clan, req.user.userId)) return res.status(403).json({ message: "Seul le chef peut nommer ou retirer ces responsables." });
    const userId = String(req.body.userId || "");
    const role = String(req.body.role || "");
    if (!mongoose.isValidObjectId(userId) || !memberOf(clan, userId) || userId === idOf(clan.owner)) return res.status(400).json({ message: "Choisis un autre membre du clan." });
    if (!["subchief", "secretary", "envoy", "member"].includes(role)) return res.status(400).json({ message: "Rôle invalide." });
    clan.rankAssignments = clan.rankAssignments.filter((item) => idOf(item.user) !== userId);
    if (role !== "member") clan.rankAssignments.push({ user: userId, role });
    await clan.save();
    await clan.populate("rankAssignments.user", "username avatar");
    return res.json(clan.rankAssignments);
  } catch (error) {
    console.error("Erreur attribution du rôle :", error);
    return res.status(500).json({ message: "Impossible de modifier ce rôle." });
  }
};

const rateClan = async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.clanId).select("members");
    if (!clan) return res.status(404).json({ message: "Clan introuvable." });
    if (!memberOf(clan, req.user.userId)) return res.status(403).json({ message: "Seuls les membres peuvent noter leur clan." });
    const rating = Number(req.body.rating);
    const review = String(req.body.review || "").trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || review.length > 500) return res.status(400).json({ message: "Note ou commentaire invalide." });
    const result = await ClanRating.findOneAndUpdate({ clan: clan._id, user: req.user.userId }, { $set: { rating, review } }, { new: true, upsert: true, runValidators: true });
    return res.json(result);
  } catch (error) {
    console.error("Erreur notation du clan :", error);
    return res.status(500).json({ message: "Impossible d’enregistrer ta note." });
  }
};

const getKnowledge = async (req, res) => {
  try {
    const query = { published: true };
    if (req.params.clanId) query.clan = req.params.clanId;
    const docs = await ClanKnowledgeDocument.find(query).populate("clan", "name").populate("author", "username avatar").sort({ createdAt: -1 }).limit(200);
    const purchases = await ClanKnowledgePurchase.find({ buyer: req.user.userId, document: { $in: docs.map((item) => item._id) } }).select("document").lean();
    const owned = new Set(purchases.map((item) => String(item.document)));
    const authored = new Set(docs.filter((item) => idOf(item.author) === String(req.user.userId)).map((item) => String(item._id)));
    return res.json(docs.map((doc) => publicDocument(doc, owned.has(String(doc._id)) || authored.has(String(doc._id)), doc.clan)));
  } catch (error) {
    console.error("Erreur bibliothèque des clans :", error);
    return res.status(500).json({ message: "Impossible de charger les documents des clans." });
  }
};

const listAssistantKnowledge = async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.clanId).select("members");
    if (!clan) return res.status(404).json({ message: "Clan introuvable." });
    if (!memberOf(clan, req.user.userId)) return res.status(403).json({ message: "Cet espace est réservé aux membres du clan." });
    const items = await ClanAssistantKnowledge.find({ clan: clan._id, published: true }).populate("author", "username avatar").sort({ createdAt: -1 }).limit(200);
    return res.json(items);
  } catch (error) {
    console.error("Erreur chargement du savoir assistant :", error);
    return res.status(500).json({ message: "Impossible de charger l’espace de l’assistant." });
  }
};

const publishAssistantKnowledge = async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.clanId);
    if (!clan) return res.status(404).json({ message: "Clan introuvable." });
    if (!memberOf(clan, req.user.userId) || !canPublish(clan, req.user.userId)) return res.status(403).json({ message: "Le chef, son sous-chef et le secrétaire peuvent publier dans cet espace." });
    const topic = String(req.body.topic || "").trim().slice(0, 80);
    const title = String(req.body.title || "").trim();
    const summary = String(req.body.summary || "").trim();
    const content = String(req.body.content || "").trim();
    if (!topic || !title || title.length > 160 || !summary || summary.length > 500 || !content || content.length > 12000) return res.status(400).json({ message: "Ajoute un thème, un titre, un résumé et un contenu (12 000 caractères maximum)." });
    const item = await ClanAssistantKnowledge.create({ clan: clan._id, author: req.user.userId, topic, title, summary, content });
    await item.populate("author", "username avatar");
    return res.status(201).json(item);
  } catch (error) {
    console.error("Erreur publication dans l’espace de l’assistant :", error);
    return res.status(500).json({ message: "Impossible de publier ce savoir." });
  }
};

const createKnowledge = async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.clanId);
    if (!clan) return res.status(404).json({ message: "Clan introuvable." });
    if (!memberOf(clan, req.user.userId) || !canPublish(clan, req.user.userId)) return res.status(403).json({ message: "Le chef, son sous-chef et le secrétaire peuvent publier un document du clan." });
    const title = String(req.body.title || "").trim();
    const summary = String(req.body.summary || "").trim();
    const content = String(req.body.content || "").trim();
    const price = Number(req.body.price);
    const priceUnits = toUnits(price);
    if (!title || title.length > 120 || !summary || summary.length > 500 || !content || content.length > 20000 || !Number.isFinite(price) || price < 0.01 || price > 100000 || priceUnits < 1) return res.status(400).json({ message: "Vérifie le titre, le résumé, le contenu et le prix entre 0,01 et 100 000 Piz." });
    const doc = await ClanKnowledgeDocument.create({ clan: clan._id, author: req.user.userId, title, summary, content, priceUnits });
    return res.status(201).json(publicDocument(doc, true, clan));
  } catch (error) {
    console.error("Erreur publication document de clan :", error);
    return res.status(500).json({ message: "Impossible de publier ce document." });
  }
};

const purchaseKnowledge = async (req, res) => {
  try {
    const doc = await ClanKnowledgeDocument.findOne({ _id: req.params.documentId, published: true });
    if (!doc) return res.status(404).json({ message: "Document introuvable." });
    const existing = await ClanKnowledgePurchase.findOne({ document: doc._id, buyer: req.user.userId });
    if (!existing && idOf(doc.author) !== String(req.user.userId)) {
      await transferPizToClan({ fromUserId: req.user.userId, clanId: doc.clan, amount: fromUnits(doc.priceUnits), type: "clan-knowledge-purchase", operationId: `clan-knowledge:${doc._id}:${req.user.userId}`, description: "Achat d’un document de connaissance de clan", metadata: { clanId: String(doc.clan), documentId: String(doc._id) } });
      await ClanKnowledgePurchase.create({ document: doc._id, buyer: req.user.userId, amountUnits: doc.priceUnits });
      await ClanKnowledgeDocument.updateOne({ _id: doc._id }, { $inc: { purchaseCount: 1 } });
    }
    const clan = await Clan.findById(doc.clan).select("name");
    return res.json(publicDocument(doc, true, clan));
  } catch (error) {
    if (error.code === "PIZ_INSUFFICIENT_FUNDS") return res.status(402).json({ message: error.message });
    if (error.code === 11000) {
      const doc = await ClanKnowledgeDocument.findById(req.params.documentId).populate("clan", "name");
      return res.json(publicDocument(doc, true, doc?.clan));
    }
    console.error("Erreur achat document de clan :", error);
    return res.status(500).json({ message: "Impossible d’acheter ce document." });
  }
};

const contributeToClan = async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.clanId);
    if (!clan) return res.status(404).json({ message: "Clan introuvable." });
    if (!memberOf(clan, req.user.userId)) return res.status(403).json({ message: "Seuls les membres peuvent contribuer à la trésorerie." });
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) return res.status(400).json({ message: "Le versement doit être entre 0,01 et 100 000 Piz." });
    const role = rankOf(clan, req.user.userId);
    const cap = Number(clan.contributionCaps?.get?.(role) ?? clan.contributionCaps?.[role] ?? 0);
    if (cap <= 0) return res.status(403).json({ message: "Le chef n’a pas activé les contributions pour ton rang." });
    if (amount > cap) return res.status(400).json({ message: `Le plafond de ton rang est de ${cap} Piz par contribution.` });
    const operationId = String(req.body.operationId || "");
    if (operationId.length < 8 || operationId.length > 120) return res.status(400).json({ message: "Identifiant de versement invalide." });
    await transferPizToClan({ fromUserId: req.user.userId, clanId: clan._id, amount, type: "clan-contribution", operationId: `clan-contribution:${clan._id}:${operationId}`, description: "Contribution volontaire à la trésorerie d’un clan", metadata: { clanId: String(clan._id), userId: String(req.user.userId), role } });
    const updated = await Clan.findById(clan._id).select("treasuryUnits");
    return res.json({ treasuryPiz: fromUnits(updated.treasuryUnits) });
  } catch (error) {
    if (error.code === "PIZ_INSUFFICIENT_FUNDS") return res.status(402).json({ message: error.message });
    console.error("Erreur contribution de clan :", error);
    return res.status(500).json({ message: "Impossible de verser cette contribution." });
  }
};

const distributeClanRevenue = async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.clanId);
    if (!clan) return res.status(404).json({ message: "Clan introuvable." });
    if (!managesClan(clan, req.user.userId)) return res.status(403).json({ message: "Seul le chef ou le sous-chef peut répartir les revenus." });
    const payouts = Array.isArray(req.body.payouts) ? req.body.payouts : [];
    const batch = String(req.body.batchId || "");
    if (!batch || batch.length < 8 || batch.length > 120 || !payouts.length || payouts.length > 100) return res.status(400).json({ message: "Répartition invalide." });
    const normalized = payouts.map((item) => ({ userId: String(item.userId || ""), amount: Number(item.amount) }));
    if (normalized.some((item) => !mongoose.isValidObjectId(item.userId) || !memberOf(clan, item.userId) || !Number.isFinite(item.amount) || item.amount <= 0 || item.amount > 100000)) return res.status(400).json({ message: "Chaque bénéficiaire doit être membre et recevoir un montant valide." });
    if (new Set(normalized.map((item) => item.userId)).size !== normalized.length) return res.status(400).json({ message: "Chaque membre ne peut apparaître qu’une fois." });
    const totalUnits = normalized.reduce((sum, item) => sum + toUnits(item.amount), 0);
    const current = await Clan.findOne({ _id: clan._id, treasuryUnits: { $gte: totalUnits } }).select("_id");
    if (!current) return res.status(402).json({ message: "La trésorerie du clan est insuffisante pour ce partage." });
    for (const [index, payout] of normalized.entries()) {
      await transferPizFromClan({ clanId: clan._id, toUserId: payout.userId, amount: payout.amount, type: "clan-revenue-share", operationId: `clan-share:${clan._id}:${batch}:${index}`, description: "Partage des revenus décidé par l’administration du clan", metadata: { clanId: String(clan._id), batchId: batch } });
    }
    const updated = await Clan.findById(clan._id).select("treasuryUnits");
    return res.json({ treasuryPiz: fromUnits(updated.treasuryUnits), distributedPiz: fromUnits(totalUnits), count: normalized.length });
  } catch (error) {
    if (error.code === "CLAN_INSUFFICIENT_FUNDS" || error.code === "PIZ_INSUFFICIENT_FUNDS") return res.status(402).json({ message: error.message });
    console.error("Erreur partage des revenus du clan :", error);
    return res.status(500).json({ message: "Le partage a échoué. Une requête répétée avec le même identifiant ne redébitera pas les versements déjà validés." });
  }
};

module.exports = { discoverClans, requestToJoin, listMembershipRequests, reviewMembershipRequest, updateClanSettings, assignClanRole, rateClan, getKnowledge, createKnowledge, purchaseKnowledge, listAssistantKnowledge, publishAssistantKnowledge, contributeToClan, distributeClanRevenue };
