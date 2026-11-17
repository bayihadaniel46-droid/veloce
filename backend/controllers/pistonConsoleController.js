const User = require("../models/User");
const Notification = require("../models/Notification");

const getConsoleStatus = (req, res) => res.json({ connected: true, service: "veloce-api" });

const sendCommunityAnnouncement = async (req, res) => {
  const title = String(req.body?.title || "").trim().slice(0, 100);
  const message = String(req.body?.message || "").trim().slice(0, 1000);
  if (title.length < 2 || message.length < 2) {
    return res.status(400).json({ message: "Le titre et le message doivent contenir au moins deux caractères." });
  }

  try {
    const recipients = await User.find({ accountStatus: "active" }).select("_id").lean();
    let sent = 0;
    for (let offset = 0; offset < recipients.length; offset += 1000) {
      const batch = recipients.slice(offset, offset + 1000).map(({ _id }) => ({
        recipient: _id,
        sender: null,
        type: "announcement",
        title,
        message,
        read: false
      }));
      if (batch.length) {
        const inserted = await Notification.insertMany(batch, { ordered: false });
        sent += inserted.length;
      }
    }
    return res.status(201).json({ sent: true, recipients: sent, title });
  } catch (error) {
    console.error("Annonce globale Veloce impossible :", error.message);
    return res.status(500).json({ message: "L’annonce n’a pas pu être enregistrée pour toute la communauté." });
  }
};

module.exports = { getConsoleStatus, sendCommunityAnnouncement };
