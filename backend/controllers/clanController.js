const mongoose = require("mongoose");
const Clan = require("../models/Clan");
const ClanMessage = require("../models/ClanMessage");
const User = require("../models/User");
const { uploadMessageFiles, deleteMessageFiles } = require("../utils/messageAttachments");
const { getPizActivity, CLAN_CREATION_COST } = require("../services/pizEconomy");

const idOf = (value) => String(value?._id || value);
const isMember = (clan, userId) => clan.members.some((member) => idOf(member) === String(userId));

const listClans = async (req, res) => {
  try {
    const userId = req.user.userId;
    const clans = await Clan.find({ members: userId })
      .populate("owner", "username avatar")
      .populate("members", "username avatar")
      .populate("administrators", "username avatar")
      .populate("moderators", "username avatar")
      .sort({ updatedAt: -1 });
    const result = await Promise.all(clans.map(async (clan) => {
      const latest = await ClanMessage.findOne({ clan: clan._id }).sort({ createdAt: -1 }).select("createdAt signed recipients");
      return {
        _id: clan._id,
        name: clan.name,
        description: clan.description,
        owner: clan.owner,
        members: clan.members,
        administrators: clan.administrators,
        moderators: clan.moderators,
        updatedAt: clan.updatedAt,
        lastActivity: latest?.createdAt || clan.updatedAt,
        memberCount: clan.members.length
      };
    }));
    return res.json(result);
  } catch (error) {
    console.error("Erreur chargement clans :", error);
    return res.status(500).json({ message: "Impossible de charger les clans." });
  }
};

const createClan = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const description = String(req.body.description || "").trim();
    const ownerId = req.user.userId;
    const memberIds = [...new Set((Array.isArray(req.body.memberIds) ? req.body.memberIds : []).map(String))]
      .filter((id) => id !== String(ownerId));
    if (!name || name.length > 60) return res.status(400).json({ message: "Le nom du clan doit contenir de 1 à 60 caractères." });
    if (description.length > 240) return res.status(400).json({ message: "La description ne peut dépasser 240 caractères." });
    if (memberIds.length > 99 || memberIds.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ message: "La sélection des membres est invalide." });
    }
    const [foundMembers, owner] = await Promise.all([
      User.find({ _id: { $in: memberIds } }).select("_id"),
      User.findById(ownerId).select("username activeSeconds pizAccountId")
    ]);
    if (foundMembers.length !== memberIds.length) return res.status(400).json({ message: "Un membre sélectionné est introuvable." });
    if (!owner) return res.status(401).json({ message: "Compte introuvable. Reconnecte-toi puis réessaie." });
    if (!owner.pizAccountId) return res.status(400).json({ message: "Connecte d’abord ton ID PIZ dans Compte finances pour payer la création du clan depuis ton portefeuille central." });
    const balance = await getPizActivity(ownerId, owner.activeSeconds);
    let clan;
    try {
      clan = await Clan.create({ name, description, owner: ownerId, members: [ownerId, ...memberIds] });
    } catch (error) {
      throw error;
    }
    const pizApiUrl = String(process.env.PIZ_API_URL || "").trim().replace(/\/+$/, "").replace(/\/api$/i, "");
    const serviceKey = process.env.PIZ_SERVICE_KEY || "";
    if (!pizApiUrl || !serviceKey) {
      await Clan.deleteOne({ _id: clan._id });
      return res.status(503).json({ message: "La liaison au registre PIZ n’est pas configurée. Le clan n’a pas été créé et aucun PIZ n’a été débité." });
    }
    try {
      let charged = false;
      let lastError;
      for (let attempt = 0; attempt < 2 && !charged; attempt += 1) {
        try {
          const response = await fetch(`${pizApiUrl}/api/wallet/internal/clan-charge`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-piz-service-key": serviceKey },
            body: JSON.stringify({ pizUserId: String(owner.pizAccountId), legacyUserId: String(ownerId), username: owner.username, totalPiz: balance.pizBalance, clanId: String(clan._id) }),
            signal: AbortSignal.timeout(12000)
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw Object.assign(new Error(data.message || "PIZ a refusé les frais de création du clan."), { httpStatus: response.status === 400 ? 400 : response.status === 401 ? 503 : 502 });
          charged = true;
        } catch (error) {
          lastError = error;
          if (error.httpStatus) break;
        }
      }
      if (!charged) throw lastError || new Error("Le registre PIZ n’a pas confirmé le débit.");
    } catch (error) {
      await Clan.deleteOne({ _id: clan._id });
      return res.status(error.httpStatus || 502).json({ message: error.message || "Le registre PIZ n’a pas confirmé le débit. Le clan n’a pas été créé." });
    }
    const populated = await Clan.findById(clan._id).populate("owner", "username avatar").populate("members", "username avatar");
    return res.status(201).json(populated);
  } catch (error) {
    console.error("Erreur création clan :", error);
    return res.status(500).json({ message: "Impossible de créer le clan." });
  }
};

