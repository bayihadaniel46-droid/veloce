const mongoose = require("mongoose");
const CarrefourItem = require("../models/CarrefourItem");
const UserStatus = require("../models/UserStatus");
const User = require("../models/User");
const { transferPiz } = require("../services/pizEconomy");

const getCarrefour = async (req, res) => {
  try {
    const now = new Date();
    const [statuses, anonymousPosts] = await Promise.all([
      UserStatus.find({ expiresAt: { $gt: now } }).populate("author", "username avatar").sort({ createdAt: -1 }).limit(100),
      CarrefourItem.find().sort({ createdAt: -1 }).limit(100)
    ]);
    return res.json({
      statuses: statuses.map((status) => ({ _id: status._id, content: status.content, createdAt: status.createdAt, expiresAt: status.expiresAt, author: status.author })),
      anonymousPosts: anonymousPosts.map((post) => ({ _id: post._id, content: post.content, createdAt: post.createdAt, identityRevealed: post.revealedBy.some((id) => String(id) === String(req.user.userId)) }))
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
    const item = await CarrefourItem.create({ author: req.user.userId, content });
    try {
      await transferPiz({ fromUserId: req.user.userId, amount: 1, type: "anonymous-post", description: "Publication anonyme au Carrefour", metadata: { postId: String(item._id) } });
    } catch (error) {
      await CarrefourItem.deleteOne({ _id: item._id });
      throw error;
    }
    return res.status(201).json({ _id: item._id, content: item.content, createdAt: item.createdAt, identityRevealed: false });
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
    if (!item.revealedBy.some((id) => String(id) === userId)) {
      const authorId = String(item.author);
      if (authorId === userId) return res.status(400).json({ message: "Tu connais déjà l’auteur de ta publication." });
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
    return res.json({ author, cost: 15, split: { author: 7.5, administration: 7.5 } });
  } catch (error) {
    if (error.code === "PIZ_INSUFFICIENT_FUNDS") return res.status(402).json({ message: error.message });
    console.error("Erreur révélation anonyme :", error.message);
    return res.status(500).json({ message: "Impossible de révéler cet auteur." });
  }
};

module.exports = { getCarrefour, createStatus, createAnonymousPost, revealAnonymousAuthor };
