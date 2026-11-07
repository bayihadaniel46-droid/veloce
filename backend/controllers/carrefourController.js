const mongoose = require("mongoose");
const CarrefourItem = require("../models/CarrefourItem");
const UserStatus = require("../models/UserStatus");
const User = require("../models/User");
const Clan = require("../models/Clan");
const { transferPiz } = require("../services/pizEconomy");

const clanMemberFilter = (userId) => ({
  $or: [
    { owner: userId },
    { members: userId },
    { administrators: userId },
    { moderators: userId }
  ]
});

const getCarrefour = async (req, res) => {
  try {
    const now = new Date();
    const [statuses, anonymousPosts, isClanMember] = await Promise.all([
      UserStatus.find({ expiresAt: { $gt: now } }).populate("author", "username avatar").sort({ createdAt: -1 }).limit(100),
      CarrefourItem.find().populate("author", "username avatar").sort({ createdAt: -1 }).limit(100),
      Clan.exists(clanMemberFilter(req.user.userId))
    ]);
    const authorIds = [...new Set(anonymousPosts.map((post) => String(post.author?._id || post.author)))];
    const protectedAuthors = new Set();
    if (authorIds.length) {
      const memberClans = await Clan.find({ $or: [
        { owner: { $in: authorIds } },
        { members: { $in: authorIds } },
        { administrators: { $in: authorIds } },
        { moderators: { $in: authorIds } }
      ] }).select("owner members administrators moderators").lean();
      for (const clan of memberClans) {
        for (const memberId of [clan.owner, ...(clan.members || []), ...(clan.administrators || []), ...(clan.moderators || [])]) {
          if (authorIds.includes(String(memberId))) protectedAuthors.add(String(memberId));
        }
      }
    }
    const newlyProtectedIds = anonymousPosts.filter((post) => !post.clanProtected && protectedAuthors.has(String(post.author?._id || post.author))).map((post) => post._id);
    if (newlyProtectedIds.length) await CarrefourItem.updateMany({ _id: { $in: newlyProtectedIds } }, { $set: { clanProtected: true } });
    return res.json({
      statuses: statuses.map((status) => ({ _id: status._id, content: status.content, createdAt: status.createdAt, expiresAt: status.expiresAt, author: status.author })),
      canRevealIdentity: !isClanMember,
      anonymousPosts: anonymousPosts.map((post) => {
        const authorId = String(post.author?._id || post.author);
        const isOwner = authorId === String(req.user.userId);
        const clanProtected = Boolean(post.clanProtected || protectedAuthors.has(authorId));
        const identityRevealed = !isOwner && !clanProtected && post.revealedBy.some((id) => String(id) === String(req.user.userId));
        const canViewAuthor = !clanProtected && (isOwner || identityRevealed);
        return {
          _id: post._id,
          content: post.content,
          createdAt: post.createdAt,
          clanProtected,
          isOwner,
          allowIdentityReveal: Boolean(post.allowIdentityReveal),
          identityRevealed,
          revealedAuthor: canViewAuthor ? { username: post.author?.username, avatar: post.author?.avatar } : null
        };
      })
    });
  } catch (error) {
    console.error("Erreur chargement du Carrefour :", error.message);
    return res.status(500).json({ message: "Impossible de charger le Carrefour." });
  }
};