const addClanMembers = async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.clanId);
    if (!clan) return res.status(404).json({ message: "Clan introuvable." });
    const inviterId = String(req.user.userId);
    const canInvite = idOf(clan.owner) === inviterId || clan.administrators.some((id) => idOf(id) === inviterId) || clan.moderators.some((id) => idOf(id) === inviterId);
    if (!canInvite) return res.status(403).json({ message: "Seuls le chef, les administrateurs et les modérateurs peuvent inviter des membres." });
    const memberIds = [...new Set((Array.isArray(req.body.memberIds) ? req.body.memberIds : []).map(String))]
      .filter((id) => !isMember(clan, id));
    if (memberIds.some((id) => !mongoose.isValidObjectId(id))) return res.status(400).json({ message: "La sélection des membres est invalide." });
    if (clan.members.length + memberIds.length > 100) return res.status(400).json({ message: "Un clan ne peut pas dépasser 100 membres." });
    const users = await User.find({ _id: { $in: memberIds } }).select("_id");
    if (users.length !== memberIds.length) return res.status(400).json({ message: "Un membre sélectionné est introuvable." });
    clan.members.push(...users.map((item) => item._id));
    await clan.save();
    await clan.populate("owner", "username avatar");
    await clan.populate("members", "username avatar");
    await clan.populate("administrators", "username avatar");
    await clan.populate("moderators", "username avatar");
    return res.json(clan);
  } catch (error) {
    console.error("Erreur invitation clan :", error);
    return res.status(500).json({ message: "Impossible d'ajouter les membres." });
  }
};

const safeEnvelope = (message, userId) => {
  const own = idOf(message.sender) === String(userId);
  const addressed = message.recipients.some((recipient) => idOf(recipient) === String(userId));
  const opened = own || message.openedBy.some((id) => idOf(id) === String(userId));
  const canReply = (own || addressed) && opened;
  return {
    _id: message._id,
    clan: message.clan,
    sender: message.signed || own ? message.sender : null,
    signed: message.signed,
    recipientCount: opened ? message.recipients.length : null,
    replyTargets: opened ? [...message.recipients, message.sender]
      .filter((recipient) => idOf(recipient) !== String(userId))
      .map((recipient) => ({ _id: recipient._id, username: recipient.username, avatar: recipient.avatar })) : [],
    replyTo: message.replyTo,
    createdAt: message.createdAt,
    isOwn: own,
    canOpen: own || addressed,
    opened,
    locked: !opened,
    canReply,
    content: opened ? message.content : undefined,
    attachments: opened ? message.attachments : undefined
  };
};

const listClanMessages = async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.clanId);
    if (!clan) return res.status(404).json({ message: "Clan introuvable." });
    if (!isMember(clan, req.user.userId)) return res.status(403).json({ message: "Tu ne fais pas partie de ce clan." });
    const messages = await ClanMessage.find({ clan: clan._id })
      .populate("sender", "username avatar")
      .populate("recipients", "username avatar")
      .populate("replyTo", "_id")
      .sort({ createdAt: -1 })
      .limit(500);
    messages.reverse();
    return res.json(messages.map((message) => safeEnvelope(message, req.user.userId)));
  } catch (error) {
    console.error("Erreur chargement enveloppes :", error);
    return res.status(500).json({ message: "Impossible de charger les enveloppes du clan." });
  }
};

