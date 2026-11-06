const mongoose = require("mongoose");
const Clan = require("../models/Clan");
const ClanVote = require("../models/ClanVote");
const { PIZ_UNIT, toUnits, fromUnits, transferPiz, payFromReserve } = require("../services/pizEconomy");

const idOf = (value) => String(value?._id || value);
const isMember = (clan, id) => clan.members.some((member) => idOf(member) === String(id));

const publicVote = (vote, userId) => ({
  _id: vote._id,
  title: vote.title,
  kind: vote.kind,
  options: vote.options.map(({ key, label, votes }) => ({ key, label, votes })),
  totalVotes: vote.options.reduce((total, option) => total + option.votes, 0),
  totalPizStaked: fromUnits(vote.stakesUnits),
  hasVoted: vote.votedBy.some((id) => idOf(id) === String(userId)),
  status: vote.status,
  result: vote.result,
  closesAt: vote.closesAt,
  createdAt: vote.createdAt
});

const applyClanResult = async (vote, clan, winner) => {
  if (!winner) return;
  if (vote.kind === "leader" && isMember(clan, winner.key)) {
    const formerChief = idOf(clan.owner);
    if (formerChief !== winner.key) clan.administrators.addToSet(formerChief);
    clan.owner = winner.key;
    clan.administrators.pull(winner.key);
    clan.moderators.pull(winner.key);
    await clan.save();
  }
  if (vote.kind === "rank" && vote.target) {
    clan.administrators.pull(vote.target);
    clan.moderators.pull(vote.target);
    if (winner.key === "administrator") clan.administrators.addToSet(vote.target);
    if (winner.key === "moderator") clan.moderators.addToSet(vote.target);
    await clan.save();
  }
};

const resolveVote = async (originalVote, clan) => {
  const staleBefore = new Date(Date.now() - 2 * 60 * 1000);
  const claim = await ClanVote.updateOne(
    {
      _id: originalVote._id,
      $or: [
        { status: "open" },
        { status: "settling", settlementStartedAt: { $lt: staleBefore } }
      ]
    },
    { $set: { status: "settling", settlementStartedAt: new Date() } }
  );
  if (!claim.modifiedCount) return;

  try {
    const vote = await ClanVote.findById(originalVote._id);
    if (!vote) return;
    const ranked = [...vote.options].sort((left, right) => right.votes - left.votes);
    const total = ranked.reduce((sum, option) => sum + option.votes, 0);
    const winner = ranked[0];
    const majority = winner && winner.votes > total / 2 && (!ranked[1] || ranked[1].votes < winner.votes);
    const hasBeneficiary = majority && (vote.kind === "leader" ? isMember(clan, winner.key) : winner.key !== "member");

    if (hasBeneficiary) {
      await applyClanResult(vote, clan, winner);
      const beneficiary = vote.kind === "leader" ? winner.key : vote.target;
      await payFromReserve({
        toUserId: beneficiary,
        amountUnits: Math.floor(vote.stakesUnits / 2),
        type: "clan-vote-award",
        operationId: "clan-vote-award:" + vote._id,
        description: "Part des Piz versée à la personne élue",
        metadata: { clanId: String(vote.clan), voteId: String(vote._id), result: winner.key }
      });
      vote.result = winner.key;
    } else {
      // If nobody is elected, return the committed Piz to the voters.
      for (const ballot of vote.ballots) {
        await payFromReserve({
          toUserId: ballot.voter,
          amountUnits: ballot.amountUnits,
          type: "clan-vote-refund",
          operationId: "clan-vote-refund:" + vote._id + ":" + ballot.voter,
          description: "Remboursement d’un vote sans candidat élu",
          metadata: { clanId: String(vote.clan), voteId: String(vote._id) }
        });
      }
      vote.result = majority ? winner.key : "no-majority";
    }
    vote.status = "closed";
    vote.settledAt = new Date();
    await vote.save();
  } catch (error) {
    await ClanVote.updateOne(
      { _id: originalVote._id, status: "settling" },
      { $set: { status: "open", settlementStartedAt: null } }
    );
    throw error;
  }
};

const listVotes = async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.clanId);
    if (!clan) return res.status(404).json({ message: "Clan introuvable." });
    if (!isMember(clan, req.user.userId)) return res.sendStatus(403);
    const votes = await ClanVote.find({ clan: clan._id }).sort({ createdAt: -1 });
    for (const vote of votes) {
      if (vote.status === "open" && vote.closesAt <= new Date()) await resolveVote(vote, clan);
    }
    const updated = await ClanVote.find({ clan: clan._id }).sort({ createdAt: -1 });
    return res.json(updated.map((vote) => publicVote(vote, req.user.userId)));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Impossible de charger les votes." });
  }
};

