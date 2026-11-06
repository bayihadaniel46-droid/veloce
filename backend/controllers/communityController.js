const CommunityMessage = require("../models/CommunityMessage");
const CommunityGuidePurchase = require("../models/CommunityGuidePurchase");
const { transferPiz } = require("../services/pizEconomy");

const COMMUNITY_GUIDES = [
  { id: "bienvenue", icon: "🌟", category: "Découvrir", title: "Bien démarrer sur Veloce", summary: "Repères pour comprendre l’accueil, Explorer, les publications et les conversations.", content: "Veloce réunit plusieurs espaces. L’accueil montre les publications et les vidéos. Explorer rassemble les découvertes et les fonctions communautaires. La messagerie sert aux échanges privés, aux clans et au clan serveur.\n\nLes boutons de navigation te ramènent à ces espaces. Ouvre ton profil pour retrouver tes publications et tes préférences. Si un élément est nouveau, une pastille peut t’indiquer où le découvrir.\n\nGarde tes informations de connexion privées et vérifie le nom de l’espace avant de publier. Les fonctions marquées d’un prix en Piz débitent le portefeuille Veloce après confirmation de l’action." },
  { id: "messagerie", icon: "💬", category: "Communiquer", title: "Messagerie et conversations", summary: "Organiser les discussions privées, retrouver un contact et gérer une conversation.", content: "La liste des messages est organisée par espaces : clan serveur, clans privés, favoris et conversations privées. Chaque groupe se replie pour garder la liste lisible. Utilise la recherche pour trouver un membre.\n\nDans une conversation, touche le nom ou l’avatar pour ouvrir son profil de contact. Tu peux ajuster le thème et le fond, enregistrer un surnom privé, épingler ou mettre la conversation en sourdine. Ces préférences sont propres à ton compte et à ton appareil.\n\nMaintiens un message pour afficher ses actions disponibles. La bibliothèque d’emojis aide à chercher un emoji à partir d’un mot. L’accès temporaire au clavier alphabétique coûte 1 Piz et reste actif trois heures." },
  { id: "clans", icon: "✉️", category: "Communiquer", title: "Clans privés et enveloppes", summary: "Créer un clan, sélectionner ses destinataires et envoyer des messages privés au sein du groupe.", content: "Un clan privé réunit les personnes que tu invites. Quand tu écris, choisis précisément les destinataires : le message est placé dans une enveloppe et seuls les destinataires choisis peuvent l’ouvrir. Les autres membres voient l’enveloppe verrouillée, pas son contenu.\n\nTu peux cocher tous les membres d’un coup ou n’en choisir que quelques-uns. Pour répondre, ouvre une enveloppe qui t’est adressée puis utilise la réponse. Tu peux signer le message pour afficher ton nom. Un expéditeur anonyme peut être révélé par un destinataire au coût indiqué dans l’interface.\n\nLa gouvernance du clan permet d’organiser les rôles et les votes. Vérifie les candidats et le montant de Piz avant de valider un vote." },
  { id: "clan-serveur", icon: "🌐", category: "Communiquer", title: "Le clan serveur", summary: "Trouver de l’aide, poser une question et consulter les nouveautés partagées avec toute la communauté.", content: "Le clan serveur est l’espace commun de Veloce : les discussions et questions publiées y sont visibles par tous les membres. L’onglet Discussions sert aux échanges. L’onglet Guides Veloce regroupe dix documents d’aide consultables après déverrouillage.\n\nUne question envoyée dans le clan serveur coûte 10 Piz, versés à la réserve administrative. Une discussion simple n’a pas ce frais. Les annonces de nouveauté sont publiées par l’équipe.\n\nReste courtois, ne publie pas de données personnelles ou de mots de passe et utilise les outils de signalement s’ils sont disponibles. Les pastilles attirent ton attention sur l’espace lors de ta première visite." },
  { id: "publications", icon: "📣", category: "Publier", title: "Posts, vidéos et statuts", summary: "Choisir le bon format, publier proprement et comprendre les frais affichés.", content: "Les posts servent aux contenus que tu veux retrouver dans le fil. Les vidéos sont destinées aux séquences visuelles. Les statuts sont des partages éphémères qui expirent au bout de 24 heures. Relis ton contenu et vérifie les destinataires ou les paramètres de visibilité avant d’envoyer.\n\nLa publication d’un post ou d’un statut peut coûter 1 Piz, comme indiqué dans l’écran de confirmation. Le coût est débité seulement au moment de l’action acceptée. Si le portefeuille est insuffisant, la publication ne doit pas rester affichée comme publiée.\n\nRespecte les droits des personnes représentées et les droits d’auteur. Évite de publier des images privées sans leur accord." },
  { id: "centre-donnees", icon: "🕯️", category: "Explorer", title: "Centre des données anonymes", summary: "Partager une pensée sans nom visible et comprendre le déverrouillage d’identité.", content: "Le Centre des données, aussi appelé Carrefour ou espace anonyme, accueille des statuts et des pensées sans nom d’auteur affiché dans le fil. Il permet de découvrir des idées que leurs auteurs n’ont pas souhaité publier sous leur profil. Les contenus ne sont pas pour autant confidentiels : les autres utilisateurs peuvent les lire.\n\nPartager une information n’accorde pas automatiquement de Piz. Si un lecteur choisit de payer 15 Piz pour connaître l’identité de l’auteur, 7,5 Piz sont versés à l’auteur et 7,5 Piz à la réserve administrative. L’identité n’est révélée qu’après confirmation de ce paiement.\n\nN’envoie jamais de secret, de donnée médicale, bancaire ou permettant de localiser une personne. L’anonymat protège le nom affiché, pas contre les captures d’écran ni les contenus dangereux." },
  { id: "piz-portefeuille", icon: "🪙", category: "Piz", title: "Portefeuille et mouvements Piz", summary: "Lire son solde, vérifier les frais et comprendre les transferts entre membres.", content: "Le portefeuille affiche les Piz disponibles et les mouvements enregistrés. Les nouveaux comptes reçoivent une dotation initiale de 100 Piz. Les comptes déjà actifs conservent leurs gains et dépenses comptabilisés lors de l’initialisation du portefeuille.\n\nAvant une action payante, vérifie son coût et le solde. Les frais communautaires et certains services sont versés à la réserve administrative lorsque l’interface le précise. Un transfert direct à un membre est distinct d’une commission.\n\nS’abonner à une personne coûte 0,5 Piz : la totalité est versée au membre suivi, sans part administrative. Se désabonner ne rembourse pas le paiement initial. Consulte l’historique des transactions pour vérifier les débits et crédits." },
  { id: "tendances", icon: "📈", category: "Piz", title: "Tendances du marché Piz", summary: "Interpréter les mouvements agrégés et la négociation entre détenteurs.", content: "La page Tendances rassemble les opérations Piz connues de Veloce et des repères agrégés. Elle aide à observer les volumes et l’évolution des échanges ; elle ne garantit pas un prix de vente futur. Les achats effectués dans une application externe ne sont visibles que si cette application transmet correctement leur événement à Veloce.\n\nLa valeur du Piz se négocie entre détenteurs et acheteurs. Les exemples de quantités pour un montant donné servent de repères, pas de promesse de prix. Vérifie la date et la période observées avant de comparer deux chiffres.\n\nNe dépense pas sur la seule base d’une tendance passée. Confirme l’identité du destinataire et le montant exact avant toute opération." },
  { id: "clans-votes", icon: "⚖️", category: "Communiquer", title: "Votes et gouvernance des clans", summary: "Proposer une décision, engager un poids de vote en Piz et lire le résultat.", content: "Les membres autorisés peuvent proposer une élection ou une décision de rang. Les votes sont anonymes : les autres membres voient les options et leur poids cumulé, pas le choix individuel de chaque votant. Une voix correspond à 1 Piz engagé ; les montants fractionnaires sont possibles si l’écran les accepte.\n\nLe gagnant d’une élection reçoit la moitié des Piz engagés. La part restante demeure dans la réserve administrative. Si aucune majorité valide ne se dégage, les mises sont rendues selon le résultat affiché. Les Piz sont engagés au moment du vote : choisis ton montant avant de confirmer.\n\nLis la durée, les options et les conditions de résultat avant de voter. Une fois enregistré, le choix est définitif pour ce scrutin." },
  { id: "profil-securite", icon: "🛡️", category: "Profil", title: "Profil, appels et sécurité", summary: "Personnaliser ton profil, gérer les notifications et protéger tes échanges.", content: "Le profil de contact donne accès aux informations publiques disponibles et aux préférences privées de votre conversation : thème, fond, surnom, relation, favoris, épinglage et sourdine. Les réglages locaux ne changent pas le profil de l’autre personne.\n\nLes appels audio et vidéo demandent l’autorisation du micro ou de la caméra dans le navigateur. Refuse l’autorisation si tu ne souhaites pas transmettre ce flux. Les notifications peuvent nécessiter une permission du système et du navigateur.\n\nN’envoie pas de code de connexion ni de phrase secrète dans un message. En cas de problème, vérifie les réglages de notification, le réseau et les autorisations de l’appareil." }
];

