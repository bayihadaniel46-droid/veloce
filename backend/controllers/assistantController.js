const mongoose = require("mongoose");
const AssistantProfile = require("../models/AssistantProfile");
const AssistantDraft = require("../models/AssistantDraft");
const AssistantSubscription = require("../models/AssistantSubscription");
const AssistantResearch = require("../models/AssistantResearch");
const ClanAssistantKnowledge = require("../models/ClanAssistantKnowledge");
const Clan = require("../models/Clan");
const Post = require("../models/Post");
const User = require("../models/User");
const { PIZ_UNIT, fromUnits, transferPiz, payClanFromReserve } = require("../services/pizEconomy");

const SUBSCRIPTION_PRICE = 5;
const SUBSCRIPTION_DAYS = 30;
const SEARCH_CREDITS = 5;
const SEARCH_REWARD_UNITS = PIZ_UNIT;
const REWARD_RESERVE = "assistant-knowledge";
const getOrCreate = (owner) => AssistantProfile.findOneAndUpdate({ owner }, { $setOnInsert: { owner } }, { new: true, upsert: true, setDefaultsOnInsert: true });

const subscriptionView = (subscription) => {
  const active = Boolean(subscription?.status === "active" && subscription.expiresAt && subscription.expiresAt > new Date());
  return {
    active,
    pending: subscription?.status === "pending",
    operationId: subscription?.status === "pending" ? subscription.operationId : null,
    expiresAt: subscription?.expiresAt || null,
    creditsTotal: subscription?.creditsTotal || SEARCH_CREDITS,
    creditsRemaining: active ? subscription.creditsRemaining : 0,
    price: SUBSCRIPTION_PRICE,
    days: SUBSCRIPTION_DAYS
  };
};

const getProfile = async (req, res) => {
  try {
    const [profile, subscription] = await Promise.all([
      getOrCreate(req.user.userId),
      AssistantSubscription.findOne({ owner: req.user.userId })
    ]);
    return res.json({ profile, subscription: subscriptionView(subscription) });
  } catch (error) {
    console.error("Chargement de l’assistant Veloce :", error);
    return res.status(500).json({ message: "Impossible de charger l’espace de l’assistant." });
  }
};

