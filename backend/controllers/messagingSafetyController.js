const mongoose = require("mongoose");
const Clan = require("../models/Clan");
const User = require("../models/User");
const UserReport = require("../models/UserReport");
const Notification = require("../models/Notification");
const MessagingInvitation = require("../models/MessagingInvitation");
const { hasClanAccess, activeClanMemberCount, idOf } = require("../utils/clanAccess");
const { isContactBlocked } = require("../utils/contactPolicy");
const { sendPushToUser } = require("../utils/webPush");

const DURATIONS = new Set([1, 6, 24, 72, 168]);

const canInviteToClan = (clan, userId) => {
  const id = String(userId);
  return idOf(clan.owner) === id
    || (clan.administrators || []).some((item) => idOf(item) === id)
    || (clan.moderators || []).some((item) => idOf(item) === id)
    || (clan.rankAssignments || []).some((item) => idOf(item.user) === id && ["subchief", "envoy"].includes(item.role));
};

const populateInvitation = (query) => query.populate("sender", "username avatar")
  .populate("recipient", "username avatar")
  .populate("clan", "name");

const getTemporaryInvitations = async (req, res) => {
  try {
    const now = new Date();
    await MessagingInvitation.updateMany(
      { recipient: req.user.userId, status: "pending", invitationExpiresAt: { $lte: now } },
      { $set: { status: "expired" } }
    );
    const invitations = await populateInvitation(MessagingInvitation.find({
      recipient: req.user.userId,
      status: "pending",
      invitationExpiresAt: { $gt: now }
    }).sort({ createdAt: -1 }).limit(50));
    return res.json({ invitations });
  } catch (error) {
    console.error("Invitations temporaires indisponibles :", error.message);
    return res.status(500).json({ message: "Impossible de charger les invitations temporaires." });
  }
};

const createTemporaryInvitation = async (req, res) => {
  const senderId = String(req.user.userId);
  const recipientId = String(req.params.userId || "");
  const type = String(req.body?.type || "");
  const durationHours = Number(req.body?.durationHours);
  const clanId = req.body?.clanId ? String(req.body.clanId) : "";
  if (!mongoose.isValidObjectId(recipientId) || senderId === recipientId) return res.status(400).json({ message: "Destinataire invalide." });
  if (!["conversation", "clan"].includes(type) || !DURATIONS.has(durationHours)) return res.status(400).json({ message: "Choisis une invitation et une durée valides." });
  if (type === "clan" && !mongoose.isValidObjectId(clanId)) return res.status(400).json({ message: "Sélectionne un clan valide." });
  if (type === "conversation" && clanId) return res.status(400).json({ message: "Cette invitation concerne une conversation privée." });

  try {
    if (await isContactBlocked(senderId, recipientId)) return res.status(403).json({ message: "Cette invitation est impossible à cause d’un blocage." });
    const recipient = await User.findById(recipientId).select("_id username");
    if (!recipient) return res.status(404).json({ message: "Ce compte n’existe plus." });

    let clan = null;
    if (type === "clan") {
      clan = await Clan.findById(clanId);
      if (!clan) return res.status(404).json({ message: "Clan introuvable." });
      if (!canInviteToClan(clan, senderId)) return res.status(403).json({ message: "Tu n’as pas le rôle nécessaire pour inviter dans ce clan." });
      if (hasClanAccess(clan, recipientId)) return res.status(409).json({ message: "Cette personne a déjà accès au clan." });
      if (activeClanMemberCount(clan) >= 100) return res.status(409).json({ message: "Le clan a atteint sa limite de 100 membres." });
    } else {
      const activeInvite = await MessagingInvitation.findOne({
        type: "conversation",
        $and: [
          { $or: [
            { status: "pending", invitationExpiresAt: { $gt: new Date() } },
            { status: "accepted", accessExpiresAt: { $gt: new Date() } }
          ] },
          { $or: [{ sender: senderId, recipient: recipientId }, { sender: recipientId, recipient: senderId }] }
        ]
      }).select("_id");
      if (activeInvite) return res.status(409).json({ message: "Une invitation temporaire à cette conversation est déjà en attente." });
    }

    const existing = await MessagingInvitation.findOne({
      sender: senderId, recipient: recipientId, type, clan: type === "clan" ? clanId : null,
      status: "pending", invitationExpiresAt: { $gt: new Date() }
    }).select("_id");
    if (existing) return res.status(409).json({ message: "Cette invitation est déjà en attente." });

    const invite = await MessagingInvitation.create({
      sender: senderId,
      recipient: recipientId,
      type,
      clan: type === "clan" ? clanId : null,
      durationHours,
      invitationExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
    });
    const populated = await populateInvitation(MessagingInvitation.findById(invite._id));
    const url = `/?page=messages${type === "clan" ? `&clan=${encodeURIComponent(clanId)}` : `&contact=${encodeURIComponent(senderId)}&username=${encodeURIComponent(req.user.username || "Contact")}`}`;
    void sendPushToUser(recipientId, {
      title: "Nouvelle invitation temporaire",
      body: type === "clan" ? `@${req.user.username || "Un membre"} t’invite temporairement dans ${clan.name}.` : `@${req.user.username || "Un membre"} propose une conversation temporaire.`,
      tag: `temporary-access-${invite._id}`,
      url
    }).catch((error) => console.warn("Notification d’invitation non envoyée :", error.message));
    return res.status(201).json({ invitation: populated });
  } catch (error) {
    console.error("Création d’invitation temporaire impossible :", error.message);
    return res.status(500).json({ message: "Impossible de créer cette invitation temporaire." });
  }
};

