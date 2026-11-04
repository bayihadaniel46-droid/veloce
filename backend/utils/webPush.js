const crypto = require("crypto");
const webpush = require("web-push");
const PushSubscription = require("../models/PushSubscription");

const P256_ORDER = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");

function getVapidKeys() {
  const secret = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!secret) return null;

  const seed = crypto.createHash("sha256").update(secret).digest();
  const scalar = BigInt(`0x${seed.toString("hex")}`) % (P256_ORDER - 1n) + 1n;
  const privateBytes = Buffer.from(scalar.toString(16).padStart(64, "0"), "hex");
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.setPrivateKey(privateBytes);

  return {
    privateKey: ecdh.getPrivateKey().toString("base64url"),
    publicKey: ecdh.getPublicKey(undefined, "uncompressed").toString("base64url"),
  };
}

async function sendPushToUser(userId, payload) {
  const keys = getVapidKeys();
  if (!keys) return;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:notifications@veloce.app",
    keys.publicKey,
    keys.privateKey,
  );

  const subscriptions = await PushSubscription.find({ user: userId }).lean();
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      }, JSON.stringify(payload), { TTL: 60 });
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await PushSubscription.deleteOne({ _id: subscription._id });
        return;
      }
      console.error("Envoi notification Push impossible :", error.message);
    }
  }));
}

module.exports = { getVapidKeys, sendPushToUser };
