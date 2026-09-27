const Notification =
  require("../models/Notification");

const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user.userId, read: false });
    return res.json({ count });
  } catch (error) {
    console.error("Erreur compteur notifications :", error);
    return res.status(500).json({ message: "Impossible de charger le compteur de notifications." });
  }
};


/* ============================================================
   MES NOTIFICATIONS
============================================================ */

const getNotifications = async (
  req,
  res
) => {
  try {
    const notifications =
      await Notification.find({
        recipient: req.user.userId
      })
        .populate(
          "sender",
          "username avatar"
        )
        .populate(
          "post",
          "content"
        )
        .sort({
          createdAt: -1
        })
        .limit(100);

    res.json(notifications);

  } catch (error) {
    console.error(
      "Erreur notifications :",
      error
    );

    res.status(500).json({
      message:
        "Impossible de charger les notifications."
    });
  }
};


/* ============================================================
   MARQUER COMME LUE
============================================================ */

const markAsRead = async (
  req,
  res
) => {
  try {
    await Notification.updateOne(
      {
        _id: req.params.id,
        recipient: req.user.userId
      },
      {
        $set: {
          read: true
        }
      }
    );

    res.json({
      success: true
    });

  } catch (error) {
    console.error(
      "Erreur notification lue :",
      error
    );

    res.status(500).json({
      message:
        "Erreur notification."
    });
  }
};


/* ============================================================
   TOUT MARQUER COMME LU
============================================================ */

const markAllAsRead = async (
  req,
  res
) => {
  try {
    await Notification.updateMany(
      {
        recipient: req.user.userId,
        read: false
      },
      {
        $set: {
          read: true
        }
      }
    );

    res.json({
      success: true
    });

  } catch (error) {
    console.error(
      "Erreur notifications lues :",
      error
    );

    res.status(500).json({
      message:
        "Erreur notifications."
    });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const result = await Notification.deleteOne({
      _id: req.params.id,
      recipient: req.user.userId
    });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Notification introuvable." });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error("Erreur suppression notification :", error);
    return res.status(500).json({ message: "Impossible de supprimer cette notification." });
  }
};


module.exports = {
  getUnreadCount,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
};
