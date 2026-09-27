const Message =
  require("../models/Message");

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
            lastMessage: message.content,
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

    if (!content) {
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

    const message =
      await Message.create({
        sender,
        recipient,
        content
      });

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


module.exports = {
  getUnreadCount,
  getConversations,
  getMessages,
  sendMessage,
  deleteMessage
};
