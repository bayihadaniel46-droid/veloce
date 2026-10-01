const Message =
  require("../models/Message");
const mongoose = require("mongoose");
const ClanMessage = require("../models/ClanMessage");
const Clan = require("../models/Clan");
const { uploadMessageFiles, PRIVATE_BUCKET_NAME } = require("../utils/messageAttachments");

const getUnreadCount = async (req, res) => {
  try {
    const count = await Message.countDocuments({ recipient: req.user.userId, read: false, deletedFor: { $ne: req.user.userId } });
    return res.json({ count });
  } catch (error) {
    console.error("Erreur compteur messages :", error);
    return res.status(500).json({ message: "Impossible de charger le compteur de messages." });
  }
};


/* ============================================================
   CONVERSATIONS
============================================================ */

const getConversations = async (
  req,
  res
) => {
  try {
    const userId =
      req.user.userId;

    const messages =
      await Message.find({
        $or: [
          {
            sender: userId
          },
          {
            recipient: userId
          }
        ],
        deletedFor: { $ne: userId }
      })
        .populate(
          "sender",
          "username avatar"
        )
        .populate(
          "recipient",
          "username avatar"
        )
        .sort({
          createdAt: -1
        });

    const conversations = new Map();

    for (const message of messages) {
      const otherUser =
        message.sender._id.toString() ===
        userId.toString()
          ? message.recipient
          : message.sender;

      const otherId =
        otherUser._id.toString();

      if (!conversations.has(otherId)) {
        conversations.set(
          otherId,
          {
            user: otherUser,
            lastMessage: message.content || (message.attachments?.length ? `📎 ${message.attachments[0].originalName}` : "Pièce jointe"),
            createdAt:
              message.createdAt,
            unread: 0
          }
        );
      }

      if (
        message.recipient._id.toString() ===
          userId.toString() &&
        !message.read
      ) {
        conversations.get(
          otherId
        ).unread += 1;
      }
    }

    res.json(
      Array.from(
        conversations.values()
      )
    );

  } catch (error) {
    console.error(
      "Erreur conversations :",
      error
    );

    res.status(500).json({
      message:
        "Impossible de charger les conversations."
    });
  }
};


/* ============================================================
   MESSAGES D'UNE CONVERSATION
============================================================ */

const getMessages = async (
  req,
  res
) => {
  try {
    const userId =
      req.user.userId;

    const otherUserId =
      req.params.userId;

    const messages =
      await Message.find({
        $or: [
          {
            sender: userId,
            recipient: otherUserId
          },
          {
            sender: otherUserId,
            recipient: userId
          }
        ],
        deletedFor: { $ne: userId }
      })
        .populate(
          "sender",
          "username avatar"
        )
        .populate(
          "recipient",
          "username avatar"
        )
        .sort({
          createdAt: 1
        });

    await Message.updateMany(
      {
        sender: otherUserId,
        recipient: userId,
        read: false,
        deletedFor: { $ne: userId }
      },
      {
        $set: {
          read: true
        }
      }
    );

    res.json(messages);

  } catch (error) {
    console.error(
      "Erreur messages :",
      error
    );

    res.status(500).json({
      message:
        "Impossible de charger les messages."
    });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const message = await Message.findOneAndUpdate(
      {
        _id: req.params.messageId,
        $or: [{ sender: userId }, { recipient: userId }],
        deletedFor: { $ne: userId }
      },
      { $addToSet: { deletedFor: userId } },
      { new: true }
    );

    if (!message) return res.status(404).json({ message: "Message introuvable ou déjà supprimé." });
    return res.json({ success: true });
  } catch (error) {
    console.error("Erreur suppression message :", error);
    return res.status(500).json({ message: "Impossible de supprimer ce message." });
  }
};


/* ============================================================
   ENVOYER MESSAGE
============================================================ */

const sendMessage = async (
  req,
  res
) => {
  try {
    const sender =
      req.user.userId;

    const recipient =
      req.params.userId;

    const content =
      req.body.content?.trim();

    if (!content && !req.files?.length) {
      return res.status(400).json({
        message:
          "Le message est vide."
      });
    }

    if (
      sender.toString() ===
      recipient.toString()
    ) {
      return res.status(400).json({
        message:
          "Tu ne peux pas t'envoyer un message."
      });
    }

    const attachments = req.files?.length ? await uploadMessageFiles(req.files, sender) : [];
    const message = await Message.create({ sender, recipient, content: content || "", attachments });

    const populated =
      await Message.findById(
        message._id
      )
        .populate(
          "sender",
          "username avatar"
        )
        .populate(
          "recipient",
          "username avatar"
        );

    res.status(201).json(
      populated
    );

  } catch (error) {
    console.error(
      "Erreur envoi message :",
      error
    );

    res.status(500).json({
      message:
        "Impossible d'envoyer le message."
    });
  }
};

const getMessageFile = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.fileId)) return res.sendStatus(404);
    const userId = String(req.user.userId);
    const [direct, envelopes] = await Promise.all([
      Message.findOne({ "attachments.fileId": req.params.fileId, deletedFor: { $ne: userId }, $or: [{ sender: userId }, { recipient: userId }] }).select("_id"),
      ClanMessage.find({ "attachments.fileId": req.params.fileId, $or: [{ sender: userId }, { openedBy: userId }] }).select("clan sender recipients openedBy attachments")
    ]);
    let allowed = Boolean(direct);
    if (!allowed) for (const envelope of envelopes) {
      const clan = await Clan.findById(envelope.clan).select("members");
      const addressed = envelope.recipients.some((id) => String(id) === userId);
      const opened = String(envelope.sender) === userId || envelope.openedBy.some((id) => String(id) === userId);
      const ownEnvelope = String(envelope.sender) === userId;
      if (clan?.members.some((id) => String(id) === userId) && (ownEnvelope || addressed) && opened) { allowed = true; break; }
    }
    if (!allowed) return res.sendStatus(404);
    const db = mongoose.connection.db;
    const files = await db.collection(`${PRIVATE_BUCKET_NAME}.files`).findOne({ _id: new mongoose.Types.ObjectId(req.params.fileId) });
    if (!files) return res.sendStatus(404);
    const safeMime = /^image\/(png|jpeg|gif|webp|avif)$/.test(files.contentType || "") ? files.contentType : "application/octet-stream";
    res.set("Content-Type", safeMime);
    res.set("Content-Disposition", `${safeMime.startsWith("image/") ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(files.filename || "fichier")}`);
    res.set("X-Content-Type-Options", "nosniff");
    mongoose.connection.db ? new mongoose.mongo.GridFSBucket(db, { bucketName: PRIVATE_BUCKET_NAME }).openDownloadStream(files._id).pipe(res) : res.sendStatus(404);
  } catch (error) { console.error("Erreur fichier privé :", error); if (!res.headersSent) res.sendStatus(404); }
};


module.exports = {
  getUnreadCount,
  getConversations,
  getMessages,
  sendMessage,
  deleteMessage,
  getMessageFile
};
