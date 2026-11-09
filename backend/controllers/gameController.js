const { randomInt } = require("crypto");
const ArcadeRun = require("../models/ArcadeRun");
const PizTransaction = require("../models/PizTransaction");
const User = require("../models/User");
const { PIZ_UNIT, payFromReserve } = require("../services/pizEconomy");

const MAX_DAILY_GAME_REWARD_UNITS = 5 * PIZ_UNIT;

const beginRun = async (req, res) => {
  try {
    const run = await ArcadeRun.create({
      userId: req.user.userId,
      gameKey: "emoji-rush"
    });
    return res.status(201).json({ runId: String(run._id), startedAt: run.createdAt });
  } catch (error) {
    console.error("Impossible de démarrer la partie :", error.message);
    return res.status(500).json({ message: "Impossible de préparer la surprise pour cette partie." });
  }
};

const reserveDailyReward = async (userId, requestedUnits) => {
  const day = new Date().toISOString().slice(0, 10);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const user = await User.findById(userId).select("gameRewardDay gameRewardUnits");
    if (!user) throw new Error("Compte utilisateur introuvable.");

    if (user.gameRewardDay !== day) {
      const reset = await User.updateOne(
        { _id: userId, gameRewardDay: { $ne: day } },
        { $set: { gameRewardDay: day, gameRewardUnits: 0 } }
      );
      if (reset.modifiedCount) continue;
    }

    const alreadyUsed = Math.max(0, Number(user.gameRewardUnits) || 0);
    const rewardUnits = Math.min(requestedUnits, MAX_DAILY_GAME_REWARD_UNITS - alreadyUsed);
    if (rewardUnits <= 0) return 0;
    const reserved = await User.updateOne(
      { _id: userId, gameRewardDay: day, gameRewardUnits: alreadyUsed },
      { $inc: { gameRewardUnits: rewardUnits } }
    );
    if (reserved.modifiedCount) return rewardUnits;
  }
  throw new Error("Impossible de réserver la récompense pour le moment.");
};

const releaseDailyReward = async (userId, units) => {
  if (units <= 0) return;
  const day = new Date().toISOString().slice(0, 10);
  await User.updateOne(
    { _id: userId, gameRewardDay: day, gameRewardUnits: { $gte: units } },
    { $inc: { gameRewardUnits: -units } }
  );
};

const claimGift = async (req, res) => {
  const userId = req.user.userId;
  const { score, giftCount } = req.body || {};
  const numericScore = Number(score);
  const numericGiftCount = Number(giftCount);
  if (!Number.isInteger(numericScore) || numericScore < 0 || !Number.isInteger(numericGiftCount) || numericGiftCount < 1 || numericGiftCount > 100) {
    return res.status(400).json({ message: "Les informations de cette partie sont invalides." });
  }

  try {
    const run = await ArcadeRun.findOne({ _id: req.params.runId, userId, gameKey: "emoji-rush" });
    if (!run) return res.status(404).json({ message: "Partie introuvable." });
    if (run.rewardStatus === "claimed") {
      return res.json({ rewardPiz: run.rewardUnits / PIZ_UNIT, alreadyClaimed: true });
    }
    if (run.rewardStatus === "no-reward") {
      return res.json({ rewardPiz: 0, reason: "daily-limit", alreadyClaimed: true });
    }
    if (run.rewardStatus === "claiming") {
      const paidTransaction = await PizTransaction.findOne({ operationId: `game-gift:${run._id}`, status: "completed" });
      if (paidTransaction) {
        run.rewardStatus = "claimed";
        run.rewardUnits = paidTransaction.amountUnits;
        await run.save();
        return res.json({ rewardPiz: paidTransaction.amountUnits / PIZ_UNIT, alreadyClaimed: true });
      }
      return res.status(409).json({ message: "La surprise de cette partie est déjà en cours d’ouverture." });
    }
    if (run.rewardStatus !== "pending") {
      return res.status(409).json({ message: "La surprise de cette partie a déjà été ouverte ou est en cours." });
    }

    const elapsedSeconds = Math.max(0, (Date.now() - run.createdAt.getTime()) / 1000);
    if (elapsedSeconds < 8 || numericScore > Math.floor(elapsedSeconds * 10) + 5) {
      return res.status(400).json({ message: "Cette partie n’est pas encore admissible à l’ouverture d’un cadeau." });
    }

    const claiming = await ArcadeRun.findOneAndUpdate(
      { _id: run._id, userId, rewardStatus: "pending" },
      { $set: { rewardStatus: "claiming", score: numericScore, giftCount: numericGiftCount, completedAt: new Date() } },
      { new: true }
    );
    if (!claiming) return res.status(409).json({ message: "La surprise de cette partie est déjà en cours d’ouverture." });

    const drawnUnits = randomInt(1, 6) * PIZ_UNIT;
    let rewardUnits;
    try {
      rewardUnits = await reserveDailyReward(userId, drawnUnits);
    } catch (error) {
      claiming.rewardStatus = "pending";
      await claiming.save();
      throw error;
    }
    if (rewardUnits <= 0) {
      claiming.rewardStatus = "no-reward";
      await claiming.save();
      return res.json({ rewardPiz: 0, reason: "daily-limit" });
    }

    try {
      await payFromReserve({
        toUserId: userId,
        amountUnits: rewardUnits,
        type: "game-gift",
        description: "Cadeau de fin de partie Émoji Rush",
        operationId: `game-gift:${claiming._id}`,
        metadata: { game: "emoji-rush", score: numericScore, giftsCollected: numericGiftCount },
        reserveKey: "platform-admin"
      });
    } catch (error) {
      await releaseDailyReward(userId, rewardUnits);
      claiming.rewardStatus = "unavailable";
      await claiming.save();
      console.error("Récompense de jeu indisponible :", error.message);
      return res.status(503).json({ message: "La réserve de récompenses est momentanément indisponible. Réessaie une prochaine fois." });
    }

    claiming.rewardStatus = "claimed";
    claiming.rewardUnits = rewardUnits;
    await claiming.save();
    return res.json({ rewardPiz: rewardUnits / PIZ_UNIT, dailyLimitPiz: MAX_DAILY_GAME_REWARD_UNITS / PIZ_UNIT });
  } catch (error) {
    console.error("Impossible d’ouvrir le cadeau de jeu :", error.message);
    return res.status(500).json({ message: "Impossible d’ouvrir la surprise pour le moment." });
  }
};

module.exports = { beginRun, claimGift };