const updateProfile = async (req, res) => {
  try {
    const clean = (value, maxItems, maxLength) => Array.isArray(value)
      ? [...new Set(value.filter((item) => typeof item === "string").map((item) => item.trim().slice(0, maxLength)).filter(Boolean))].slice(0, maxItems)
      : undefined;
    const update = {};
    const topics = clean(req.body.topics, 12, 80);
    const preferredSources = clean(req.body.preferredSources, 10, 120);
    if (topics !== undefined) update.topics = topics;
    if (preferredSources !== undefined) update.preferredSources = preferredSources;
    if (typeof req.body.language === "string") update.language = req.body.language.trim().slice(0, 12) || "fr";
    if (typeof req.body.tone === "string") update.tone = req.body.tone.trim().slice(0, 80) || "accessible et informatif";
    const profile = await AssistantProfile.findOneAndUpdate(
      { owner: req.user.userId },
      { $set: update, $setOnInsert: { owner: req.user.userId } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.json({ message: "Préférences enregistrées.", profile });
  } catch (error) {
    console.error("Enregistrement des préférences IA :", error);
    return res.status(500).json({ message: "Impossible d’enregistrer les préférences." });
  }
};

const subscribe = async (req, res) => {
  const userId = req.user.userId;
  const clientOperationId = String(req.body.operationId || "").trim();
  if (clientOperationId.length < 8 || clientOperationId.length > 120) return res.status(400).json({ message: "Identifiant d’abonnement invalide." });
  const operationId = clientOperationId.startsWith(`assistant-subscription:${userId}:`) ? clientOperationId : `assistant-subscription:${userId}:${clientOperationId}`;
  const paymentOperationId = operationId.replace(`assistant-subscription:${userId}:`, `assistant-subscription-payment:${userId}:`);
  const now = new Date();
  try {
    let subscription = await AssistantSubscription.findOne({ owner: userId });
    if (subscription?.status === "active" && subscription.expiresAt > now) return res.status(409).json({ message: "Ton abonnement est déjà actif.", subscription: subscriptionView(subscription) });
    if (subscription?.status === "pending" && subscription.operationId !== operationId) return res.status(409).json({ message: "Un paiement d’abonnement est déjà en cours. Réessaie dans quelques instants." });
    if (!subscription || subscription.status !== "pending") {
      const filter = subscription
        ? { _id: subscription._id, $or: [{ expiresAt: null }, { expiresAt: { $lte: now } }, { status: "expired" }] }
        : { owner: userId };
      subscription = await AssistantSubscription.findOneAndUpdate(filter, {
        $set: { operationId, status: "pending", startsAt: null, expiresAt: null, creditsTotal: SEARCH_CREDITS, creditsRemaining: SEARCH_CREDITS, creditsUsed: 0, usedResearches: [] },
        $setOnInsert: { owner: userId }
      }, { new: true, upsert: true, setDefaultsOnInsert: true });
    }
    if (subscription.operationId !== operationId) return res.status(409).json({ message: "Un autre paiement d’abonnement est en cours." });
    await transferPiz({
      fromUserId: userId,
      amount: SUBSCRIPTION_PRICE,
      type: "assistant-ideas-subscription",
      operationId: paymentOperationId,
      description: "Abonnement de 30 jours aux recherches d’idées Veloce",
      platformReserveKey: REWARD_RESERVE,
      metadata: { userId: String(userId), searchesIncluded: SEARCH_CREDITS, durationDays: SUBSCRIPTION_DAYS }
    });
    subscription.status = "active";
    subscription.startsAt = now;
    subscription.expiresAt = new Date(now.getTime() + SUBSCRIPTION_DAYS * 86400000);
    subscription.creditsTotal = SEARCH_CREDITS;
    subscription.creditsRemaining = SEARCH_CREDITS;
    subscription.creditsUsed = 0;
    subscription.usedResearches = [];
    await subscription.save();
    return res.json({ message: "Abonnement activé : 5 recherches d’idées pendant 30 jours.", subscription: subscriptionView(subscription) });
  } catch (error) {
    if (error.code === "PIZ_INSUFFICIENT_FUNDS") {
      await AssistantSubscription.updateOne({ owner: userId, operationId, status: "pending" }, { $set: { status: "expired", expiresAt: now } });
      return res.status(402).json({ message: error.message });
    }
    if (error.code === 11000) {
      const current = await AssistantSubscription.findOne({ owner: userId });
      if (current?.status === "active" && current.expiresAt > new Date()) return res.status(409).json({ message: "Ton abonnement est déjà actif.", subscription: subscriptionView(current) });
      return res.status(409).json({ message: "Un paiement d’abonnement est déjà en cours. Réessaie dans quelques instants." });
    }
    console.error("Activation de l’abonnement de l’assistant :", error);
    return res.status(500).json({ message: "Impossible d’activer l’abonnement." });
  }
};

const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const STOP_WORDS = new Set(["avec", "pour", "dans", "des", "les", "une", "aux", "sur", "qui", "que", "quoi", "comment", "pourquoi", "plus", "moins", "mon", "mes", "notre", "leurs", "leur", "est", "sont", "par", "et", "ou", "the", "and", "for", "from", "this", "that"]);
const tokensOf = (value) => [...new Set(normalize(value).split(/[^a-z0-9]+/).filter((term) => term.length > 1 && !STOP_WORDS.has(term)))];
const scoreKnowledge = (item, terms) => {
  const title = normalize(item.title);
  const topic = normalize(item.topic);
  const summary = normalize(item.summary);
  const content = normalize(item.content);
  return terms.reduce((score, term) => score + (topic.includes(term) ? 7 : 0) + (title.includes(term) ? 5 : 0) + (summary.includes(term) ? 3 : 0) + (content.includes(term) ? 1 : 0), 0);
};

const generate = async (req, res) => {
  const userId = req.user.userId;
  const requestId = String(req.body.requestId || "").trim();
  const query = String(req.body.query || "").trim().slice(0, 200);
  if (requestId.length < 8 || requestId.length > 120) return res.status(400).json({ message: "Identifiant de recherche invalide." });
  try {
    const profile = await getOrCreate(userId);
    const activeSubscription = await AssistantSubscription.findOne({ owner: userId, status: "active", expiresAt: { $gt: new Date() } });
    let research = await AssistantResearch.findOne({ owner: userId, requestId });
    if (research?.status === "completed") {
      const drafts = await AssistantDraft.find({ research: research._id, status: "pending" }).sort({ createdAt: -1 });
      const subscription = await AssistantSubscription.findById(research.subscription);
      return res.json({ message: "Cette recherche a déjà été traitée.", drafts, subscription: subscriptionView(subscription) });
    }
    if (!research && !activeSubscription) return res.status(402).json({ message: "Abonne-toi pour 5 Piz : tu recevras 5 recherches pendant 30 jours, rémunérant les clans sources." });
    if (!research && !profile.topics.length && !query) return res.status(400).json({ message: "Ajoute au moins un centre d’intérêt ou écris un sujet de recherche." });

    if (!research) {
      const terms = tokensOf(`${query} ${profile.topics.join(" ")}`);
      const candidates = await ClanAssistantKnowledge.find({ published: true }).populate("clan", "name").sort({ createdAt: -1 }).limit(1000);
      const matches = candidates.map((item) => ({ item, score: scoreKnowledge(item, terms) })).filter((match) => match.score > 0)
        .sort((a, b) => b.score - a.score || Number(b.item.usageCount || 0) - Number(a.item.usageCount || 0) || b.item.createdAt - a.item.createdAt).slice(0, 3);
      if (!matches.length) return res.json({ message: "Aucune information de clan ne correspond encore à ce sujet. Aucun Piz ni recherche n’a été consommé.", drafts: [], subscription: subscriptionView(activeSubscription) });
      const sources = matches.map(({ item }) => ({ document: item._id, clan: item.clan?._id || item.clan }));
      try {
        research = await AssistantResearch.create({ owner: userId, subscription: activeSubscription._id, requestId, query, topics: profile.topics, sources });
      } catch (error) {
        if (error.code !== 11000) throw error;
        research = await AssistantResearch.findOne({ owner: userId, requestId });
      }
    }

    const subscription = await AssistantSubscription.findById(research.subscription);
    if (!subscription) return res.status(402).json({ message: "Abonnement de recherche introuvable." });
    if (!research.creditDebited) {
      const debit = await AssistantSubscription.updateOne(
        { _id: subscription._id, status: "active", expiresAt: { $gt: new Date() }, creditsRemaining: { $gt: 0 }, usedResearches: { $ne: research._id } },
        { $inc: { creditsRemaining: -1, creditsUsed: 1 }, $addToSet: { usedResearches: research._id } }
      );
      const latest = await AssistantSubscription.findById(subscription._id);
      const alreadyDebited = latest?.usedResearches.some((id) => String(id) === String(research._id));
      if (!debit.modifiedCount && !alreadyDebited) {
        await AssistantResearch.deleteOne({ _id: research._id, creditDebited: false });
        return res.status(402).json({ message: "Tes recherches incluses sont épuisées ou l’abonnement est arrivé à expiration." });
      }
      research.creditDebited = true;
      await research.save();
    }

    const ids = research.sources.map((source) => source.document);
    const documents = await ClanAssistantKnowledge.find({ _id: { $in: ids }, published: true }).populate("clan", "name");
    const documentMap = new Map(documents.map((doc) => [String(doc._id), doc]));
    const ordered = research.sources.map((source) => documentMap.get(String(source.document))).filter(Boolean);
    if (!ordered.length) return res.status(409).json({ message: "Les sources de cette recherche ne sont plus disponibles." });

    const sourceClans = [...new Set(ordered.map((doc) => String(doc.clan?._id || doc.clan)))];
    const baseShare = Math.floor(SEARCH_REWARD_UNITS / sourceClans.length);
    let remainder = SEARCH_REWARD_UNITS - baseShare * sourceClans.length;
    for (const clanId of sourceClans) {
      const shareUnits = baseShare + (remainder > 0 ? 1 : 0);
      remainder -= remainder > 0 ? 1 : 0;
      await payClanFromReserve({
        clanId,
        amountUnits: shareUnits,
        reserveKey: REWARD_RESERVE,
        type: "assistant-knowledge-reward",
        operationId: `assistant-research-reward:${research._id}:${clanId}`,
        description: "Rémunération d’un clan cité par une recherche d’idées Veloce",
        metadata: { researchId: String(research._id), owner: String(userId), clanId }
      });
    }

    const drafts = [];
    for (const [index, doc] of ordered.entries()) {
      const clanId = String(doc.clan?._id || doc.clan);
      const draft = await AssistantDraft.findOneAndUpdate(
        { research: research._id, researchIndex: index },
        { $setOnInsert: {
          owner: userId,
          research: research._id,
          researchIndex: index,
          title: doc.title,
          content: doc.content.slice(0, 3000),
          sources: [{ title: `${doc.clan?.name || "Clan Veloce"} · ${doc.title}`, url: `/?page=messages&clan=${clanId}`, snippet: doc.summary, date: doc.updatedAt?.toISOString?.().slice(0, 10) || "", clanId: doc.clan?._id || doc.clan, assistantKnowledgeId: doc._id }]
        } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      drafts.push(draft);
    }
    research.status = "completed";
    research.completedAt = new Date();
    await research.save();
    await ClanAssistantKnowledge.updateMany({ _id: { $in: ids } }, { $inc: { usageCount: 1 } });
    const updatedSubscription = await AssistantSubscription.findById(subscription._id);
    return res.status(201).json({ message: "Les clans ont été rémunérés pour ces sources. Tes idées sont prêtes dans ton espace privé.", drafts, subscription: subscriptionView(updatedSubscription) });
  } catch (error) {
    if (error.code === "ASSISTANT_REWARD_POOL_LOW") return res.status(503).json({ message: "Le fonds de rémunération des clans est temporairement indisponible. Réessaie avec le même identifiant de recherche : ton crédit ne sera pas retiré une deuxième fois." });
    console.error("Recherche d’idées de l’assistant Veloce :", error);
    return res.status(500).json({ message: "Impossible de préparer ces idées. Réessaie avec la même recherche." });
  }
};

const getDrafts = async (req, res) => {
  try { return res.json({ drafts: await AssistantDraft.find({ owner: req.user.userId, status: "pending" }).sort({ createdAt: -1 }) }); }
  catch (error) { console.error(error); return res.status(500).json({ message: "Impossible de charger les brouillons." }); }
};

const publish = async (req, res) => {
  try {
    const draft = await AssistantDraft.findOne({ _id: req.params.id, owner: req.user.userId, status: "pending" });
    if (!draft) return res.status(404).json({ message: "Brouillon introuvable ou déjà traité." });
    const user = await User.findById(req.user.userId).select("username");
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable." });
    const post = await Post.create({ author: user._id, username: user.username, content: draft.content, verification: {
      status: "unverified",
      summary: "Information issue d’un document partagé par un clan Veloce. Consultez la source avant de la republier.",
      sources: draft.sources.map(({ title, url, snippet }) => ({ title, url, snippet })),
      checkedAt: new Date()
    } });
    draft.status = "published";
    draft.publishedPost = post._id;
    await draft.save();
    await post.populate("author", "username avatar");
    return res.status(201).json({ message: "Publication publiée sur votre profil.", post });
  } catch (error) { console.error(error); return res.status(500).json({ message: "Impossible de publier ce brouillon." }); }
};

const dismiss = async (req, res) => {
  try {
    const draft = await AssistantDraft.findOneAndUpdate({ _id: req.params.id, owner: req.user.userId, status: "pending" }, { $set: { status: "dismissed" } }, { new: true });
    if (!draft) return res.status(404).json({ message: "Brouillon introuvable ou déjà traité." });
    return res.json({ message: "Brouillon écarté." });
  } catch (error) { console.error(error); return res.status(500).json({ message: "Impossible d’écarter ce brouillon." }); }
};

module.exports = { getProfile, updateProfile, subscribe, generate, getDrafts, publish, dismiss };