const openClanMessage = async (req, res) => {
  try {
    const message = await ClanMessage.findOne({ _id: req.params.messageId, clan: req.params.clanId })
      .populate("sender", "username avatar")
      .populate("recipients", "username avatar")
      .populate("replyTo", "_id");
    if (!message) return res.status(404).json({ message: "Enveloppe introuvable." });
    const userId = String(req.user.userId);
    const own = idOf(message.sender) === userId;
    const addressed = message.recipients.some((recipient) => idOf(recipient) === userId);
    if (!own && !addressed) return res.status(403).json({ message: "Cette enveloppe ne t'est pas destinée." });
    if (!own) {
      await ClanMessage.updateOne({ _id: message._id }, { $addToSet: { openedBy: req.user.userId } });
      message.openedBy.push(req.user.userId);
    }
    return res.json(safeEnvelope(message, req.user.userId));
  } catch (error) {
    console.error("Erreur ouverture enveloppe :", error);
    return res.status(500).json({ message: "Impossible d'ouvrir cette enveloppe." });
  }
};

const sendClanMessage = async (req, res) => {
  let attachments = [];
  try {
    const userId = req.user.userId;
    const clan = await Clan.findById(req.params.clanId);
    if (!clan) return res.status(404).json({ message: "Clan introuvable." });
    if (!isMember(clan, userId)) return res.status(403).json({ message: "Tu ne fais pas partie de ce clan." });
    const content = String(req.body.content || "").trim();
    if (!content && !req.files?.length) return res.status(400).json({ message: "Écris un message ou ajoute un fichier." });
    if (content.length > 5000) return res.status(400).json({ message: "Le message ne peut dépasser 5 000 caractères." });
    let selectedRecipients = req.body.recipientIds;
    if (typeof selectedRecipients === "string") { try { selectedRecipients = JSON.parse(selectedRecipients); } catch { selectedRecipients = []; } }
    const recipientIds = [...new Set((Array.isArray(selectedRecipients) ? selectedRecipients : []).map(String))];
    if (!recipientIds.length) return res.status(400).json({ message: "Choisis au moins un destinataire." });
    if (recipientIds.some((id) => id === String(userId) || !isMember(clan, id))) return res.status(400).json({ message: "Tous les destinataires doivent être d'autres membres du clan." });
    let replyTo = null;
    if (req.body.replyTo) {
      replyTo = await ClanMessage.findOne({ _id: req.body.replyTo, clan: clan._id });
      if (!replyTo) return res.status(404).json({ message: "Le message auquel répondre est introuvable." });
      const canAccessParent = idOf(replyTo.sender) === String(userId) || replyTo.recipients.some((item) => idOf(item) === String(userId));
      const hasOpened = idOf(replyTo.sender) === String(userId) || replyTo.openedBy.some((item) => idOf(item) === String(userId));
      if (!canAccessParent || !hasOpened) return res.status(403).json({ message: "Ouvre une enveloppe qui t'est destinée avant d'y répondre." });
      const allowed = new Set([...replyTo.recipients.map(idOf), idOf(replyTo.sender)]);
      if (recipientIds.some((id) => !allowed.has(id))) return res.status(400).json({ message: "Les réponses ne peuvent être envoyées qu'aux participants de l'enveloppe d'origine." });
    }
    attachments = req.files?.length ? await uploadMessageFiles(req.files, userId) : [];
    const message = await ClanMessage.create({ clan: clan._id, sender: userId, recipients: recipientIds, content, attachments, signed: req.body.signed === "true" || req.body.signed === true, replyTo: replyTo?._id, openedBy: [userId] });
    await Clan.updateOne({ _id: clan._id }, { $set: { updatedAt: new Date() } });
    const populated = await ClanMessage.findById(message._id).populate("sender", "username avatar").populate("recipients", "username avatar").populate("replyTo", "_id");
    return res.status(201).json(safeEnvelope(populated, userId));
  } catch (error) {
    if (attachments.length) await deleteMessageFiles(attachments).catch(() => {});
    console.error("Erreur envoi enveloppe clan :", error);
    return res.status(500).json({ message: "Impossible d'envoyer cette enveloppe." });
  }
};

module.exports = { listClans, createClan, addClanMembers, listClanMessages, openClanMessage, sendClanMessage };
