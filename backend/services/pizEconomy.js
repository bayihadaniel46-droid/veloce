const User = require("../models/User");
const Post = require("../models/Post");
const Like = require("../models/Like");
const Comment = require("../models/comment");
const Message = require("../models/Message");
const Clan = require("../models/Clan");
const PizTransaction = require("../models/PizTransaction");
const PizReserve = require("../models/PizReserve");

// Small participation rewards remain active. Wallet amounts use millionths so
// the 50/50 distributions can settle exactly, including the 2.5-PIZ fee.
const PIZ_REWARD_RATES = Object.freeze({
  activeHour: 0.005,
  post: 0.01,
  like: 0.0002,
  comment: 0.002,
  message: 0.0002,
  clan: 1,
  referral: 0.1
});
const CLAN_CREATION_COST = 0.8;
const PIZ_UNIT = 1000000;
const OPENING_GRANT_UNITS = 100 * PIZ_UNIT;
const toUnits = (amount) => Math.max(0, Math.round((Number(amount) || 0) * PIZ_UNIT));
const fromUnits = (units) => Math.max(0, Number(units) || 0) / PIZ_UNIT;

const calculateActivity = async (userId, activeSeconds) => {
  const [postsCount, likesCount, commentsCount, messagesCount, clansManagedCount, referralsCount] = await Promise.all([
    Post.countDocuments({ author: userId }),
    Like.countDocuments({ userId }),
    Comment.countDocuments({ userId }),
    Message.countDocuments({ sender: userId }),
    Clan.countDocuments({ owner: userId }),
    User.countDocuments({ referredBy: userId })
  ]);
  const seconds = Number.isFinite(Number(activeSeconds)) ? Math.max(0, Number(activeSeconds)) : 0;
  const generatedPiz = Math.round((
    seconds / 3600 * PIZ_REWARD_RATES.activeHour +
    postsCount * PIZ_REWARD_RATES.post +
    likesCount * PIZ_REWARD_RATES.like +
    commentsCount * PIZ_REWARD_RATES.comment +
    messagesCount * PIZ_REWARD_RATES.message +
    clansManagedCount * PIZ_REWARD_RATES.clan +
    referralsCount * PIZ_REWARD_RATES.referral
  ) * PIZ_UNIT) / PIZ_UNIT;
  return { postsCount, likesCount, commentsCount, messagesCount, clansManagedCount, referralsCount, generatedPiz };
};

const ensurePizWallet = async (userId, activity = null) => {
  let user = await User.findById(userId).select("pizBalanceUnits pizWalletInitializedAt pizRewardCheckpoint pizSpent activeSeconds");
  if (!user) throw new Error("Compte utilisateur introuvable.");
  const totals = activity || await calculateActivity(userId, user.activeSeconds || 0);

  if (!user.pizWalletInitializedAt) {
    const openingBalance = Math.max(0, totals.generatedPiz - (Number(user.pizSpent) || 0)) + 100;
    await User.updateOne(
      { _id: user._id, pizWalletInitializedAt: null },
      { $set: {
        pizBalanceUnits: toUnits(openingBalance),
        pizRewardCheckpoint: totals.generatedPiz,
        pizWalletInitializedAt: new Date()
      } }
    );
    await PizTransaction.updateOne(
      { operationId: `opening-grant:${user._id}` },
      { $setOnInsert: {
        operationId: `opening-grant:${user._id}`,
        type: "opening-grant",
        toUser: user._id,
        amountUnits: OPENING_GRANT_UNITS,
        status: "completed",
        description: "Dotation initiale unique de 100 Piz"
      } },
      { upsert: true }
    );
    user = await User.findById(user._id).select("pizBalanceUnits pizWalletInitializedAt pizRewardCheckpoint pizSpent activeSeconds");
  }

  // Keep the existing participation rewards without recalculating or erasing
  // amounts already spent through the new wallet.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const checkpoint = Number(user.pizRewardCheckpoint) || 0;
    const delta = Math.max(0, Math.round((totals.generatedPiz - checkpoint) * PIZ_UNIT));
    if (delta <= 0) break;
    const update = await User.updateOne(
      { _id: user._id, pizRewardCheckpoint: user.pizRewardCheckpoint },
      { $inc: { pizBalanceUnits: delta }, $set: { pizRewardCheckpoint: totals.generatedPiz } }
    );
    if (update.modifiedCount) {
      user.pizBalanceUnits = (Number(user.pizBalanceUnits) || 0) + delta;
      user.pizRewardCheckpoint = totals.generatedPiz;
      break;
    }
    user = await User.findById(user._id).select("pizBalanceUnits pizWalletInitializedAt pizRewardCheckpoint pizSpent activeSeconds");
  }
  return { ...totals, user, balanceUnits: Math.max(0, Number(user.pizBalanceUnits) || 0) };
};