const createStatus = async (req, res) => {
  const content = String(req.body.content || "").trim();
  if (!content || content.length > 500) return res.status(400).json({ message: "Le statut doit contenir de 1 à 500 caractères." });
  try {
    const status = await UserStatus.create({ author: req.user.userId, content, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    try {
      await transferPiz({ fromUserId: req.user.userId, amount: 1, type: "status-post", description: "Publication d’un statut", metadata: { statusId: String(status._id) } });
    } catch (error) {
      await UserStatus.deleteOne({ _id: status._id });
      throw error;
    }
    const populated = await UserStatus.findById(status._id).populate("author", "username avatar");
    return res.status(201).json({ _id: populated._id, content: populated.content, createdAt: populated.createdAt, expiresAt: populated.expiresAt, author: populated.author });
  } catch (error) {
    if (error.code === "PIZ_INSUFFICIENT_FUNDS") return res.status(402).json({ message: error.message });
    console.error("Erreur création du statut :", error.message);
    return res.status(500).json({ message: "Impossible de publier le statut." });
  }
};

const createAnonymousPost = async (req, res) => {
  const content = String(req.body.content || "").trim();
  if (!content || content.length > 3000) return res.status(400).json({ message: "Le message anonyme doit contenir de 1 à 3 000 caractères." });
  try {
    const memberOfClan = await Clan.exists(clanMemberFilter(req.user.userId));
    const allowIdentityReveal = !memberOfClan && req.body?.allowIdentityReveal === true;
    const item = await CarrefourItem.create({ author: req.user.userId, content, clanProtected: Boolean(memberOfClan), allowIdentityReveal });
    try {
      await transferPiz({ fromUserId: req.user.userId, amount: 1, type: "anonymous-post", description: "Publication anonyme au Carrefour", metadata: { postId: String(item._id) } });
    } catch (error) {
      await CarrefourItem.deleteOne({ _id: item._id });
      throw error;
    }
    return res.status(201).json({
      _id: item._id,
      content: item.content,
      createdAt: item.createdAt,
      isOwner: true,
      clanProtected: Boolean(memberOfClan),
      allowIdentityReveal: item.allowIdentityReveal,
      identityRevealed: false,
      revealedAuthor: null
    });
  } catch (error) {
    if (error.code === "PIZ_INSUFFICIENT_FUNDS") return res.status(402).json({ message: error.message });
    console.error("Erreur création d’une publication anonyme :", error.message);
    return res.status(500).json({ message: "Impossible de publier dans le Carrefour." });
  }
};

const revealAnonymousAuthor = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.itemId)) return res.status(404).json({ message: "Publication introuvable." });
  try {
    const item = await CarrefourItem.findById(req.params.itemId);
    if (!item) return res.status(404).json({ message: "Publication introuvable." });
    const userId = String(req.user.userId);
    if (item.clanProtected || await Clan.exists(clanMemberFilter(item.author))) {
      if (!item.clanProtected) await CarrefourItem.updateOne({ _id: item._id }, { $set: { clanProtected: true } });
      return res.status(403).json({ message: "L’identité de cet auteur est protégée par son appartenance à un clan. Aucune somme n’a été débitée.", clanProtected: true });
    }
    const authorId = String(item.author);
    if (authorId === userId) return res.status(400).json({ message: "Tu connais déjà l’auteur de ta publication." });
    const alreadyRevealed = item.revealedBy.some((id) => String(id) === userId);
    if (!alreadyRevealed && !item.allowIdentityReveal) {
      return res.status(403).json({ message: "L’auteur a choisi de garder son identité privée. Aucun Piz n’a été débité.", identityConsentRequired: true });
    }
    if (!alreadyRevealed) {
      await transferPiz({
        fromUserId: userId,
        toUserId: authorId,
        amount: 15,
        platformShare: 7.5,
        type: "anonymous-identity-reveal",
        operationId: `reveal-carrefour:${item._id}:${userId}`,
        description: "Révélation de l’auteur d’une publication anonyme",
        metadata: { postId: String(item._id) }
      });
      await CarrefourItem.updateOne({ _id: item._id }, { $addToSet: { revealedBy: req.user.userId } });
    }
    const author = await User.findById(item.author).select("username avatar");
    return res.json({ author, cost: alreadyRevealed ? 0 : 15, split: { author: alreadyRevealed ? 0 : 7.5, administration: alreadyRevealed ? 0 : 7.5 } });
  } catch (error) {
    if (error.code === "PIZ_INSUFFICIENT_FUNDS") return res.status(402).json({ message: error.message });
    console.error("Erreur révélation anonyme :", error.message);
    return res.status(500).json({ message: "Impossible de révéler cet auteur." });
  }
};

module.exports = { getCarrefour, createStatus, createAnonymousPost, revealAnonymousAuthor };