const respondTemporaryInvitation = async (req, res) => {
  const decision = String(req.body?.decision || "");
  if (!["accept", "decline"].includes(decision)) return res.status(400).json({ message: "Choisis accepter ou refuser." });
  try {
    const invitation = await MessagingInvitation.findOne({ _id: req.params.invitationId, recipient: req.user.userId, status: "pending" });
    if (!invitation) return res.status(404).json({ message: "Invitation introuvable ou déjà traitée." });
    const now = new Date();
    if (invitation.invitationExpiresAt <= now) {
      invitation.status = "expired";
      await invitation.save();
      return res.status(410).json({ message: "Cette invitation a expiré." });
    }
    if (decision === "decline") {
      invitation.status = "declined";
      await invitation.save();
      return res.json({ accepted: false, invitation: await populateInvitation(MessagingInvitation.findById(invitation._id)) });
    }
    if (await isContactBlocked(req.user.userId, invitation.sender)) return res.status(403).json({ message: "Cette invitation ne peut pas être acceptée à cause d’un blocage." });

    const accessExpiresAt = new Date(now.getTime() + invitation.durationHours * 60 * 60 * 1000);
    if (invitation.type === "clan") {
      const clan = await Clan.findById(invitation.clan);
      if (!clan) return res.status(404).json({ message: "Ce clan n’existe plus." });
      const existingTemporary = (clan.temporaryMembers || []).find((entry) => idOf(entry.user) === String(req.user.userId));
      if (clan.members.some((member) => idOf(member) === String(req.user.userId))) return res.status(409).json({ message: "Tu es déjà membre permanent de ce clan." });
      if (activeClanMemberCount(clan) >= 100 && !existingTemporary) return res.status(409).json({ message: "Le clan a atteint sa limite de membres." });
      if (existingTemporary) {
        existingTemporary.expiresAt = accessExpiresAt;
        existingTemporary.invitedBy = invitation.sender;
      } else {
        clan.temporaryMembers.push({ user: req.user.userId, invitedBy: invitation.sender, expiresAt: accessExpiresAt });
      }
      await clan.save();
    }

    invitation.status = "accepted";
    invitation.accessExpiresAt = accessExpiresAt;
    await invitation.save();
    return res.json({ accepted: true, accessExpiresAt, invitation: await populateInvitation(MessagingInvitation.findById(invitation._id)) });
  } catch (error) {
    console.error("Réponse à l’invitation temporaire impossible :", error.message);
    return res.status(500).json({ message: "Impossible de traiter cette invitation." });
  }
};

const blockUser = async (req, res) => {
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

const unblockUser = async (req, res) => {
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
    const recent = await UserReport.exists({ reporter, reportedUser, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
    if (recent) return res.status(409).json({ message: "Tu as déjà signalé ce compte récemment." });
    const report = await UserReport.create({ reporter, reportedUser, category, details });
    return res.status(201).json({ submitted: true, reportId: String(report._id) });
  } catch (error) {
    console.error("Signalement d’un compte impossible :", error.message);
    return res.status(500).json({ message: "Impossible d’envoyer ce signalement." });
  }
};

const warnUser = async (req, res) => {
  const recipientId = String(req.params.userId || "");
  const senderId = String(req.user.userId);
  if (!mongoose.isValidObjectId(recipientId) || recipientId === senderId) return res.status(400).json({ message: "Compte invalide." });
  try {
    if (await isContactBlocked(senderId, recipientId)) return res.status(403).json({ message: "Cet avertissement ne peut pas être envoyé à cause d’un blocage." });
    const recipient = await User.findById(recipientId).select("_id");
    if (!recipient) return res.status(404).json({ message: "Ce compte n’existe plus." });
    const recent = await Notification.exists({ recipient: recipientId, sender: senderId, type: "warning", createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
    if (recent) return res.status(429).json({ message: "Tu as déjà envoyé un avertissement à cette personne aujourd’hui." });
    await Notification.create({ recipient: recipientId, sender: senderId, type: "warning", message: `@${req.user.username || "Un membre"} t’envoie un rappel de respect concernant vos échanges.` });
    void sendPushToUser(recipientId, { title: "Rappel de respect", body: "Tu as reçu un avertissement concernant vos échanges sur Veloce.", tag: `warning-${senderId}`, url: "/?page=messages" }).catch((error) => console.warn("Notification d’avertissement non envoyée :", error.message));
    return res.json({ sent: true });
  } catch (error) {
    console.error("Avertissement impossible :", error.message);
    return res.status(500).json({ message: "Impossible d’envoyer cet avertissement." });
  }
};

module.exports = { getTemporaryInvitations, createTemporaryInvitation, respondTemporaryInvitation, blockUser, unblockUser, reportUser, warnUser };