const communityAdminIds = () => (process.env.COMMUNITY_ADMIN_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

const isCommunityAdmin = (userId) => communityAdminIds().includes(String(userId));

const serializeMessage = (message) => ({
  _id: message._id,
  kind: message.kind,
  content: message.content,
  createdAt: message.createdAt,
  sender: message.sender && typeof message.sender === "object" ? {
    _id: String(message.sender._id),
    username: message.sender.username,
    avatar: message.sender.avatar
  } : null
});

const listCommunityMessages = async (req, res) => {
  try {
    const messages = await CommunityMessage.find()
      .populate("sender", "username avatar")
      .sort({ createdAt: -1 })
      .limit(250);
    messages.reverse();
    return res.json({ messages: messages.map(serializeMessage), canPublish: isCommunityAdmin(req.user.userId) });
  } catch (error) {
    console.error("Erreur chargement clan serveur :", error);
    return res.status(500).json({ message: "Impossible de charger le clan serveur." });
  }
};

const sendCommunityMessage = async (req, res) => {
  const content = String(req.body.content || "").trim();
  const kind = req.body.kind === "question" ? "question" : "message";
  if (!content) return res.status(400).json({ message: "Écris une question ou un message avant l’envoi." });
  if (content.length > 3000) return res.status(400).json({ message: "Le message ne peut pas dépasser 3 000 caractères." });
  try {
    const message = await CommunityMessage.create({ sender: req.user.userId, kind: "message", content });
    if (kind === "question") {
      message.kind = "question";
      await message.save();
      try {
        await transferPiz({ fromUserId: req.user.userId, amount: 10, type: "server-clan-question", description: "Question publiée dans le clan serveur", metadata: { messageId: String(message._id) } });
      } catch (paymentError) {
        await CommunityMessage.deleteOne({ _id: message._id });
        if (paymentError.code === "PIZ_INSUFFICIENT_FUNDS") return res.status(402).json({ message: paymentError.message });
        throw paymentError;
      }
    }
    await message.populate("sender", "username avatar");
    return res.status(201).json(serializeMessage(message));
  } catch (error) {
    console.error("Erreur envoi clan serveur :", error);
    return res.status(500).json({ message: "Impossible d’envoyer le message dans le clan serveur." });
  }
};

const publishCommunityUpdate = async (req, res) => {
  if (!isCommunityAdmin(req.user.userId)) return res.status(403).json({ message: "Seule l’équipe Veloce peut publier une nouveauté dans le clan serveur." });
  const kind = req.body.kind === "ad" ? "ad" : "announcement";
  const content = String(req.body.content || "").trim();
  if (!content) return res.status(400).json({ message: "Le contenu de la publication est vide." });
  if (content.length > 3000) return res.status(400).json({ message: "La publication ne peut pas dépasser 3 000 caractères." });
  try {
    const message = await CommunityMessage.create({ sender: req.user.userId, kind, content });
    await message.populate("sender", "username avatar");
    return res.status(201).json(serializeMessage(message));
  } catch (error) {
    console.error("Erreur publication clan serveur :", error);
    return res.status(500).json({ message: "Impossible de publier dans le clan serveur." });
  }
};

const listCommunityGuides = async (req, res) => {
  try {
    const purchases = await CommunityGuidePurchase.find({ user: req.user.userId }).select("guideId");
    const unlockedIds = new Set(purchases.map((purchase) => purchase.guideId));
    return res.json({ guides: COMMUNITY_GUIDES.map(({ content, ...guide }) => {
      const unlocked = unlockedIds.has(guide.id);
      return { ...guide, price: 1, unlocked, content: unlocked ? content : null };
    }) });
  } catch (error) {
    console.error("Erreur chargement guides Veloce :", error);
    return res.status(500).json({ message: "Impossible de charger les guides du clan serveur." });
  }
};

const unlockCommunityGuide = async (req, res) => {
  const guide = COMMUNITY_GUIDES.find((item) => item.id === req.params.guideId);
  if (!guide) return res.status(404).json({ message: "Ce guide n’existe pas." });
  try {
    const userId = req.user.userId;
    const existing = await CommunityGuidePurchase.findOne({ user: userId, guideId: guide.id });
    if (existing) return res.json({ guide: { id: guide.id, title: guide.title, content: guide.content, unlocked: true } });

    const transaction = await transferPiz({
      fromUserId: userId,
      amount: 1,
      type: "server-clan-guide",
      description: `Déverrouillage du guide « ${guide.title} »`,
      operationId: `server-guide:${userId}:${guide.id}`,
      metadata: { guideId: guide.id }
    });
    const purchase = await CommunityGuidePurchase.findOneAndUpdate(
      { user: userId, guideId: guide.id },
      { $setOnInsert: { transaction: transaction._id } },
      { upsert: true, new: true }
    );
    return res.json({ guide: { id: guide.id, title: guide.title, content: guide.content, unlocked: true, purchasedAt: purchase.createdAt } });
  } catch (error) {
    if (error.code === "PIZ_INSUFFICIENT_FUNDS") return res.status(402).json({ message: error.message });
    if (error.code === 11000) return res.json({ guide: { id: guide.id, title: guide.title, content: guide.content, unlocked: true } });
    if (/already in progress/i.test(error.message)) return res.status(409).json({ message: "Ce déverrouillage est déjà en cours. Réessaie dans un instant." });
    console.error("Erreur achat guide Veloce :", error);
    return res.status(500).json({ message: "Impossible de déverrouiller ce guide." });
  }
};

module.exports = { listCommunityMessages, sendCommunityMessage, publishCommunityUpdate, listCommunityGuides, unlockCommunityGuide };
