const mongoose = require("mongoose");
const CallSession = require("../models/CallSession");
const User = require("../models/User");
const { isContactBlocked } = require("../utils/contactPolicy");

const participantProjection = "username avatar bio";

const serializeCall = (call) => ({
  id: String(call._id),
  mode: call.mode || "audio",
  status: call.status,
  caller: call.caller && typeof call.caller === "object" ? {
    id: String(call.caller._id), username: call.caller.username, avatar: call.caller.avatar, bio: call.caller.bio
  } : { id: String(call.caller) },
  recipient: call.recipient && typeof call.recipient === "object" ? {
    id: String(call.recipient._id), username: call.recipient.username, avatar: call.recipient.avatar, bio: call.recipient.bio
  } : { id: String(call.recipient) },
  createdAt: call.createdAt
});

const getIncomingCalls = async (req, res) => {
  try {
    const now = Date.now();
    const calls = await CallSession.find({ recipient: req.user.userId, status: "ringing", createdAt: { $gt: new Date(now - 60000) }, expiresAt: { $gt: new Date(now) } })
      .populate("caller", participantProjection).populate("recipient", participantProjection)
      .sort({ createdAt: -1 }).limit(5);
    return res.json(calls.map(serializeCall));
  } catch (error) {
    console.error("Chargement des appels entrants :", error);
    return res.status(500).json({ message: "Impossible de récupérer les appels entrants." });
  }
};

const startCall = async (req, res) => {
  try {
    const recipientId = String(req.body.recipientId || "");
    const mode = req.body.mode === "video" ? "video" : req.body.mode === "audio" || !req.body.mode ? "audio" : null;
    if (!mode) return res.status(400).json({ message: "Type d’appel invalide." });
    if (!mongoose.isValidObjectId(recipientId) || recipientId === String(req.user.userId)) {
      return res.status(400).json({ message: "Destinataire d’appel invalide." });
    }
    const recipient = await User.findById(recipientId).select("_id");
    if (!recipient) return res.status(404).json({ message: "Ce compte n’existe plus." });
    if (await isContactBlocked(req.user.userId, recipientId)) return res.status(403).json({ message: "Cet appel est indisponible à cause d’un blocage." });

    const active = await CallSession.findOne({
      status: { $in: ["ringing", "active"] },
      expiresAt: { $gt: new Date() },
      $or: [{ caller: req.user.userId }, { recipient: req.user.userId }, { caller: recipientId }, { recipient: recipientId }]
    });
    if (active) return res.status(409).json({ message: "L’un de ces utilisateurs est déjà en appel." });

    const call = await CallSession.create({
      caller: req.user.userId,
      recipient: recipientId,
      mode,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000)
    });
    await call.populate(["caller", "recipient"], participantProjection);
    return res.status(201).json(serializeCall(call));
  } catch (error) {
    console.error("Démarrage d’appel :", error);
    return res.status(500).json({ message: "Impossible de démarrer cet appel." });
  }
};

const getCall = async (req, res) => {
  try {
    const call = await CallSession.findById(req.params.callId).populate("caller", participantProjection).populate("recipient", participantProjection);
    if (!call) return res.status(404).json({ message: "Cet appel n’existe plus." });
    const currentUser = String(req.user.userId);
    if (currentUser !== String(call.caller._id) && currentUser !== String(call.recipient._id)) {
      return res.status(403).json({ message: "Cet appel ne vous est pas destiné." });
    }
    const after = Math.max(0, Number.parseInt(req.query.after || "0", 10) || 0);
    const events = call.events.filter((event) => event.sequence > after).map((event) => ({
      sequence: event.sequence,
      sender: String(event.sender),
      type: event.type,
      payload: event.payload
    }));
    return res.json({ ...serializeCall(call), events });
  } catch (error) {
    console.error("Lecture de l’appel :", error);
    return res.status(500).json({ message: "Impossible de synchroniser cet appel." });
  }
};

const updateCall = async (req, res) => {
  const action = req.body.action;
  if (!["accept", "decline", "end"].includes(action)) return res.status(400).json({ message: "Action d’appel invalide." });
  try {
    const call = await CallSession.findById(req.params.callId);
    if (!call) return res.status(404).json({ message: "Cet appel n’existe plus." });
    const currentUser = String(req.user.userId);
    const isCaller = currentUser === String(call.caller);
    const isRecipient = currentUser === String(call.recipient);
    if (!isCaller && !isRecipient) return res.status(403).json({ message: "Cet appel ne vous est pas destiné." });
    if (action === "accept" && (!isRecipient || call.status !== "ringing")) return res.status(409).json({ message: "Cet appel ne peut plus être accepté." });
    if (action === "decline" && (!isRecipient || call.status !== "ringing")) return res.status(409).json({ message: "Cet appel ne peut plus être refusé." });
    if (action === "end" && !["ringing", "active"].includes(call.status)) return res.status(409).json({ message: "Cet appel est déjà terminé." });
    call.status = action === "accept" ? "active" : action === "decline" ? "declined" : "ended";
    if (action === "accept") call.expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await call.save();
    return res.json({ id: String(call._id), status: call.status });
  } catch (error) {
    console.error("Mise à jour d’appel :", error);
    return res.status(500).json({ message: "Impossible de mettre à jour cet appel." });
  }
};

const sendCallEvent = async (req, res) => {
  const { type, payload } = req.body;
  if (!["offer", "answer", "ice"].includes(type) || !payload || JSON.stringify(payload).length > 120000) {
    return res.status(400).json({ message: "Signal d’appel invalide." });
  }
  try {
    const call = await CallSession.findById(req.params.callId);
    if (!call) return res.status(404).json({ message: "Cet appel n’existe plus." });
    const currentUser = String(req.user.userId);
    const isCaller = currentUser === String(call.caller);
    const isRecipient = currentUser === String(call.recipient);
    if (!isCaller && !isRecipient) return res.status(403).json({ message: "Cet appel ne vous est pas destiné." });
    if (!["ringing", "active"].includes(call.status)) return res.status(409).json({ message: "Cet appel est terminé." });
    if ((type === "offer" && !isCaller) || (type === "answer" && !isRecipient)) return res.status(403).json({ message: "Ce signal ne correspond pas à votre rôle dans l’appel." });
    if (type === "offer" && call.events.some((event) => event.type === "offer")) return res.status(409).json({ message: "L’offre d’appel existe déjà." });
    if (type === "answer" && !call.events.some((event) => event.type === "offer")) return res.status(409).json({ message: "L’offre d’appel n’est pas encore prête." });
    call.events.push({ sequence: call.events.length + 1, sender: req.user.userId, type, payload });
    await call.save();
    return res.status(201).json({ sequence: call.events.at(-1).sequence });
  } catch (error) {
    console.error("Signal d’appel :", error);
    return res.status(500).json({ message: "Impossible de transmettre le signal d’appel." });
  }
};

module.exports = { getIncomingCalls, startCall, getCall, updateCall, sendCallEvent };