const getPizActivity = async (userId, activeSeconds) => {
  const activity = await calculateActivity(userId, activeSeconds);
  const wallet = await ensurePizWallet(userId, activity);
  return {
    ...activity,
    pizBalance: fromUnits(wallet.balanceUnits),
    pizBalanceUnits: wallet.balanceUnits,
    pizSpent: Number(wallet.user.pizSpent) || 0
  };
};

const transferPiz = async ({
  fromUserId,
  toUserId = null,
  amount,
  type,
  description,
  metadata = {},
  operationId = null,
  platformShare = null,
  platformReserveKey = "platform-admin"
}) => {
  const amountUnits = toUnits(amount);
  if (amountUnits <= 0) throw new Error("Le montant Piz doit être supérieur à zéro.");
  if (!fromUserId) throw new Error("Compte débiteur manquant.");
  if (toUserId && String(fromUserId) === String(toUserId)) throw new Error("Le compte ne peut pas se verser des Piz à lui-même.");
  if (toUserId) await ensurePizWallet(toUserId);
  await ensurePizWallet(fromUserId);
  const platformUnits = platformShare == null
    ? (toUserId ? 0 : amountUnits)
    : Math.max(0, Math.min(amountUnits, toUnits(platformShare)));
  const recipientUnits = amountUnits - platformUnits;
  const transactionMetadata = platformReserveKey === "platform-admin" ? metadata : { ...metadata, reserveKey: platformReserveKey };

  let transaction = null;
  if (operationId) {
    const existing = await PizTransaction.findOne({ operationId });
    if (existing?.status === "completed") return existing;
    if (existing?.status === "pending") throw new Error("Cette opération Piz est déjà en cours.");
    if (existing) {
      existing.type = type;
      existing.fromUser = fromUserId;
      existing.toUser = toUserId;
      existing.amountUnits = amountUnits;
      existing.platformUnits = platformUnits;
      existing.description = String(description || "Mouvement Piz").slice(0, 240);
      existing.metadata = transactionMetadata;
      existing.status = "pending";
      transaction = await existing.save();
    }
  }

  if (!transaction) transaction = await PizTransaction.create({
    operationId: operationId || undefined,
    type,
    fromUser: fromUserId,
    toUser: toUserId,
    amountUnits,
    platformUnits,
    description: String(description || "Mouvement Piz").slice(0, 240),
    status: "pending",
    metadata: transactionMetadata
  });

  const debit = await User.updateOne(
    { _id: fromUserId, pizBalanceUnits: { $gte: amountUnits } },
    { $inc: { pizBalanceUnits: -amountUnits } }
  );
  if (!debit.modifiedCount) {
    transaction.status = "failed";
    transaction.description = "Solde Piz insuffisant";
    await transaction.save();
    const error = new Error("Solde Piz insuffisant pour cette action.");
    error.code = "PIZ_INSUFFICIENT_FUNDS";
    throw error;
  }

  try {
    if (recipientUnits && toUserId) {
      await User.updateOne({ _id: toUserId }, { $inc: { pizBalanceUnits: recipientUnits } });
    }
    if (platformUnits) {
      await PizReserve.findOneAndUpdate(
        { key: platformReserveKey },
        { $inc: { balanceUnits: platformUnits } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    transaction.status = "completed";
    await transaction.save();
    return transaction;
  } catch (error) {
    await User.updateOne({ _id: fromUserId }, { $inc: { pizBalanceUnits: amountUnits } });
    if (recipientUnits && toUserId) await User.updateOne({ _id: toUserId }, { $inc: { pizBalanceUnits: -recipientUnits } });
    if (platformUnits) await PizReserve.updateOne({ key: platformReserveKey }, { $inc: { balanceUnits: -platformUnits } });
    transaction.status = "failed";
    await transaction.save();
    throw error;
  }
};

const payFromReserve = async ({ toUserId, amountUnits, type, description, metadata = {}, operationId, reserveKey = "platform-admin" }) => {
  const units = Math.max(0, Math.floor(Number(amountUnits) || 0));
  if (!toUserId || units <= 0) return null;
  await ensurePizWallet(toUserId);
  let transaction = null;
  if (operationId) {
    const existing = await PizTransaction.findOne({ operationId });
    if (existing?.status === "completed") return existing;
    if (existing?.status === "pending") throw new Error("Cette distribution Piz est déjà en cours.");
    if (existing) {
      existing.toUser = toUserId;
      existing.amountUnits = units;
      existing.description = String(description || "Distribution depuis la réserve Piz").slice(0, 240);
      existing.metadata = metadata;
      existing.status = "pending";
      transaction = await existing.save();
    }
  }
  if (!transaction) transaction = await PizTransaction.create({
    operationId: operationId || undefined,
    type,
    toUser: toUserId,
    amountUnits: units,
    description: String(description || "Distribution depuis la réserve Piz").slice(0, 240),
    status: "pending",
    metadata
  });
  const reserve = await PizReserve.findOneAndUpdate(
    { key: reserveKey, balanceUnits: { $gte: units } },
    { $inc: { balanceUnits: -units } },
    { new: true }
  );
  if (!reserve) {
    transaction.status = "failed";
    transaction.description = "Réserve administrative insuffisante";
    await transaction.save();
    throw new Error("La réserve administrative ne contient pas assez de Piz pour cette distribution.");
  }
  try {
    await User.updateOne({ _id: toUserId }, { $inc: { pizBalanceUnits: units } });
    transaction.status = "completed";
    await transaction.save();
    return transaction;
  } catch (error) {
    await PizReserve.updateOne({ key: reserveKey }, { $inc: { balanceUnits: units } });
    transaction.status = "failed";
    await transaction.save();
    throw error;
  }
};

const payClanFromReserve = async ({ clanId, amountUnits, type, description, metadata = {}, operationId, reserveKey = "assistant-knowledge" }) => {
  const units = Math.max(0, Math.floor(Number(amountUnits) || 0));
  if (!clanId || units <= 0) return null;
  const { transaction, alreadyCompleted } = await beginClanTransaction({ operationId, type, amountUnits: units, toClan: clanId, description, metadata: { ...metadata, reserveKey } });
  if (alreadyCompleted) return transaction;
  const reserve = await PizReserve.findOneAndUpdate(
    { key: reserveKey, balanceUnits: { $gte: units } },
    { $inc: { balanceUnits: -units } },
    { new: true }
  );
  if (!reserve) {
    transaction.status = "failed";
    transaction.description = "Réserve de rémunération des connaissances insuffisante";
    await transaction.save();
    const error = new Error("La réserve des recherches d’idées est insuffisante.");
    error.code = "ASSISTANT_REWARD_POOL_LOW";
    throw error;
  }
  try {
    const Clan = require("../models/Clan");
    const credit = await Clan.updateOne({ _id: clanId }, { $inc: { treasuryUnits: units } });
    if (!credit.matchedCount) throw new Error("Clan introuvable pour la rémunération.");
    transaction.status = "completed";
    await transaction.save();
    return transaction;
  } catch (error) {
    await PizReserve.updateOne({ key: reserveKey }, { $inc: { balanceUnits: units } });
    transaction.status = "failed";
    await transaction.save();
    throw error;
  }
};

const beginClanTransaction = async ({ operationId, type, amountUnits, fromUser = null, toUser = null, fromClan = null, toClan = null, description, metadata }) => {
  if (operationId) {
    const existing = await PizTransaction.findOne({ operationId });
    if (existing?.status === "completed") return { transaction: existing, alreadyCompleted: true };
    if (existing?.status === "pending") throw new Error("Cette opération Piz est déjà en cours.");
    if (existing) {
      Object.assign(existing, { type, amountUnits, fromUser, toUser, fromClan, toClan, platformUnits: 0, description: String(description || "Mouvement de trésorerie de clan").slice(0, 240), metadata, status: "pending" });
      return { transaction: await existing.save(), alreadyCompleted: false };
    }
  }
  return {
    transaction: await PizTransaction.create({ operationId: operationId || undefined, type, amountUnits, fromUser, toUser, fromClan, toClan, platformUnits: 0, description: String(description || "Mouvement de trésorerie de clan").slice(0, 240), metadata, status: "pending" }),
    alreadyCompleted: false
  };
};

const transferPizToClan = async ({ fromUserId, clanId, amount, type, description, metadata = {}, operationId }) => {
  const amountUnits = toUnits(amount);
  if (!fromUserId || !clanId || amountUnits <= 0) throw new Error("Débiteur, clan ou montant Piz invalide.");
  await ensurePizWallet(fromUserId);
  const { transaction, alreadyCompleted } = await beginClanTransaction({ operationId, type, amountUnits, fromUser: fromUserId, toClan: clanId, description, metadata });
  if (alreadyCompleted) return transaction;
  const debit = await User.updateOne({ _id: fromUserId, pizBalanceUnits: { $gte: amountUnits } }, { $inc: { pizBalanceUnits: -amountUnits } });
  if (!debit.modifiedCount) {
    transaction.status = "failed";
    transaction.description = "Solde Piz insuffisant";
    await transaction.save();
    const error = new Error("Solde Piz insuffisant pour cette action.");
    error.code = "PIZ_INSUFFICIENT_FUNDS";
    throw error;
  }
  let credited = false;
  try {
    const Clan = require("../models/Clan");
    const credit = await Clan.updateOne({ _id: clanId }, { $inc: { treasuryUnits: amountUnits } });
    if (!credit.matchedCount) throw new Error("Clan introuvable pour créditer la trésorerie.");
    credited = true;
    transaction.status = "completed";
    await transaction.save();
    return transaction;
  } catch (error) {
    await User.updateOne({ _id: fromUserId }, { $inc: { pizBalanceUnits: amountUnits } });
    if (credited) {
      const Clan = require("../models/Clan");
      await Clan.updateOne({ _id: clanId, treasuryUnits: { $gte: amountUnits } }, { $inc: { treasuryUnits: -amountUnits } });
    }
    transaction.status = "failed";
    await transaction.save();
    throw error;
  }
};

const transferPizFromClan = async ({ clanId, toUserId, amount, type, description, metadata = {}, operationId }) => {
  const amountUnits = toUnits(amount);
  if (!clanId || !toUserId || amountUnits <= 0) throw new Error("Clan, bénéficiaire ou montant Piz invalide.");
  await ensurePizWallet(toUserId);
  const { transaction, alreadyCompleted } = await beginClanTransaction({ operationId, type, amountUnits, toUser: toUserId, fromClan: clanId, description, metadata });
  if (alreadyCompleted) return transaction;
  const Clan = require("../models/Clan");
  const debit = await Clan.updateOne({ _id: clanId, treasuryUnits: { $gte: amountUnits } }, { $inc: { treasuryUnits: -amountUnits } });
  if (!debit.modifiedCount) {
    transaction.status = "failed";
    transaction.description = "Trésorerie du clan insuffisante";
    await transaction.save();
    const error = new Error("La trésorerie du clan ne contient pas assez de Piz.");
    error.code = "CLAN_INSUFFICIENT_FUNDS";
    throw error;
  }
  let credited = false;
  try {
    const credit = await User.updateOne({ _id: toUserId }, { $inc: { pizBalanceUnits: amountUnits } });
    if (!credit.matchedCount) throw new Error("Bénéficiaire introuvable pour le versement de clan.");
    credited = true;
    transaction.status = "completed";
    await transaction.save();
    return transaction;
  } catch (error) {
    if (credited) await User.updateOne({ _id: toUserId }, { $inc: { pizBalanceUnits: -amountUnits } });
    await Clan.updateOne({ _id: clanId }, { $inc: { treasuryUnits: amountUnits } });
    transaction.status = "failed";
    await transaction.save();
    throw error;
  }
};

const ensureAllPizWallets = async () => {
  const cursor = User.find({ pizWalletInitializedAt: null }).select("_id").lean().cursor();
  for await (const user of cursor) {
    try { await ensurePizWallet(user._id); }
    catch (error) { console.error("Initialisation du portefeuille Piz impossible :", String(user._id), error.message); }
  }
};

module.exports = {
  PIZ_REWARD_RATES,
  CLAN_CREATION_COST,
  PIZ_UNIT,
  toUnits,
  fromUnits,
  getPizActivity,
  ensurePizWallet,
  ensureAllPizWallets,
  transferPiz,
  payFromReserve,
  transferPizToClan,
  transferPizFromClan,
  payClanFromReserve
};
