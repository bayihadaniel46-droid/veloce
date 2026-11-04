const PushSubscription = require("../models/PushSubscription");
const { getVapidKeys } = require("../utils/webPush");

function isSupportedPushEndpoint(hostname) {
  return hostname === "fcm.googleapis.com"
    || hostname === "web.push.apple.com"
    || hostname.endsWith(".push.services.mozilla.com")
    || hostname.endsWith(".notify.windows.com");
}

const getPublicKey = (req, res) => {
  const keys = getVapidKeys();
  if (!keys) {
    return res.status(503).json({ message: "Les notifications Push ne sont pas encore configurées sur le serveur." });
  }
  return res.json({ publicKey: keys.publicKey });
};

const saveSubscription = async (req, res) => {
  try {
    const { endpoint, keys } = req.body || {};
    let endpointUrl;
    try { endpointUrl = new URL(endpoint); } catch { endpointUrl = null; }
    if (!endpointUrl || endpointUrl.protocol !== "https:" || !isSupportedPushEndpoint(endpointUrl.hostname)
      || endpoint.length > 4096 || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: "Abonnement Push invalide." });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { user: req.user.userId, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return res.status(201).json({ success: true });
  } catch (error) {
    console.error("Enregistrement abonnement Push impossible :", error);
    return res.status(500).json({ message: "Impossible d’enregistrer cet appareil." });
  }
};

const removeSubscription = async (req, res) => {
  try {
    if (req.body?.endpoint) {
      await PushSubscription.deleteOne({ endpoint: req.body.endpoint, user: req.user.userId });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error("Suppression abonnement Push impossible :", error);
    return res.status(500).json({ message: "Impossible de désactiver les notifications sur cet appareil." });
  }
};

module.exports = { getPublicKey, saveSubscription, removeSubscription };