const createVote = async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.clanId);
    if (!clan) return res.status(404).json({ message: "Clan introuvable." });
    if (!isMember(clan, req.user.userId)) return res.sendStatus(403);
    const { title, kind, target, options } = req.body;
    if (!String(title || "").trim() || !["leader", "rank"].includes(kind)) return res.status(400).json({ message: "Titre ou type de vote invalide." });
    let ballotOptions;
    let targetId = null;
    if (kind === "leader") {
      ballotOptions = (Array.isArray(options) ? options : []).map((option) => ({ key: String(option.key), label: String(option.label || "Candidat") }));
      if (ballotOptions.length < 2 || ballotOptions.length > 10 || ballotOptions.some((option) => !mongoose.isValidObjectId(option.key) || !isMember(clan, option.key))) return res.status(400).json({ message: "Sélectionne de 2 à 10 candidats membres du clan." });
    } else {
      targetId = String(target || "");
      if (!mongoose.isValidObjectId(targetId) || !isMember(clan, targetId) || targetId === idOf(clan.owner)) return res.status(400).json({ message: "Membre cible invalide. Le chef se change par une élection." });
      ballotOptions = [{ key: "member", label: "Membre" }, { key: "moderator", label: "Modérateur" }, { key: "administrator", label: "Administrateur" }];
    }
    const vote = await ClanVote.create({
      clan: clan._id,
      proposer: req.user.userId,
      title: String(title).trim().slice(0, 140),
      kind,
      target: targetId,
      options: ballotOptions,
      eligibleVoters: clan.members,
      closesAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
    });
    return res.status(201).json(publicVote(vote, req.user.userId));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Impossible de créer le vote." });
  }
};

const castVote = async (req, res) => {
  try {
    const vote = await ClanVote.findOne({ _id: req.params.voteId, clan: req.params.clanId });
    const clan = await Clan.findById(req.params.clanId);
    if (!vote || !clan) return res.status(404).json({ message: "Vote introuvable." });
    const userId = String(req.user.userId);
    if (!isMember(clan, userId) || !vote.eligibleVoters.some((id) => idOf(id) === userId)) return res.sendStatus(403);
    if (vote.status !== "open" || vote.closesAt <= new Date()) {
      if (vote.status === "open") await resolveVote(vote, clan);
      return res.status(409).json({ message: "Le vote est terminé." });
    }
    const option = vote.options.find((item) => item.key === String(req.body.option));
    if (!option) return res.status(400).json({ message: "Choix invalide." });
    const amount = Number(req.body.amount);
    const amountUnits = toUnits(amount);
    if (!Number.isFinite(amount) || amountUnits < PIZ_UNIT / 100 || amountUnits > 100000 * PIZ_UNIT) {
      return res.status(400).json({ message: "Déploie au moins 0,01 Piz et au maximum 100 000 Piz." });
    }
    if (vote.votedBy.some((id) => idOf(id) === userId)) return res.status(409).json({ message: "Tu as déjà participé à ce vote." });

    await transferPiz({
      fromUserId: userId,
      amount,
      type: "clan-vote-stake",
      operationId: "clan-vote-stake:" + vote._id + ":" + userId,
      description: "Piz déployés dans un vote de clan",
      metadata: { clanId: String(clan._id), voteId: String(vote._id), option: option.key }
    });
    const update = await ClanVote.updateOne(
      { _id: vote._id, status: "open", closesAt: { $gt: new Date() }, votedBy: { $ne: req.user.userId }, eligibleVoters: req.user.userId },
      {
        $inc: { "options.$[selected].votes": fromUnits(amountUnits), stakesUnits: amountUnits },
        $addToSet: { votedBy: req.user.userId },
        $push: { ballots: { voter: req.user.userId, option: option.key, amountUnits } }
      },
      { arrayFilters: [{ "selected.key": option.key }] }
    );
    if (!update.modifiedCount) {
      const latest = await ClanVote.findById(vote._id);
      if (latest?.votedBy.some((id) => idOf(id) === userId)) return res.json(publicVote(latest, userId));
      await payFromReserve({
        toUserId: userId,
        amountUnits,
        type: "clan-vote-refund",
        operationId: "clan-vote-rejected-refund:" + vote._id + ":" + userId,
        description: "Remboursement d’un vote fermé avant validation",
        metadata: { clanId: String(clan._id), voteId: String(vote._id) }
      });
      return res.status(409).json({ message: "Le vote vient de se fermer. Les Piz ont été remboursés." });
    }
    let updated = await ClanVote.findById(vote._id);
    if (updated.votedBy.length >= updated.eligibleVoters.length) {
      await resolveVote(updated, clan);
      updated = await ClanVote.findById(vote._id);
    }
    return res.json(publicVote(updated, userId));
  } catch (error) {
    if (error.code === "PIZ_INSUFFICIENT_FUNDS") return res.status(402).json({ message: error.message });
    console.error(error);
    return res.status(500).json({ message: "Impossible d'enregistrer ton vote." });
  }
};

const settleExpiredVotes = async () => {
  const staleBefore = new Date(Date.now() - 2 * 60 * 1000);
  const votes = await ClanVote.find({
    $or: [
      { status: "open", closesAt: { $lte: new Date() } },
      { status: "settling", settlementStartedAt: { $lt: staleBefore } }
    ]
  }).limit(100);
  for (const vote of votes) {
    const clan = await Clan.findById(vote.clan);
    if (clan) await resolveVote(vote, clan);
  }
};

module.exports = { listVotes, createVote, castVote, settleExpiredVotes };
