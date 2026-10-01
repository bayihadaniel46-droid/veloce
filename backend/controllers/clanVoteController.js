const mongoose = require("mongoose");
const Clan = require("../models/Clan");
const ClanVote = require("../models/ClanVote");
const idOf = (v) => String(v?._id || v);
const isMember = (clan, id) => clan.members.some((m) => idOf(m) === String(id));
const publicVote = (vote, userId) => ({ _id: vote._id, title: vote.title, kind: vote.kind, options: vote.options.map(({ key, label, votes }) => ({ key, label, votes })), totalVotes: vote.options.reduce((n, o) => n + o.votes, 0), hasVoted: vote.votedBy.some((id) => idOf(id) === String(userId)), status: vote.status, result: vote.result, closesAt: vote.closesAt, createdAt: vote.createdAt });

const resolveVote = async (vote, clan) => {
  if (vote.status !== "open") return;
  const ranked = [...vote.options].sort((a, b) => b.votes - a.votes);
  const total = ranked.reduce((n, o) => n + o.votes, 0);
  const winner = ranked[0];
  const majority = winner && winner.votes > total / 2 && (!ranked[1] || ranked[1].votes < winner.votes);
  vote.status = "closed";
  vote.result = majority ? winner.key : "no-majority";
  if (majority && vote.kind === "leader" && isMember(clan, winner.key)) {
    const formerChief = idOf(clan.owner);
    if (formerChief !== winner.key) clan.administrators.addToSet(formerChief);
    clan.owner = winner.key;
    clan.administrators.pull(winner.key); clan.moderators.pull(winner.key);
    await clan.save();
  }
  if (majority && vote.kind === "rank" && vote.target) {
    clan.administrators.pull(vote.target); clan.moderators.pull(vote.target);
    if (winner.key === "administrator") clan.administrators.addToSet(vote.target);
    if (winner.key === "moderator") clan.moderators.addToSet(vote.target);
    await clan.save();
  }
  await vote.save();
};

const listVotes = async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.clanId);
    if (!clan) return res.status(404).json({ message: "Clan introuvable." });
    if (!isMember(clan, req.user.userId)) return res.sendStatus(403);
    const votes = await ClanVote.find({ clan: clan._id }).sort({ createdAt: -1 });
    for (const vote of votes) if (vote.status === "open" && vote.closesAt <= new Date()) await resolveVote(vote, clan);
    return res.json(votes.map((vote) => publicVote(vote, req.user.userId)));
  } catch (e) { console.error(e); return res.status(500).json({ message: "Impossible de charger les votes." }); }
};

const createVote = async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.clanId);
    if (!clan) return res.status(404).json({ message: "Clan introuvable." });
    if (!isMember(clan, req.user.userId)) return res.sendStatus(403);
    const { title, kind, target, options } = req.body;
    if (!String(title || "").trim() || !["leader", "rank"].includes(kind)) return res.status(400).json({ message: "Titre ou type de vote invalide." });
    let ballotOptions; let targetId = null;
    if (kind === "leader") {
      ballotOptions = (Array.isArray(options) ? options : []).map((o) => ({ key: String(o.key), label: String(o.label || "Candidat") }));
      if (ballotOptions.length < 2 || ballotOptions.length > 10 || ballotOptions.some((o) => !mongoose.isValidObjectId(o.key) || !isMember(clan, o.key))) return res.status(400).json({ message: "Sélectionne de 2 à 10 candidats membres du clan." });
    } else {
      targetId = String(target || "");
      if (!mongoose.isValidObjectId(targetId) || !isMember(clan, targetId) || targetId === idOf(clan.owner)) return res.status(400).json({ message: "Membre cible invalide. Le chef se change par une élection." });
      ballotOptions = [{ key: "member", label: "Membre" }, { key: "moderator", label: "Modérateur" }, { key: "administrator", label: "Administrateur" }];
    }
    const vote = await ClanVote.create({ clan: clan._id, proposer: req.user.userId, title: String(title).trim().slice(0, 140), kind, target: targetId, options: ballotOptions, eligibleVoters: clan.members, closesAt: new Date(Date.now() + 72 * 60 * 60 * 1000) });
    return res.status(201).json(publicVote(vote, req.user.userId));
  } catch (e) { console.error(e); return res.status(500).json({ message: "Impossible de créer le vote." }); }
};

const castVote = async (req, res) => {
  try {
    const vote = await ClanVote.findOne({ _id: req.params.voteId, clan: req.params.clanId });
    const clan = await Clan.findById(req.params.clanId);
    if (!vote || !clan) return res.status(404).json({ message: "Vote introuvable." });
    if (!isMember(clan, req.user.userId) || !vote.eligibleVoters.some((id) => idOf(id) === String(req.user.userId))) return res.sendStatus(403);
    if (vote.status !== "open" || vote.closesAt <= new Date()) { await resolveVote(vote, clan); return res.status(409).json({ message: "Le vote est terminé." }); }
    const option = vote.options.find((o) => o.key === String(req.body.option));
    if (!option) return res.status(400).json({ message: "Choix invalide." });
    const update = await ClanVote.updateOne({ _id: vote._id, status: "open", closesAt: { $gt: new Date() }, votedBy: { $ne: req.user.userId }, eligibleVoters: req.user.userId }, { $inc: { "options.$[selected].votes": 1 }, $addToSet: { votedBy: req.user.userId } }, { arrayFilters: [{ "selected.key": option.key }] });
    if (!update.modifiedCount) return res.status(409).json({ message: "Tu as déjà voté." });
    const updated = await ClanVote.findById(vote._id);
    if (updated.votedBy.length >= updated.eligibleVoters.length) await resolveVote(updated, clan);
    return res.json(publicVote(updated, req.user.userId));
  } catch (e) { console.error(e); return res.status(500).json({ message: "Impossible d'enregistrer ton vote." }); }
};

const settleExpiredVotes = async () => {
  const expired = await ClanVote.find({ status: "open", closesAt: { $lte: new Date() } }).limit(100);
  for (const vote of expired) {
    const clan = await Clan.findById(vote.clan);
    if (clan) await resolveVote(vote, clan);
  }
};

module.exports = { listVotes, createVote, castVote, settleExpiredVotes };
