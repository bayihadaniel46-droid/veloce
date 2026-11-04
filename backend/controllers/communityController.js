const CommunityMessage = require("../models/CommunityMessage");

const communityAdminIds = () => (process.env.COMMUNITY_ADMIN_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

const isCommunityAdmin = (userId) => communityAdminIds().includes(String(userId));

const serializeMessage = (message) => ({
  _id: message._id,
  kind: message.kind,
  content: message.content,
  createdAt: message.createdAt,
  sender: message.sender && typeof message.sender === "object" ? {
    _id: String(message.sender._id),
    username: message.sender.username,
    avatar: message.sender.avatar
  } : null
});

const listCommunityMessages = async (req, res) => {
  try {
    const messages = await CommunityMessage.find()
      .populate("sender", "username avatar")
      .sort({ createdAt: -1 })
      .limit(250);
    messages.reverse();
    return res.json({ messages: messages.map(serializeMessage), canPublish: isCommunityAdmin(req.user.userId) });
  } catch (error) {
    console.error("Erreur chargement clan serveur :", error);
    return res.status(500).json({ message: "Impossible de charger le clan serveur." });
  }
};

const sendCommunityMessage = async (req, res) => {
  const content = String(req.body.content || "").trim();
  if (!content) return res.status(400).json({ message: "Écris une question ou un message avant l’envoi." });
  if (content.length > 3000) return res.status(400).json({ message: "Le message ne peut pas dépasser 3 000 caractères." });
  try {
    const message = await CommunityMessage.create({ sender: req.user.userId, kind: "message", content });
    await message.populate("sender", "username avatar");
    return res.status(201).json(serializeMessage(message));
  } catch (error) {
    console.error("Erreur envoi clan serveur :", error);
    return res.status(500).json({ message: "Impossible d’envoyer le message dans le clan serveur." });
  }
};

const publishCommunityUpdate = async (req, res) => {
  if (!isCommunityAdmin(req.user.userId)) return res.status(403).json({ message: "Seule l’équipe Veloce peut publier une nouveauté dans le clan serveur." });
  const kind = req.body.kind === "ad" ? "ad" : "announcement";
  const content = String(req.body.content || "").trim();
  if (!content) return res.status(400).json({ message: "Le contenu de la publication est vide." });
  if (content.length > 3000) return res.status(400).json({ message: "La publication ne peut pas dépasser 3 000 caractères." });
  try {
    const message = await CommunityMessage.create({ sender: req.user.userId, kind, content });
    await message.populate("sender", "username avatar");
    return res.status(201).json(serializeMessage(message));
  } catch (error) {
    console.error("Erreur publication clan serveur :", error);
    return res.status(500).json({ message: "Impossible de publier dans le clan serveur." });
  }
};

module.exports = { listCommunityMessages, sendCommunityMessage, publishCommunityUpdate };
