import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import { useAuth } from "../context/authContext";

import {
  getConversations,
  getMessages,
  sendMessage,
  deleteMessage as deleteMessageRequest,
  getClans,
  createClan,
  getClanMessages,
  openClanEnvelope,
  revealClanSender,
  sendClanEnvelope,
  addClanMembers, getClanVotes, createClanVote, castClanVote,
  getIncomingCalls, startAudioCall, startVideoCall, getAudioCall,
  updateAudioCall, sendAudioCallEvent
} from "../services/messageService";
import { API_BASE_URL } from "../config";
import { playUiSound } from "../services/soundService";
import CommunityRoom from "../components/CommunityRoom";
import "./Messages.css";
import "./MessagesGroups.css";

const coreEmojiLibrary = [
  { words: ["amour", "aimer", "je t'aime", "jtm"], emoji: "❤️", label: "Amour" },
  { words: ["bonjour", "salut", "coucou"], emoji: "👋", label: "Salutations" },
  { words: ["merci", "remerciement"], emoji: "🙏", label: "Merci" },
  { words: ["rire", "drôle", "mdr", "haha"], emoji: "😂", label: "Rire" },
  { words: ["triste", "pleurer", "chagrin"], emoji: "😢", label: "Tristesse" },
  { words: ["joie", "heureux", "heureuse", "content"], emoji: "😊", label: "Joie" },
  { words: ["oui", "d'accord", "ok"], emoji: "✅", label: "Oui" },
  { words: ["non", "refus"], emoji: "🙅", label: "Non" },
  { words: ["feu", "bravo", "incroyable"], emoji: "🔥", label: "Super" },
  { words: ["musique", "chanter"], emoji: "🎵", label: "Musique" },
  { words: ["maison", "chez moi"], emoji: "🏠", label: "Maison" },
  { words: ["manger", "repas", "faim"], emoji: "🍽️", label: "Repas" },
  { words: ["dormir", "bonne nuit", "fatigué"], emoji: "😴", label: "Sommeil" },
  { words: ["cœur", "coeur"], emoji: "💖", label: "Cœur" },
  { words: ["anniversaire", "fête"], emoji: "🎉", label: "Fête" },
  { words: ["argent", "rune", "payer"], emoji: "💰", label: "Argent" },
  { words: ["danger", "attention"], emoji: "⚠️", label: "Attention" },
  { words: ["force", "courage"], emoji: "💪", label: "Force" },
  { words: ["soleil", "beau temps"], emoji: "☀️", label: "Soleil" },
  { words: ["pluie", "pleuvoir"], emoji: "🌧️", label: "Pluie" },
];
const makeEmojiEntries = (category, entries) => entries.map(([emoji, label, ...words]) => ({ emoji, label, category, words }));
const EMOJI_LIBRARY = [
  ...coreEmojiLibrary.map((entry) => ({ ...entry, category: "Essentiels" })),
  ...makeEmojiEntries("Émotions", [
    ["🤣", "Fou rire", "éclater de rire", "hilarant", "mort de rire"], ["😆", "Grand sourire", "super content", "ravi"], ["🥹", "Ému", "touché", "émotion", "reconnaissant"], ["🥺", "S’il te plaît", "pitié", "suppliant"], ["😔", "Déçu", "déception", "mélancolie"], ["😤", "Frustré", "agacé", "énervé"], ["😱", "Choqué", "surpris", "effrayé"], ["🤯", "Impressionné", "incroyable", "époustouflé"], ["🤩", "Émerveillé", "fan", "admiratif"], ["😇", "Innocent", "ange", "sage"], ["🤭", "Oups", "gêné", "rire discret"], ["🫣", "Timide", "caché", "je regarde"], ["😏", "Malicieux", "taquin", "clin d’œil"], ["😴", "Somnolent", "sieste", "je dors"], ["🥱", "Bâillement", "fatigue", "épuisé"], ["🤒", "Malade", "fièvre", "pas en forme"], ["🤧", "Rhume", "éternuer", "allergie"], ["🤮", "Dégoûté", "beurk", "écœuré"], ["🤫", "Secret", "silence", "chut"], ["🤐", "Bouche cousue", "je ne dis rien", "motus"], ["😬", "Mal à l’aise", "gênant", "oops"], ["🙃", "Ironie", "à l’envers", "second degré"], ["😵‍💫", "Étourdi", "perdu", "confus"], ["🥳", "Célébrer", "félicitations", "on fête"], ["🤗", "Câlin", "tendresse", "je t’embrasse"], ["🫶", "Avec amour", "main cœur", "je t’aime fort"], ["💌", "Lettre d’amour", "message tendre", "mot doux"], ["💋", "Bisou", "baiser", "bisous"], ["💞", "Amour partagé", "couple", "cœurs"], ["🫂", "Réconfort", "câlin", "je suis là"],
  ]),
  ...makeEmojiEntries("Personnes", [
    ["👋", "Salut", "au revoir", "coucou", "hello"], ["🫡", "Bien reçu", "respect", "à vos ordres"], ["🙋", "Moi", "j’ai une question", "présent"], ["🙌", "Hourra", "victoire", "youpi"], ["👏", "Applaudir", "bravo", "bien joué"], ["🤝", "Accord", "poignée de main", "marché conclu"], ["🫰", "Petit cœur", "love", "mini cœur"], ["🤞", "Bonne chance", "je croise les doigts", "espoir"], ["🤟", "Je t’aime", "rock", "amour"], ["✌️", "Paix", "victoire", "peace"], ["🤘", "Rock", "concert", "metal"], ["👌", "Parfait", "ça marche", "ok"], ["🤌", "Mais oui", "italien", "expressif"], ["🫵", "Toi", "c’est toi", "toi-même"], ["👉", "À droite", "par ici", "regarde"], ["👈", "À gauche", "de ce côté", "ici"], ["☝️", "Un instant", "important", "une chose"], ["👇", "En bas", "ci-dessous", "descends"], ["💁", "À ton service", "voilà", "je t’explique"], ["🙇", "Pardon", "excuses", "respect"], ["🧑‍🎓", "Étudiant", "études", "diplôme"], ["🧑‍🍳", "Cuisinier", "chef", "cuisine"], ["🧑‍💻", "Informatique", "ordinateur", "développeur"], ["🧑‍🚀", "Astronaute", "espace", "exploration"], ["🧑‍⚕️", "Médecin", "soin", "santé"], ["👮", "Police", "sécurité", "agent"], ["🕵️", "Enquête", "détective", "mystère"], ["🧙", "Magie", "sorcier", "fantaisie"], ["👑", "Roi", "reine", "couronne"], ["🧚", "Fée", "magique", "féerie"],
  ]),
  ...makeEmojiEntries("Animaux & nature", [
    ["🐶", "Chien", "chien", "chiot", "toutou"], ["🐱", "Chat", "chat", "chaton", "minou"], ["🐭", "Souris", "petit rongeur"], ["🐰", "Lapin", "lapin", "Pâques"], ["🦊", "Renard", "rusé", "forêt"], ["🐻", "Ours", "ours", "nounours"], ["🐼", "Panda", "bambou", "mignon"], ["🐨", "Koala", "Australie", "eucalyptus"], ["🐯", "Tigre", "félin", "sauvage"], ["🦁", "Lion", "courage", "roi de la jungle"], ["🐸", "Grenouille", "mare", "kermit"], ["🐵", "Singe", "rigolo", "banane"], ["🐧", "Pingouin", "froid", "glace"], ["🦉", "Hibou", "nuit", "sagesse"], ["🦄", "Licorne", "rêve", "fantastique"], ["🐝", "Abeille", "miel", "travail"], ["🦋", "Papillon", "beauté", "changement"], ["🐢", "Tortue", "lentement", "patience"], ["🐬", "Dauphin", "océan", "intelligent"], ["🦈", "Requin", "mer", "prédateur"], ["🐙", "Poulpe", "pieuvre", "mer"], ["🦜", "Perroquet", "oiseau", "parler"], ["🌸", "Fleur", "fleur", "printemps", "beauté"], ["🌹", "Rose", "rose", "romantique", "amour"], ["🌻", "Tournesol", "soleil", "été"], ["🌴", "Palmier", "vacances", "tropiques"], ["🍀", "Chance", "trèfle", "bonne chance"], ["🌈", "Arc-en-ciel", "espoir", "couleurs"], ["🌊", "Vague", "mer", "océan"], ["🌙", "Lune", "nuit", "bonne nuit"], ["⭐", "Étoile", "étoile", "briller", "rêve"], ["⚡", "Éclair", "énergie", "rapide"], ["❄️", "Neige", "hiver", "froid"], ["🔥", "Flamme", "chaud", "passion"], ["🌍", "Terre", "monde", "planète"],
  ]),
  ...makeEmojiEntries("Repas & boissons", [
    ["🍎", "Pomme", "pomme", "fruit", "santé"], ["🍓", "Fraise", "fraise", "fruit rouge"], ["🍉", "Pastèque", "été", "fruit"], ["🍌", "Banane", "banane", "fruit"], ["🥑", "Avocat", "avocat", "repas"], ["🥕", "Carotte", "légume", "lapin"], ["🌽", "Maïs", "champ", "épi"], ["🍞", "Pain", "pain", "boulangerie"], ["🥐", "Croissant", "petit déjeuner", "viennoiserie"], ["🧀", "Fromage", "fromage", "souris"], ["🍕", "Pizza", "pizza", "soirée"], ["🍔", "Burger", "hamburger", "fast food"], ["🍟", "Frites", "frites", "croustillant"], ["🍗", "Poulet", "poulet", "repas"], ["🍣", "Sushi", "japonais", "sushi"], ["🍜", "Nouilles", "ramen", "soupe"], ["🍰", "Gâteau", "gâteau", "dessert", "anniversaire"], ["🍫", "Chocolat", "chocolat", "gourmand"], ["🍦", "Glace", "glace", "frais"], ["☕", "Café", "café", "pause"], ["🫖", "Thé", "thé", "boisson chaude"], ["🥤", "Boisson", "jus", "soda"], ["🧃", "Jus", "fruit", "boire"], ["🍷", "Vin", "soirée", "toast"], ["🍻", "Santé", "bière", "trinquer"], ["🥂", "Toast", "champagne", "célébrer"], ["🍽️", "À table", "manger", "dîner"], ["🥡", "À emporter", "livraison", "repas"],
  ]),
  ...makeEmojiEntries("Voyages & lieux", [
    ["🚗", "Voiture", "voiture", "route", "conduire"], ["🚕", "Taxi", "taxi", "chauffeur"], ["🚌", "Bus", "bus", "transport"], ["🚲", "Vélo", "vélo", "sport"], ["🏍️", "Moto", "moto", "rapide"], ["🚆", "Train", "train", "voyage"], ["✈️", "Avion", "avion", "décollage", "vacances"], ["🚀", "Décollage", "fusée", "vite", "espace"], ["⛵", "Voilier", "bateau", "mer"], ["🛳️", "Croisière", "navire", "voyage"], ["🏖️", "Plage", "vacances", "sable", "mer"], ["🏝️", "Île", "île", "paradis"], ["🏔️", "Montagne", "montagne", "randonnée"], ["⛺", "Camping", "camping", "nature"], ["🏕️", "Camp", "feu de camp", "bivouac"], ["🏠", "Maison", "maison", "chez moi", "foyer"], ["🏢", "Bureau", "travail", "entreprise"], ["🏫", "École", "école", "classe"], ["🏥", "Hôpital", "soins", "médecin"], ["🏰", "Château", "château", "histoire", "roi"], ["🗼", "Monument", "tour", "Paris"], ["🗽", "Liberté", "statue", "New York"], ["⛪", "Église", "religion", "prière"], ["🕌", "Mosquée", "religion", "prière"], ["🌆", "Ville le soir", "ville", "coucher de soleil"], ["🌃", "Nuit en ville", "nuit", "ville"], ["🗺️", "Carte", "carte", "itinéraire"], ["🧭", "Direction", "boussole", "orientation"],
  ]),
  ...makeEmojiEntries("Activités & loisirs", [
    ["⚽", "Football", "football", "match", "but"], ["🏀", "Basket", "basket", "basketball"], ["🏈", "Rugby", "rugby", "sport"], ["🎾", "Tennis", "tennis", "raquette"], ["🏐", "Volley", "volley", "sport"], ["🏆", "Trophée", "victoire", "gagné", "champion"], ["🥇", "Médaille d’or", "premier", "gagnant"], ["🏋️", "Musculation", "salle", "entraînement"], ["🏃", "Course", "courir", "jogging"], ["🚴", "Cyclisme", "vélo", "course"], ["🧘", "Méditation", "zen", "calme"], ["🎮", "Jeu vidéo", "gaming", "jouer"], ["🎲", "Jeu de dés", "jeu", "hasard"], ["🎯", "Objectif", "cible", "précis"], ["🎨", "Art", "dessin", "peinture"], ["🎬", "Cinéma", "film", "action"], ["🎭", "Théâtre", "spectacle", "masque"], ["🎤", "Chanter", "micro", "karaoké"], ["🎧", "Écouter", "casque", "musique"], ["🎹", "Piano", "musique", "instrument"], ["🎸", "Guitare", "concert", "rock"], ["📚", "Lecture", "livre", "étudier"], ["✍️", "Écrire", "rédiger", "stylo"], ["📸", "Photo", "photographie", "souvenir"], ["🧩", "Puzzle", "casse-tête", "solution"], ["🪄", "Magie", "sort", "abracadabra"], ["🧵", "Couture", "fil", "artisanat"], ["♟️", "Échecs", "stratégie", "roi"],
  ]),
  ...makeEmojiEntries("Objets & symboles", [
    ["📱", "Téléphone", "portable", "appeler", "mobile"], ["💻", "Ordinateur", "pc", "ordinateur", "travail"], ["⌚", "Montre", "heure", "temps"], ["🔋", "Batterie", "charge", "énergie"], ["💡", "Idée", "ampoule", "solution", "inspiration"], ["🔑", "Clé", "clé", "ouvrir"], ["🔒", "Verrouillé", "secret", "sécurité"], ["🛠️", "Réparer", "outil", "travaux"], ["⚙️", "Réglages", "paramètres", "configuration"], ["📦", "Colis", "paquet", "livraison"], ["🎁", "Cadeau", "surprise", "offrir"], ["🛍️", "Shopping", "acheter", "magasin"], ["💳", "Paiement", "carte bancaire", "payer"], ["💸", "Dépense", "argent qui part", "coût"], ["💎", "Précieux", "diamant", "valeur"], ["🪙", "Pièce", "monnaie", "rune"], ["📈", "En hausse", "progrès", "croissance"], ["📉", "En baisse", "chute", "diminution"], ["📅", "Calendrier", "date", "rendez-vous"], ["⏰", "Réveil", "alarme", "bientôt"], ["📝", "Note", "liste", "écrire"], ["📍", "Position", "localisation", "lieu"], ["🔔", "Notification", "alerte", "sonnerie"], ["🔕", "Silence", "pas de notification", "muet"], ["❤️", "Cœur rouge", "amour", "passion"], ["💚", "Cœur vert", "nature", "amitié"], ["💙", "Cœur bleu", "confiance", "paix"], ["💜", "Cœur violet", "tendresse", "affection"], ["🖤", "Cœur noir", "tristesse", "style"], ["💯", "Cent pour cent", "totalement", "parfait"], ["♾️", "Infini", "toujours", "sans limite"], ["❓", "Question", "pourquoi", "comment"], ["❗", "Important", "attention", "urgent"], ["✅", "Validé", "fait", "terminé", "oui"], ["❌", "Annulé", "non", "erreur"], ["♻️", "Recycler", "écologie", "réutiliser"], ["☮️", "Paix", "calme", "sans conflit"], ["🆘", "Aide", "urgence", "au secours"],
  ]),
];
const EMOJI_CATEGORIES = ["Tout", "Essentiels", "Émotions", "Personnes", "Animaux & nature", "Repas & boissons", "Voyages & lieux", "Activités & loisirs", "Objets & symboles"];
function contactSettingsFor(person) {
  try { return JSON.parse(localStorage.getItem(`veloce_contact_settings_${person?._id || person?.id}`) || "{}"); }
  catch { return {}; }
}

function contactDisplayName(person) {
  return contactSettingsFor(person).nickname?.trim() || person?.username || "Contact";
}
const MESSAGE_EMOJIS = ["😀", "😂", "🥰", "😍", "😘", "😊", "😎", "😭", "😢", "😡", "🤔", "🙏", "👏", "👍", "👎", "❤️", "💖", "💔", "🔥", "✨", "🎉", "👋", "💪", "🤝", "✅", "❌", "⚠️", "💰", "🏠", "🎵", "🍽️", "☀️"];
const MESSAGE_LETTERS = "abcdefghijklmnopqrstuvwxyzàâçéèêëîïôùûüÿœæ'!?.,".split("");

function keepLettersSeparated(value, allowFullText = false) {
  if (allowFullText) return value;
  let result = "";
  let previousWasLetter = false;
  for (const character of Array.from(value)) {
    const isLetter = /^\p{L}$/u.test(character);
    if (isLetter && previousWasLetter) continue;
    result += character;
    previousWasLetter = isLetter;
  }
  return result;
}

function CallGlyph({ video = false }) {
  return video ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 10.5 21 7v10l-6-3.5v-3ZM3 6.5h12v11H3z" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 3.8 9.4 7l-1.8 2.3a15.4 15.4 0 0 0 7.1 7.1l2.3-1.8 3.2 2.8-.8 3.2a2 2 0 0 1-2.1 1.4A18.9 18.9 0 0 1 2 4.7a2 2 0 0 1 1.4-2.1l3.2-.8Z" /></svg>;
}

import {
  searchUsers,
  toggleFollow as toggleUserFollow
} from "../services/userService";


function Messages({ initialUser = null, onInitialUserHandled, initialClanId = null, onInitialClanHandled, onComposerStateChange = () => {} }) {
  const { token, user } =
    useAuth();

  const [
    conversations,
    setConversations
  ] = useState([]);

  const [
    selectedUser,
    setSelectedUser
  ] = useState(null);
  const [clans, setClans] = useState([]);
  const [selectedClan, setSelectedClan] = useState(null);
  const [showCommunity, setShowCommunity] = useState(false);
  const [serverClanBadge, setServerClanBadge] = useState(() => {
    const accountId = user?.id || user?._id;
    return Boolean(accountId && localStorage.getItem(`veloce_server_clan_intro_seen_${accountId}`) !== "true");
  });
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showCreateClan, setShowCreateClan] = useState(false);
  const [showEmojiLibrary, setShowEmojiLibrary] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [emojiCategory, setEmojiCategory] = useState("Tout");
  const [showEmojiKeyboard, setShowEmojiKeyboard] = useState(false);
  const [emojiKeyboardMode, setEmojiKeyboardMode] = useState("emoji");
  const [fullKeyboardUntil, setFullKeyboardUntil] = useState(null);
  const [fullKeyboardError, setFullKeyboardError] = useState("");
  const hasFullKeyboard = Boolean(fullKeyboardUntil && new Date(fullKeyboardUntil).getTime() > Date.now());
  const activeConversationId = useRef("");
  const messageListRef = useRef(null);
  const composerRef = useRef(null);
  const longPressTimer = useRef(null);
  const pullStartY = useRef(null);
  const skipAutoScroll = useRef(false);

  const [
    messages,
    setMessages
  ] = useState([]);

  const [
    content,
    setContent
  ] = useState("");

  const [
    search,
    setSearch
  ] = useState("");

  const [
    searchResults,
    setSearchResults
  ] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [
    loading,
    setLoading
  ] = useState(true);
  const [conversationError, setConversationError] = useState("");

  const [deletingMessageId, setDeletingMessageId] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendError, setSendError] = useState("");
  const [messageFiles, setMessageFiles] = useState([]);
  const [activeMessage, setActiveMessage] = useState(null);
  const [replyTarget, setReplyTarget] = useState(null);
  const [forwardTarget, setForwardTarget] = useState(null);
  const [showChatProfile, setShowChatProfile] = useState(false);
  const [chatWallpaper, setChatWallpaper] = useState("night");
  const [chatTheme, setChatTheme] = useState("violet");
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [audioCall, setAudioCall] = useState(null);
  const [callError, setCallError] = useState("");
  const [callTalkers, setCallTalkers] = useState({ local: false, remote: false });
  const [callMediaControls, setCallMediaControls] = useState({ microphoneMuted: false, cameraOff: false });
  const [remoteMediaStream, setRemoteMediaStream] = useState(null);
  const audioCallRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localAudioStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const callEventSequenceRef = useRef(0);
  const pendingRemoteIceRef = useRef([]);
  const audioContextRef = useRef(null);
  const audioAnalyserRef = useRef({});
  const audioFrameRef = useRef({});
  const callPollingRef = useRef(false);
  const incomingCallRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/users/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (active) setFullKeyboardUntil(data?.fullKeyboardUntil || null); })
      .catch(() => {});
    const timer = window.setInterval(() => setFullKeyboardUntil((value) => value ? new Date(value).toISOString() : value), 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token]);

  const unlockFullKeyboard = async () => {
    try {
      setFullKeyboardError("");
      const response = await fetch(`${API_BASE_URL}/users/full-keyboard`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Impossible d’activer le clavier complet.");
      setFullKeyboardUntil(data.fullKeyboardUntil);
      setEmojiKeyboardMode("letters");
    } catch (error) {
      setFullKeyboardError(error.message);
    }
  };

  const addComposerText = (text) => {
    setContent((current) => keepLettersSeparated(`${current}${text}`, hasFullKeyboard));
    onComposerStateChange(true);
    window.setTimeout(() => composerRef.current?.focus(), 0);
  };

  const matchingEmojis = EMOJI_LIBRARY.filter((entry) => {
    const query = emojiSearch.trim().toLocaleLowerCase("fr");
    const matchesCategory = emojiCategory === "Tout" || entry.category === emojiCategory;
    const matchesSearch = !query || entry.words.some((word) => word.toLocaleLowerCase("fr").includes(query)) || entry.label.toLocaleLowerCase("fr").includes(query);
    return matchesCategory && matchesSearch;
  });

  const openEmojiLibrary = () => {
    setEmojiSearch("");
    setEmojiCategory("Tout");
    setShowEmojiLibrary(true);
  };

  useEffect(() => { audioCallRef.current = audioCall; }, [audioCall]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);
  useEffect(() => {
    if (audioCall?.role !== "caller" || audioCall.state !== "ringing") return undefined;
    const timer = window.setTimeout(() => {
      if (audioCallRef.current?.id === audioCall.id && audioCallRef.current.state === "ringing") {
        setCallError("Pas de réponse. L’appel a été terminé.");
        void endCall(true);
      }
    }, 45000);
    return () => window.clearTimeout(timer);
  }, [audioCall?.id, audioCall?.role, audioCall?.state]);

  useEffect(() => () => {
    const current = audioCallRef.current;
    if (current?.id) void updateAudioCall({ callId: current.id, action: "end", token }).catch(() => {});
    releaseCallMedia();
  }, []);

  const watchCallVoice = (stream, side) => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass || !stream?.getAudioTracks?.().length) return;
    try {
      audioContextRef.current ||= new AudioContextClass();
      const context = audioContextRef.current;
      void context.resume();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      audioAnalyserRef.current[side] = analyser;
      const samples = new Uint8Array(analyser.fftSize);
      const sampleVoice = () => {
        if (audioAnalyserRef.current[side] !== analyser) return;
        analyser.getByteTimeDomainData(samples);
        let energy = 0;
        for (const sample of samples) { const amplitude = (sample - 128) / 128; energy += amplitude * amplitude; }
        const speaking = Math.sqrt(energy / samples.length) > 0.035;
        setCallTalkers((current) => current[side] === speaking ? current : { ...current, [side]: speaking });
        audioFrameRef.current[side] = requestAnimationFrame(sampleVoice);
      };
      audioFrameRef.current[side] = requestAnimationFrame(sampleVoice);
    } catch (error) {
      console.warn("Détection de la voix désactivée :", error);
    }
  };

  const createCallPeer = (callId) => {
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    peerConnectionRef.current = peer;
    for (const track of localAudioStreamRef.current?.getTracks?.() || []) peer.addTrack(track, localAudioStreamRef.current);
    peer.onicecandidate = (event) => {
      if (event.candidate) void sendAudioCallEvent({ callId, type: "ice", payload: event.candidate.toJSON(), token }).catch((error) => console.warn("ICE non transmis :", error.message));
    };
    peer.ontrack = (event) => {
      const stream = event.streams?.[0];
      if (!stream) return;
      setRemoteMediaStream(new MediaStream(stream.getTracks()));
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        void remoteAudioRef.current.play().catch(() => setCallError("Autorise la lecture audio de Veloce dans ton navigateur."));
      }
      if (event.track.kind === "audio") watchCallVoice(stream, "remote");
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") setAudioCall((current) => current?.id === callId ? { ...current, state: "active" } : current);
      if (["failed", "disconnected"].includes(peer.connectionState)) setCallError("La connexion est interrompue. Vérifie le réseau puis réessaie.");
    };
    return peer;
  };

  const releaseCallMedia = () => {
    for (const frame of Object.values(audioFrameRef.current)) cancelAnimationFrame(frame);
    audioFrameRef.current = {};
    audioAnalyserRef.current = {};
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localAudioStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    localAudioStreamRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setRemoteMediaStream(null);
    if (audioContextRef.current) void audioContextRef.current.close().catch(() => {});
    audioContextRef.current = null;
    callEventSequenceRef.current = 0;
    pendingRemoteIceRef.current = [];
    callPollingRef.current = false;
    setCallTalkers({ local: false, remote: false });
  };

  const requestCallMedia = async (mode = "audio") => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Les appels nécessitent une connexion sécurisée (HTTPS) et un navigateur compatible.");
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: mode === "video" ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
    } catch (error) {
      if (mode === "video" && ["NotFoundError", "OverconstrainedError"].includes(error.name)) {
        throw new Error("Aucune caméra compatible n’a été trouvée sur cet appareil.");
      }
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        throw new Error(mode === "video" ? "Autorise l’accès au micro et à la caméra pour lancer l’appel vidéo." : "Autorise l’accès au micro pour lancer l’appel.");
      }
      throw error;
    }
  };

  const startCall = async (mode = "audio") => {
    if (!selectedUser || audioCallRef.current) return;
    setCallError("");
    setCallMediaControls({ microphoneMuted: false, cameraOff: false });
    let createdCall = null;
    try {
      localAudioStreamRef.current = await requestCallMedia(mode);
      watchCallVoice(localAudioStreamRef.current, "local");
      const createCall = mode === "video" ? startVideoCall : startAudioCall;
      createdCall = await createCall({ recipientId: selectedUser._id, token });
      const peer = createCallPeer(createdCall.id);
      setAudioCall({ ...createdCall, mode, person: selectedUser, role: "caller", state: "ringing" });
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await sendAudioCallEvent({ callId: createdCall.id, type: "offer", payload: peer.localDescription.toJSON(), token });
    } catch (error) {
      if (createdCall?.id) void updateAudioCall({ callId: createdCall.id, action: "end", token }).catch(() => {});
      releaseCallMedia();
      setAudioCall(null);
      setCallError(error.message || `Impossible de démarrer l’appel ${mode === "video" ? "vidéo" : "audio"}.`);
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    const call = incomingCall;
    setCallError("");
    try {
      const mode = call.mode === "video" ? "video" : "audio";
      setCallMediaControls({ microphoneMuted: false, cameraOff: false });
      localAudioStreamRef.current = await requestCallMedia(mode);
      watchCallVoice(localAudioStreamRef.current, "local");
      createCallPeer(call.id);
      await updateAudioCall({ callId: call.id, action: "accept", token });
      const callerProfile = { ...call.caller, _id: call.caller.id };
      void openConversation(callerProfile);
      setIncomingCall(null);
      setAudioCall({ ...call, mode, person: callerProfile, role: "callee", state: "connecting" });
    } catch (error) {
      void updateAudioCall({ callId: call.id, action: "end", token }).catch(() => {});
      releaseCallMedia();
      setIncomingCall(null);
      setCallError(error.message || "Impossible d’accepter l’appel.");
    }
  };

  const declineCall = async () => {
    if (!incomingCall) return;
    try { await updateAudioCall({ callId: incomingCall.id, action: "decline", token }); }
    catch (error) { setCallError(error.message || "Impossible de refuser cet appel."); }
    setIncomingCall(null);
  };

  const endCall = async (notifyServer = true) => {
    const current = audioCallRef.current;
    if (notifyServer && current?.id) {
      try { await updateAudioCall({ callId: current.id, action: "end", token }); }
      catch (error) { console.warn("Fin d’appel non synchronisée :", error.message); }
    }
    releaseCallMedia();
    setAudioCall(null);
  };

  const toggleCallMicrophone = () => {
    const microphoneMuted = !callMediaControls.microphoneMuted;
    for (const track of localAudioStreamRef.current?.getAudioTracks?.() || []) track.enabled = !microphoneMuted;
    setCallMediaControls((current) => ({ ...current, microphoneMuted }));
  };

  const toggleCallCamera = () => {
    const cameraOff = !callMediaControls.cameraOff;
    for (const track of localAudioStreamRef.current?.getVideoTracks?.() || []) track.enabled = !cameraOff;
    setCallMediaControls((current) => ({ ...current, cameraOff }));
  };

  useEffect(() => () => onComposerStateChange(false), [onComposerStateChange]);

  useEffect(() => {
    if (!selectedUser?._id) return;
    const key = `veloce_chat_wallpaper_${selectedUser._id}`;
    setChatWallpaper(localStorage.getItem(key) || "night");
    setChatTheme(contactSettingsFor(selectedUser).theme || "violet");
  }, [selectedUser?._id]);

  useEffect(() => {
    const accountId = user?.id || user?._id;
    setServerClanBadge(Boolean(accountId && localStorage.getItem(`veloce_server_clan_intro_seen_${accountId}`) !== "true"));
  }, [user?.id, user?._id]);

  useEffect(() => {
    if (!showCommunity) return;
    const accountId = user?.id || user?._id;
    if (accountId) localStorage.setItem(`veloce_server_clan_intro_seen_${accountId}`, "true");
    setServerClanBadge(false);
  }, [showCommunity, user?.id, user?._id]);

  const updateWallpaper = (value) => {
    setChatWallpaper(value);
    if (selectedUser?._id) {
      localStorage.setItem(`veloce_chat_wallpaper_${selectedUser._id}`, value);
    }
  };

  const updateChatTheme = (value) => {
    setChatTheme(value);
    if (selectedUser?._id) {
      const key = `veloce_contact_settings_${selectedUser._id}`;
      localStorage.setItem(key, JSON.stringify({ ...contactSettingsFor(selectedUser), theme: value }));
      window.dispatchEvent(new Event("veloce:contact-settings"));
    }
  };

  useEffect(() => {
    const list = messageListRef.current;
    if (!list) return;
    if (skipAutoScroll.current) {
      skipAutoScroll.current = false;
      return;
    }
    list.scrollTop = list.scrollHeight;
  }, [messages, selectedUser]);


  const loadConversations =
    async () => {
      try {
        const data =
          await getConversations(
            token
          );

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.conversations)
            ? data.conversations
            : [];
        setConversations(list);
        setConversationError("");

      } catch (error) {
        console.error(error);
        setConversationError(error.message || "Impossible de charger tes conversations.");
      } finally {
        setLoading(false);
      }
    };

  const refreshMessagesPage = async () => {
    playUiSound("refresh");
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadConversations(),
        getClans(token).then(setClans),
      ]);
      if (selectedUser?._id) {
        const data = await getMessages({ userId: selectedUser._id, token });
        skipAutoScroll.current = true;
        setMessages(data);
      } else if (selectedClan || showCommunity) {
        window.location.reload();
        return;
      }
    } catch (error) {
      console.error("Actualisation des messages :", error);
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  };

  const handlePullStart = (event) => {
    if (event.touches.length !== 1) return;
    const scroller = event.target.closest?.(".message-list, .conversation-list, .messages-sidebar");
    const atTop = scroller ? scroller.scrollTop <= 0 : window.scrollY <= 0;
    pullStartY.current = atTop ? event.touches[0].clientY : null;
  };

  const handlePullMove = (event) => {
    if (pullStartY.current === null || isRefreshing) return;
    const distance = event.touches[0].clientY - pullStartY.current;
    if (distance > 0) setPullDistance(Math.min(82, distance * 0.55));
    else setPullDistance(0);
  };

  const handlePullEnd = () => {
    pullStartY.current = null;
    if (pullDistance >= 58) void refreshMessagesPage();
    else setPullDistance(0);
  };


  useEffect(() => {
    loadConversations();
  }, [token]);

  useEffect(() => {
    getClans(token).then(setClans).catch((error) => console.error("Chargement clans :", error));
  }, [token]);

  useEffect(() => {
    const updateSettings = () => setContactSettingsRevision((revision) => revision + 1);
    window.addEventListener("veloce:contact-settings", updateSettings);
    return () => window.removeEventListener("veloce:contact-settings", updateSettings);
  }, []);

  useEffect(() => {
    let disposed = false;
    const checkIncoming = async () => {
      if (disposed || audioCallRef.current || incomingCallRef.current) return;
      try {
        const calls = await getIncomingCalls(token);
        if (!disposed && !audioCallRef.current && !incomingCallRef.current && calls.length) setIncomingCall(calls[0]);
      } catch (error) {
        if (!disposed) console.warn("Vérification d’appel entrant :", error.message);
      }
    };
    void checkIncoming();
    const timer = window.setInterval(checkIncoming, 2200);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [token]);

  useEffect(() => {
    if (!audioCall?.id) return undefined;
    let disposed = false;
    const pollCall = async () => {
      if (disposed || callPollingRef.current) return;
      callPollingRef.current = true;
      try {
        const snapshot = await getAudioCall({ callId: audioCall.id, after: callEventSequenceRef.current, token });
        if (snapshot.status === "declined" || snapshot.status === "ended") {
          setCallError(snapshot.status === "declined" ? "L’appel a été refusé." : "L’appel est terminé.");
          window.setTimeout(() => { if (!disposed) void endCall(false); }, 1100);
          return;
        }
        if (snapshot.status === "active") setAudioCall((current) => current?.id === audioCall.id ? { ...current, state: "active" } : current);
        for (const event of snapshot.events || []) {
          callEventSequenceRef.current = Math.max(callEventSequenceRef.current, event.sequence);
          if (String(event.sender) === String(user?.id || user?._id)) continue;
          const peer = peerConnectionRef.current;
          if (!peer) continue;
          if (event.type === "offer" && audioCall.role === "callee" && !peer.remoteDescription) {
            await peer.setRemoteDescription(new RTCSessionDescription(event.payload));
            for (const candidate of pendingRemoteIceRef.current.splice(0)) await peer.addIceCandidate(new RTCIceCandidate(candidate));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            await sendAudioCallEvent({ callId: audioCall.id, type: "answer", payload: peer.localDescription.toJSON(), token });
          } else if (event.type === "answer" && audioCall.role === "caller" && !peer.remoteDescription) {
            await peer.setRemoteDescription(new RTCSessionDescription(event.payload));
            for (const candidate of pendingRemoteIceRef.current.splice(0)) await peer.addIceCandidate(new RTCIceCandidate(candidate));
          } else if (event.type === "ice") {
            if (peer.remoteDescription) await peer.addIceCandidate(new RTCIceCandidate(event.payload));
            else pendingRemoteIceRef.current.push(event.payload);
          }
        }
      } catch (error) {
        if (!disposed) console.warn("Synchronisation de l’appel :", error.message);
      } finally {
        callPollingRef.current = false;
      }
    };
    void pollCall();
    const timer = window.setInterval(pollCall, 850);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [audioCall?.id, token, user?.id, user?._id]);


  const openConversation = useCallback(
    async (person) => {
      const personId = person._id || person.id;
      activeConversationId.current = personId;
      setShowCommunity(false);
      setSelectedClan(null);
      setSelectedUser({ ...person, _id: personId });
      setShowChatProfile(false);
      setReplyTarget(null);
      setActiveMessage(null);
      onComposerStateChange(false);
      setMessages([]);
      setSendError("");
      setLoading(false);
      try {
        const data =
          await getMessages({
            userId: personId,
            token
          });

        if (activeConversationId.current === personId) {
          setMessages(data);
        }

      } catch (error) {
        console.error(error);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!initialUser) return;
    void openConversation(initialUser);
    onInitialUserHandled?.(null);
  }, [initialUser, openConversation, onInitialUserHandled]);

  useEffect(() => {
    const contact = selectedUser;
    const contactId = contact?._id || contact?.id;
    if (!contactId || !token) return undefined;

    let disposed = false;
    let requesting = false;
    let initialized = false;
    const seenIds = new Set();
    const pollMessages = async () => {
      if (disposed || requesting) return;
      requesting = true;
      try {
        const data = await getMessages({ userId: contactId, token });
        if (disposed || !Array.isArray(data)) return;

        const myId = String(user?.id || user?._id || "");
        const incoming = initialized ? data.filter((message) => {
          const id = String(message._id || "");
          const senderId = String(message.sender?._id || message.sender || "");
          return id && !seenIds.has(id) && senderId !== myId;
        }) : [];
        for (const message of data) if (message._id) seenIds.add(String(message._id));
        initialized = true;

        if (incoming.length && !contactSettingsFor(contact).muted) {
          playUiSound("message");
        }
        if (incoming.length && document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted") {
          const registration = await navigator.serviceWorker?.getRegistration?.();
          for (const message of incoming) {
            const sender = message.sender?.username || contact.username || "Contact";
            const query = new URLSearchParams({ page: "messages", contact: String(contactId), username: sender });
            const options = {
              body: message.content?.trim()?.slice(0, 140) || "T’a envoyé une pièce jointe.",
              icon: "/veloce-mark.svg",
              tag: `message-${message._id}`,
              renotify: true,
              data: { url: `/?${query.toString()}` },
            };
            try {
              if (registration) await registration.showNotification(`@${sender} t’a envoyé un message`, options);
              else new Notification(`@${sender} t’a envoyé un message`, options);
            } catch {
              // L’actualisation du fil continue même si le navigateur bloque l’alerte locale.
            }
          }
        }

        setMessages((current) => {
          const pending = current.filter((message) => message.pending);
          const currentServerMessages = current.filter((message) => !message.pending);
          const unchanged = currentServerMessages.length === data.length
            && data.every((message, index) => String(message._id) === String(currentServerMessages[index]?._id)
              && Boolean(message.read) === Boolean(currentServerMessages[index]?.read));
          if (unchanged && !pending.length) return current;
          return [...data, ...pending];
        });
      } catch {
        // La messagerie reste utilisable lorsque le réseau est momentanément indisponible.
      } finally {
        requesting = false;
      }
    };

    void pollMessages();
    const timer = window.setInterval(pollMessages, 5000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [selectedUser?._id, selectedUser?.id, token, user?.id, user?._id]);

  useEffect(() => {
    if ((selectedUser?._id || selectedUser?.id) || !token) return undefined;
    let disposed = false;
    let requesting = false;
    let initialized = false;
    let previousUnread = 0;

    const pollConversationList = async () => {
      if (disposed || requesting) return;
      requesting = true;
      try {
        const data = await getConversations(token);
        if (disposed || !Array.isArray(data)) return;
        const unread = data.reduce((sum, conversation) => sum + (Number(conversation.unread) || 0), 0);
        if (initialized && unread > previousUnread && data.some((conversation) => conversation.unread > 0 && !contactSettingsFor(conversation.user).muted)) {
          playUiSound("message");
        }
        initialized = true;
        previousUnread = unread;
        setConversations(data);
      } catch {
        // Garde la dernière liste de conversations si le serveur est momentanément inaccessible.
      } finally {
        requesting = false;
      }
    };

    void pollConversationList();
    const timer = window.setInterval(pollConversationList, 6000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [selectedUser?._id, selectedUser?.id, token]);


  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setSearchResults([]);
      setSearchError("");
      setSearchLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");
      try {
        const data = await searchUsers({ q: query, token, signal: controller.signal });
        setSearchResults(data);
      } catch (error) {
        if (error.name !== "AbortError") setSearchError(error.message || "La recherche a échoué.");
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, token]);


  const handleSend =
    async () => {
      if (
        (!content.trim() && !messageFiles.length) ||
        !selectedUser ||
        sendingMessage
      ) {
        return;
      }

      const quotedText = replyTarget?.content?.trim();
      const replyPrefix = replyTarget
        ? `↪ ${replyTarget.sender?.username || selectedUser.username}: ${(quotedText || "Pièce jointe").slice(0, 240)}\n`
        : "";
      const messageContent = `${replyPrefix}${content.trim()}`.trim();
      const filesToSend = [...messageFiles];
      const recipientId = selectedUser._id;
      const temporaryId = `pending-${Date.now()}`;
      const optimisticMessage = {
        _id: temporaryId,
        sender: { _id: user?.id || user?._id },
        recipient: { _id: recipientId },
        content: messageContent,
        createdAt: new Date().toISOString(),
        pending: true
      };

      setSendError("");
      setSendingMessage(true);
      setMessages((previous) => [...previous, optimisticMessage]);
      setContent("");

      try {
        const message =
          await sendMessage({
            userId: recipientId,
            content: messageContent,
            files: filesToSend,
            token
          });

        if (activeConversationId.current === recipientId) {
          setMessages((previous) => previous.map((item) =>
            item._id === temporaryId ? message : item
          ));
        }

        void loadConversations();
        setMessageFiles([]);
        setReplyTarget(null);
        onComposerStateChange(false);

      } catch (error) {
        console.error(error);
        if (activeConversationId.current === recipientId) {
          setMessages((previous) => previous.filter((item) => item._id !== temporaryId));
          setContent((previous) => previous || messageContent);
          setMessageFiles((previous) => previous.length ? previous : filesToSend);
          onComposerStateChange(Boolean(messageContent));
          setSendError(error.message || "Impossible d'envoyer le message.");
        }
      } finally {
        setSendingMessage(false);
      }
    };

  const closeConversation = () => {
    activeConversationId.current = "";
    setShowCommunity(false);
    setSelectedUser(null);
    setSelectedClan(null);
  };

  const openCommunity = () => {
    activeConversationId.current = "server-community";
    setSelectedUser(null);
    setSelectedClan(null);
    setShowCommunity(true);
    setSendError("");
  };

  const openClan = (clan) => {
    activeConversationId.current = clan._id;
    setShowCommunity(false);
    setSelectedUser(null);
    setSelectedClan(clan);
    setSendError("");
  };

  useEffect(() => {
    if (!initialClanId || !clans.length) return;
    const clan = clans.find((item) => String(item._id) === String(initialClanId));
    if (clan) openClan(clan);
    onInitialClanHandled?.(null);
  }, [initialClanId, clans, onInitialClanHandled]);

  const handleClanCreated = (clan) => {
    const readyClan = { ...clan, memberCount: clan.members?.length || 1 };
    setClans((current) => [readyClan, ...current.filter((item) => item._id !== readyClan._id)]);
    setShowCreateClan(false);
    setShowNewMenu(false);
    openClan(readyClan);
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm("Supprimer ce message de votre boîte ?")) return;
    try {
      setDeletingMessageId(messageId);
      setDeleteError("");
      await deleteMessageRequest({ messageId, token });
      setMessages((current) => current.filter((message) => message._id !== messageId));
      await loadConversations();
    } catch (error) {
      setDeleteError(error.message || "Impossible de supprimer ce message.");
    } finally {
      setDeletingMessageId("");
    }
  };

  const performMessageAction = async (action) => {
    const target = activeMessage;
    setActiveMessage(null);
    if (!target) return;
    if (action === "delete") return handleDeleteMessage(target._id);
    if (action === "reply") {
      setReplyTarget(target);
      onComposerStateChange(true);
      window.setTimeout(() => composerRef.current?.focus(), 0);
      return;
    }
    if (action === "forward") {
      setForwardTarget(target);
      return;
    }
    if (action === "copy") {
      try {
        await navigator.clipboard.writeText(target.content || "");
      } catch {
        setSendError("La copie dans le presse-papiers a échoué.");
      }
    }
  };

  const forwardMessageTo = async (person) => {
    if (!forwardTarget) return;
    const summary = forwardTarget.content?.trim() || (forwardTarget.attachments || [])
      .map((file) => `📎 ${file.originalName}`)
      .join("\n");
    if (!summary) return;
    try {
      await sendMessage({
        userId: person._id || person.id,
        content: `↗ Message transféré de ${selectedUser?.username || "un contact"}\n${summary}`,
        token,
      });
      setForwardTarget(null);
      await loadConversations();
    } catch (error) {
      setSendError(error.message || "Impossible de transférer ce message.");
      setForwardTarget(null);
    }
  };


  const orderedConversations = [...conversations].sort((left, right) =>
    Number(Boolean(contactSettingsFor(right.user).pinned)) - Number(Boolean(contactSettingsFor(left.user).pinned))
  );
  const favoriteConversations = orderedConversations.filter((conversation) => contactSettingsFor(conversation.user).favorite);
  const directConversations = orderedConversations.filter((conversation) => !contactSettingsFor(conversation.user).favorite);
  void contactSettingsRevision;

  if (loading) {
    return (
      <div className="empty-feed">
        Chargement des messages...
      </div>
    );
  }


  return (
    <section
      className="messages-page"
      onTouchStart={handlePullStart}
      onTouchMove={handlePullMove}
      onTouchEnd={handlePullEnd}
      onTouchCancel={handlePullEnd}
    >
      {(pullDistance > 0 || isRefreshing) && (
        <div className={`messages-pull-indicator${isRefreshing ? " refreshing" : ""}`} style={{ top: `${Math.max(8, pullDistance)}px` }} aria-live="polite">
          <span>{isRefreshing ? "↻" : "↓"}</span>{isRefreshing ? "Actualisation…" : "Relâche pour actualiser"}
        </div>
      )}

      <div className={`messages-layout ${selectedUser || selectedClan || showCommunity ? "conversation-open" : ""}`}>

        {/* ==================================================
            LISTE DES CONVERSATIONS
        ================================================== */}

        <div className="messages-sidebar">

          <div className="messages-title">
            <div><span className="messages-eyebrow">VÉLOCE</span><h1>Messages</h1></div>
            <div className="messages-new-wrap">
              <button type="button" className="messages-emoji-library-button" aria-label="Ouvrir la bibliothèque d’emojis" title="Bibliothèque d’emojis" onClick={openEmojiLibrary}>😊</button>
              <button type="button" className="messages-new-button" aria-label="Créer un message ou un clan" aria-expanded={showNewMenu} onClick={() => setShowNewMenu((value) => !value)}>+</button>
              {showNewMenu && <div className="messages-new-menu"><button type="button" onClick={() => { setSearch(""); setShowNewMenu(false); document.querySelector(".messages-search")?.focus(); }}>Nouveau message privé</button><button type="button" onClick={() => { setShowCreateClan(true); setShowNewMenu(false); }}>Créer un clan</button></div>}
            </div>
          </div>


          <input
            className="messages-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher une personne..."
          />

          <div className="conversation-list">

            <details className="messages-list-group" open>
              <summary><span>Clan serveur</span><b>OUVERT</b></summary>

            <button type="button" className={`conversation-card server-community-card ${showCommunity ? "conversation-active" : ""} ${serverClanBadge ? "needs-attention" : ""}`} onClick={openCommunity}>
              <div className="server-community-icon" aria-hidden="true">🌐</div>
              <div className="conversation-info"><strong>Clan serveur</strong><span>Questions, nouveautés et aide</span>{serverClanBadge && <small className="server-community-badge">À DÉCOUVRIR</small>}</div>
              <span className="server-community-label">TOUS</span>
            </button>
            </details>


          {(search.trim() || searchError) && (
            <div className="message-search-results">
              {searchLoading && <p>Recherche en cours…</p>}
              {searchError && <p role="alert">{searchError}</p>}
              {!searchLoading && !searchError && search.trim() && searchResults.length === 0 && <p>Aucun compte trouvé.</p>}
              {searchResults.map(
                person => (
                  <button
                    key={person.id}
                    className="message-person"
                    onClick={() =>
                      openConversation(
                        person
                      )
                    }
                  >
                    <div className="message-avatar">
                      {person.avatar ? (
                        <img
                          src={person.avatar}
                          alt=""
                        />
                      ) : (
                        person.username
                          ?.charAt(0)
                          .toUpperCase()
                      )}
                    </div>

                    <strong>
                      {person.username}
                    </strong>
                  </button>
                )
              )}

            </div>
          )}

          {conversationError && <div className="messages-load-error" role="alert" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "12px 10px", padding: "12px 14px", border: "1px solid #f0c4cc", borderRadius: 14, background: "#fff2f4", color: "#762d3b", fontSize: 12 }}>
            <span>{conversationError}</span>
            <button type="button" onClick={() => void loadConversations()} style={{ border: 0, borderRadius: 10, padding: "8px 12px", background: "#762d3b", color: "#fff", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Réessayer</button>
          </div>}

            <details className="messages-list-group" open>
              <summary><span>Clans privés</span><b>{clans.length}</b></summary>
            {clans.length > 0 && <div className="conversation-group-label">TES CLANS</div>}
            {clans.map((clan) => {
              const accountId = String(user?.id || user?._id || "");
              const role = String(clan.owner?._id || clan.owner) === accountId ? "Chef" : (clan.administrators || []).some((id) => String(id?._id || id) === accountId) ? "Administrateur" : (clan.moderators || []).some((id) => String(id?._id || id) === accountId) ? "Modérateur" : "Membre";
              return <button key={clan._id} type="button" className={`conversation-card clan-conversation-card ${selectedClan?._id === clan._id ? "conversation-active" : ""}`} onClick={() => openClan(clan)}>
                <div className="clan-avatar">✉</div><div className="conversation-info"><strong>{clan.name}</strong><span>{clan.description || `${clan.memberCount} membres · Enveloppes privées`}</span><small className="clan-card-meta"><b>{role}</b><i />{clan.memberCount || clan.members?.length || 1} membres</small></div>
              </button>;
            })}
            </details>
            <details className="messages-list-group">
              <summary><span>Favoris</span><b>{favoriteConversations.length}</b></summary>
              {favoriteConversations.length === 0
                ? <p className="messages-empty">Ajoute une conversation aux favoris depuis le profil du contact.</p>
                : favoriteConversations.map((conversation) => <button key={conversation.user._id} className={"conversation-card " + (selectedUser?._id === conversation.user._id ? "conversation-active" : "")} onClick={() => openConversation(conversation.user)}>
                  <div className="message-avatar">{conversation.user.avatar ? <img src={conversation.user.avatar} alt="" /> : conversation.user.username?.charAt(0).toUpperCase()}</div>
                  <div className="conversation-info"><strong>{contactDisplayName(conversation.user)}</strong><span>{conversation.lastMessage}</span></div>
                  {conversation.unread > 0 && !contactSettingsFor(conversation.user).muted && <b>{conversation.unread}</b>}
                </button>)}
            </details>
            <details className="messages-list-group" open>
              <summary><span>Messages privés</span><b>{directConversations.length}</b></summary>
          <div className="conversation-group-label">CONVERSATIONS</div>

            {directConversations.length === 0 ? (
              <p className="messages-empty">
                Aucune conversation.
              </p>
            ) : (
              directConversations.map(
                conversation => (
                  <button
                    key={
                      conversation.user._id
                    }
                    className={
                      `conversation-card ${
                        selectedUser?._id ===
                        conversation.user._id
                          ? "conversation-active"
                          : ""
                      }`
                    }
                    onClick={() =>
                      openConversation(
                        conversation.user
                      )
                    }
                  >

                    <div className="message-avatar">
                      {conversation.user.avatar ? (
                        <img
                          src={
                            conversation.user.avatar
                          }
                          alt=""
                        />
                      ) : (
                        conversation.user.username
                          ?.charAt(0)
                          .toUpperCase()
                      )}
                    </div>

                    <div className="conversation-info">

                      <strong>
                        {
                          contactDisplayName(conversation.user)
                        }
                      </strong>

                      <span>
                        {
                          conversation.lastMessage
                        }
                      </span>

                    </div>

                    {conversation.unread > 0 && !contactSettingsFor(conversation.user).muted && (
                      <b>
                        {conversation.unread}
                      </b>
                    )}

                  </button>
                )
              )
            )}

            </details>
          </div>

        </div>


        {/* ==================================================
            CONVERSATION
        ================================================== */}

        <div className={`messages-conversation chat-theme-${chatTheme}`} data-chat-wallpaper={chatWallpaper}>

          {showCommunity ? <CommunityRoom token={token} user={user} onBack={closeConversation} /> : selectedClan ? <ClanRoom clan={selectedClan} token={token} user={user} onBack={closeConversation} onClanUpdated={(updated) => { setSelectedClan(updated); setClans((current) => current.map((item) => item._id === updated._id ? { ...item, ...updated, memberCount: updated.members?.length || item.memberCount } : item)); }} /> : !selectedUser ? (
            <div className="messages-placeholder">

              <h2>
                Tes messages
              </h2>

              <p>
                Sélectionne une conversation
                pour commencer à échanger.
              </p>

            </div>
          ) : (

            <>
              <div className="conversation-header">
                <button type="button" className="mobile-conversation-back" onClick={closeConversation} aria-label="Retour à la liste des messages">←</button>
                <button
                  type="button"
                  className="conversation-person-button"
                  onClick={() => setShowChatProfile(true)}
                  aria-label={`Options de conversation avec ${contactDisplayName(selectedUser)}`}
                >
                  <span className="message-avatar">
                    {selectedUser.avatar ? <img src={selectedUser.avatar} alt="" /> : selectedUser.username?.charAt(0).toUpperCase()}
                  </span>
                  <span><strong>{contactDisplayName(selectedUser)}</strong><small>Profil et paramètres</small></span>
                  <span className="conversation-profile-chevron">⌄</span>
                </button>
                <div className="conversation-call-actions" aria-label="Options d’appel">
                  <button type="button" aria-label="Appel audio" title="Appel audio" onClick={() => void startCall("audio")} disabled={Boolean(audioCall || incomingCall)}><CallGlyph /><span>Appel</span></button>
                  <button type="button" aria-label="Appel vidéo" title="Appel vidéo" onClick={() => void startCall("video")} disabled={Boolean(audioCall || incomingCall)}><CallGlyph video /><span>Vidéo</span></button>
                </div>
              </div>


              <div className={`message-list wallpaper-${chatWallpaper}`} ref={messageListRef}>

                {deleteError && <p className="message-delete-error" role="alert">{deleteError}</p>}

                {messages.length === 0 && <p className="messages-empty">Aucun message dans cette conversation.</p>}

                {messages.map(
                  message => {

                    const mine =
                      String(message.sender?._id || message.sender) ===
                      String(user?.id || user?._id);

                    return (
                      <div
                        key={
                          message._id
                        }
                        className={
                          `message-bubble-row ${
                            mine
                              ? "message-mine"
                              : "message-theirs"
                          }`
                        }
                        onContextMenu={(event) => {
                          event.preventDefault();
                          if (!message.pending) setActiveMessage(message);
                        }}
                        onPointerDown={() => {
                          if (message.pending) return;
                          window.clearTimeout(longPressTimer.current);
                          longPressTimer.current = window.setTimeout(() => setActiveMessage(message), 520);
                        }}
                        onPointerUp={() => window.clearTimeout(longPressTimer.current)}
                        onPointerCancel={() => window.clearTimeout(longPressTimer.current)}
                        onPointerLeave={() => window.clearTimeout(longPressTimer.current)}
                      >

                        <div className="message-bubble">
                          {message.content && <p>{message.content}</p>}
                          {message.attachments?.map((file) => <PrivateAttachment key={file.fileId} attachment={file} token={token} />)}
                          {message.pending && <small className="message-pending">Envoi…</small>}
                        </div>

                      </div>
                    );
                  }
                )}

              </div>


              {sendError && <p className="message-send-error" role="alert">{sendError}</p>}
              <form className="message-input-area" onSubmit={(event) => { event.preventDefault(); handleSend(); }}>
                <button type="button" className="message-emoji-keyboard-toggle" aria-label="Ouvrir le clavier Veloce" title="Clavier Veloce" onClick={() => setShowEmojiKeyboard((visible) => !visible)}>😊</button>
                <button type="button" className="message-emoji-library-toggle" aria-label="Rechercher un emoji par mot" title="Bibliothèque d’emojis" onClick={openEmojiLibrary}>📚</button>
                <label className="message-attach-button" title="Joindre des photos ou des fichiers">＋<input type="file" multiple hidden accept="image/*,.pdf,.doc,.docx,.txt,.zip" onChange={(event) => { const chosen = Array.from(event.target.files || []); if (chosen.length + messageFiles.length > 4 || chosen.some((file) => file.size > 8 * 1024 * 1024)) { setSendError("Maximum 4 fichiers, 8 Mo chacun."); return; } setMessageFiles((current) => [...current, ...chosen]); event.target.value = ""; }} /></label>
                <div className="message-input-stack">
                {replyTarget && <div className="message-reply-preview"><span>Réponse à {replyTarget.sender?.username || selectedUser.username}</span><small>{replyTarget.content || "Pièce jointe"}</small><button type="button" onClick={() => setReplyTarget(null)} aria-label="Annuler la réponse">×</button></div>}
                {messageFiles.length > 0 && <div className="message-file-chips">{messageFiles.map((file, index) => <button type="button" key={`${file.name}-${index}`} onClick={() => setMessageFiles((current) => current.filter((_, i) => i !== index))}>📎 {file.name} ×</button>)}</div>}

                <textarea
                  ref={composerRef}
                  value={content}
                  onFocus={() => onComposerStateChange(true)}
                  onBlur={() => { if (!content.trim()) onComposerStateChange(false); }}
                  onChange={(event) => {
                    const nextValue = keepLettersSeparated(event.target.value, hasFullKeyboard);
                    setContent(nextValue);
                    onComposerStateChange(Boolean(nextValue.trim()) || Boolean(replyTarget));
                  }}
                  onKeyDown={event => {
                    if (
                      event.key ===
                        "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Emoji, ou une lettre suivie d’un emoji…"
                />

                </div>
                <button
                  type="submit"
                  disabled={
                    (!content.trim() && !messageFiles.length) || sendingMessage
                  }
                >
                  {sendingMessage ? "Envoi…" : "Envoyer"}
                </button>

              </form>

              {fullKeyboardError && <p className="message-send-error" role="alert">{fullKeyboardError}</p>}
              {showEmojiKeyboard && <div className="veloce-emoji-keyboard" aria-label="Clavier Veloce">
                <div className="veloce-emoji-keyboard-head"><strong>{emojiKeyboardMode === "emoji" ? "Clavier emoji" : hasFullKeyboard ? "Clavier alphabétique · actif" : "Accès alphabétique expiré"}</strong><button type="button" onClick={() => { if (emojiKeyboardMode === "emoji" && !hasFullKeyboard) void unlockFullKeyboard(); else setEmojiKeyboardMode((mode) => mode === "emoji" ? "letters" : "emoji"); }}>{emojiKeyboardMode === "emoji" ? (hasFullKeyboard ? "ABC" : "ABC · 1 Piz") : "😊"}</button><button type="button" onClick={() => setShowEmojiKeyboard(false)} aria-label="Fermer le clavier">×</button></div>
                <div className="veloce-emoji-keyboard-grid">{(emojiKeyboardMode === "emoji" ? MESSAGE_EMOJIS : MESSAGE_LETTERS).map((key) => <button type="button" key={key} disabled={emojiKeyboardMode === "letters" && !hasFullKeyboard || emojiKeyboardMode === "letters" && /^(\p{L})$/u.test(key) && /\p{L}$/u.test(Array.from(content).at(-1) || "")} onClick={() => addComposerText(key)}>{key}</button>)}</div>
                <div className="veloce-emoji-keyboard-foot"><button type="button" onClick={() => { setContent((current) => Array.from(current).slice(0, -1).join("")); composerRef.current?.focus(); }}>⌫ Effacer</button><button type="button" onClick={() => addComposerText(" ")}>Espace</button></div>
              </div>}

              {showChatProfile && <ChatProfileDialog person={selectedUser} wallpaper={chatWallpaper} onWallpaperChange={updateWallpaper} theme={chatTheme} onThemeChange={updateChatTheme} onClose={() => setShowChatProfile(false)} token={token} />}
              {activeMessage && <MessageActionsSheet message={activeMessage} onSelect={performMessageAction} onClose={() => setActiveMessage(null)} />}
              {forwardTarget && <ForwardMessageDialog conversations={conversations} onSelect={forwardMessageTo} onClose={() => setForwardTarget(null)} />}

            </>

          )}

        </div>

      </div>

      <audio ref={remoteAudioRef} autoPlay playsInline hidden />
      {audioCall?.mode === "video" && <VideoCallStage call={audioCall} self={user} localStream={localAudioStreamRef.current} remoteStream={remoteMediaStream} remoteVideoRef={remoteVideoRef} controls={callMediaControls} onToggleMicrophone={toggleCallMicrophone} onToggleCamera={toggleCallCamera} onEnd={() => void endCall(true)} error={callError} />}
      {audioCall && audioCall.mode !== "video" && <AudioCallStage call={audioCall} self={user} talkers={callTalkers} error={callError} onEnd={() => void endCall(true)} />}
      {incomingCall && !audioCall && <IncomingCallStage call={incomingCall} self={user} error={callError} onAccept={() => void acceptCall()} onDecline={() => void declineCall()} />}
      {!audioCall && !incomingCall && callError && <div className="call-error-toast" role="alert"><span>{callError}</span><button type="button" onClick={() => setCallError("")}>×</button></div>}
      {showCreateClan && <ClanCreateDialog token={token} onClose={() => setShowCreateClan(false)} onCreated={handleClanCreated} />}
      {showEmojiLibrary && <div className="veloce-emoji-library-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowEmojiLibrary(false); }}><section className="veloce-emoji-library" role="dialog" aria-modal="true" aria-labelledby="emoji-library-title"><header><div><span>PLUS DE 200 IDÉES À EXPLORER</span><h2 id="emoji-library-title">Bibliothèque d’emojis</h2></div><button type="button" onClick={() => setShowEmojiLibrary(false)} aria-label="Fermer">×</button></header><label className="veloce-emoji-search">Trouver une idée<input autoFocus value={emojiSearch} onChange={(event) => setEmojiSearch(event.target.value)} placeholder="Écris un mot : amour, merci, rire…" /></label><div className="emoji-library-categories" role="tablist" aria-label="Catégories d’emojis">{EMOJI_CATEGORIES.map((category) => <button key={category} type="button" role="tab" aria-selected={emojiCategory === category} className={emojiCategory === category ? "active" : ""} onClick={() => setEmojiCategory(category)}>{category}</button>)}</div><div className="veloce-emoji-library-results">{matchingEmojis.map((entry) => <button type="button" key={`${entry.category}-${entry.label}`} onClick={() => { addComposerText(entry.emoji); setShowEmojiLibrary(false); }}><span>{entry.emoji}</span><strong>{entry.label}</strong><small>{entry.words.slice(0, 3).join(" · ")}</small></button>)}{matchingEmojis.length === 0 && <p>Aucun emoji trouvé. Essaie un autre mot.</p>}</div></section></div>}

    </section>
  );
}

const CHAT_WALLPAPERS = [
  { id: "night", label: "Nuit", swatch: "#17191f" },
  { id: "violet", label: "Violet", swatch: "#211832" },
  { id: "ocean", label: "Océan", swatch: "#122936" },
  { id: "rose", label: "Prune", swatch: "#351d31" },
];
const CHAT_THEMES = [
  { id: "violet", label: "Aurore violette", swatch: "linear-gradient(135deg,#8071e7,#c274c3)" },
  { id: "ocean", label: "Lagune", swatch: "linear-gradient(135deg,#37a8c7,#487be2)" },
  { id: "rose", label: "Rose tendre", swatch: "linear-gradient(135deg,#e56d9b,#f2ad8d)" },
  { id: "jade", label: "Jade", swatch: "linear-gradient(135deg,#37a980,#8acb88)" },
];

const CALL_EMOJIS = ["😀", "😎", "🥰", "😂", "😌", "🤗", "🦊", "🐼", "🐯", "🐨", "🦁", "🐸", "🐙", "🦋", "🐧", "🦄"];
const emojiForPerson = (person) => {
  const name = person?.username || person?.id || person?._id || "Veloce";
  let hash = 0;
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return person?.emoji || person?.profileEmoji || CALL_EMOJIS[hash % CALL_EMOJIS.length];
};

function CallParticipant({ person, self = false, speaking = false, state = "" }) {
  return <div className={`audio-call-participant${speaking ? " is-speaking" : ""}`}>
    <div className="audio-call-emoji-wrap"><span className="audio-call-emoji" aria-label={`Emoji de ${person?.username || "participant"}`}>{emojiForPerson(person)}</span><span className="audio-call-reaction">{speaking ? "🎙️" : self ? "🎧" : "💬"}</span></div>
    <strong>{self ? `${person?.username || "Moi"} · toi` : (person?.username || "Contact")}</strong>
    <small>{state || (speaking ? "Parle maintenant" : "À l’écoute")}</small>
  </div>;
}

function AudioCallStage({ call, self, talkers, error, onEnd }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (call.state !== "active") return undefined;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [call.state]);
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const label = call.state === "ringing" ? "Appel en cours…" : call.state === "active" ? clock : "Connexion audio…";
  return <div className="audio-call-overlay"><section className="audio-call-stage" role="dialog" aria-modal="true" aria-label={`Appel audio avec ${call.person?.username || "un contact"}`}>
    <header><span>APPEL AUDIO VELOCE</span><button type="button" onClick={onEnd} aria-label="Terminer l’appel">×</button></header>
    <div className="audio-call-status"><i className={call.state === "active" ? "connected" : ""} />{label}</div>
    <div className="audio-call-participants"><CallParticipant person={self} self speaking={talkers.local} state={talkers.local ? "Ta voix réagit" : "Ton micro est prêt"} /><span className="audio-call-link">↔</span><CallParticipant person={call.person} speaking={talkers.remote} state={talkers.remote ? "Sa voix réagit" : call.state === "ringing" ? "Ça sonne chez cette personne" : "En attente de sa voix"} /></div>
    {error && <p className="audio-call-error" role="alert">{error}</p>}
    <div className="audio-call-controls"><button className="audio-call-end" type="button" onClick={onEnd}><CallGlyph /> Raccrocher</button></div>
    <p className="audio-call-note">Les deux emojis s’animent au rythme des voix détectées par le micro.</p>
  </section></div>;
}

function VideoCallStage({ call, self, localStream, remoteStream, remoteVideoRef, controls, onToggleMicrophone, onToggleCamera, onEnd, error }) {
  const localVideoRef = useRef(null);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!localVideoRef.current) return;
    localVideoRef.current.srcObject = localStream || null;
    if (localStream) void localVideoRef.current.play().catch(() => {});
  }, [localStream]);
  useEffect(() => {
    if (!remoteVideoRef.current) return;
    remoteVideoRef.current.srcObject = remoteStream || null;
    if (remoteStream) void remoteVideoRef.current.play().catch(() => {});
  }, [remoteStream, remoteVideoRef]);
  useEffect(() => {
    if (call.state !== "active") return undefined;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [call.state]);

  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const label = call.state === "ringing" ? "Appel en cours…" : call.state === "active" ? clock : "Connexion vidéo…";
  const remoteHasVideo = remoteStream?.getVideoTracks?.().some((track) => track.readyState === "live");
  const remoteName = call.person?.username || "Contact";
  return <div className="audio-call-overlay video-call-overlay">
    <section className="video-call-stage" role="dialog" aria-modal="true" aria-label={`Appel vidéo avec ${remoteName}`}>
      <div className="video-call-remote">
        <video ref={remoteVideoRef} autoPlay playsInline muted aria-label={`Vidéo de ${remoteName}`} />
        {!remoteHasVideo && <div className="video-call-waiting"><span>{emojiForPerson(call.person)}</span><strong>{remoteName}</strong><small>{call.state === "ringing" ? "Sonnerie chez ton contact" : "En attente de l’image…"}</small></div>}
        <header className="video-call-topbar"><div><span>VELOCE · APPEL VIDÉO</span><strong>{remoteName}</strong></div><span className={`video-call-clock${call.state === "active" ? " connected" : ""}`}><i />{label}</span><button type="button" onClick={onEnd} aria-label="Terminer l’appel">×</button></header>
        <div className="video-call-local">
          <video ref={localVideoRef} autoPlay playsInline muted aria-label="Aperçu de ta caméra" />
          {controls.cameraOff && <div className="video-call-camera-off"><span>{emojiForPerson(self)}</span><small>Caméra coupée</small></div>}
          <strong>{self?.username || "Toi"}</strong>
        </div>
      </div>
      {error && <p className="video-call-error" role="alert">{error}</p>}
      <div className="video-call-controls">
        <button type="button" className={controls.microphoneMuted ? "is-off" : ""} aria-pressed={controls.microphoneMuted} onClick={onToggleMicrophone}><span>{controls.microphoneMuted ? "🔇" : "🎙️"}</span>{controls.microphoneMuted ? "Réactiver le micro" : "Couper le micro"}</button>
        <button type="button" className={controls.cameraOff ? "is-off" : ""} aria-pressed={controls.cameraOff} onClick={onToggleCamera}><span>{controls.cameraOff ? "🚫" : "📷"}</span>{controls.cameraOff ? "Réactiver la caméra" : "Couper la caméra"}</button>
        <button type="button" className="video-call-hangup" onClick={onEnd}><CallGlyph />Raccrocher</button>
      </div>
      <p className="video-call-note">Ton navigateur doit avoir l’autorisation d’utiliser le micro et la caméra.</p>
    </section>
  </div>;
}

function IncomingCallStage({ call, self, error, onAccept, onDecline }) {
  const isVideo = call.mode === "video";
  return <div className="audio-call-overlay"><section className={`audio-call-stage incoming${isVideo ? " incoming-video" : ""}`} role="dialog" aria-modal="true" aria-label={`Appel ${isVideo ? "vidéo" : "audio"} entrant de ${call.caller?.username || "un contact"}`}>
    <header><span>APPEL {isVideo ? "VIDÉO" : "AUDIO"} ENTRANT</span></header>
    <div className="audio-call-status"><i />Ça sonne dans ta messagerie</div>
    <div className="audio-call-participants"><CallParticipant person={self} self state="Tu reçois l’appel" /><span className="audio-call-link">↔</span><CallParticipant person={call.caller} state="T’appelle" /></div>
    {error && <p className="audio-call-error" role="alert">{error}</p>}
    <div className="audio-call-controls"><button className="audio-call-accept" type="button" onClick={onAccept}><CallGlyph /> Répondre</button><button className="audio-call-end" type="button" onClick={onDecline}>Refuser</button></div>
    <p className="audio-call-note">En répondant, ton navigateur demandera l’accès au {isVideo ? "micro et à la caméra" : "micro"}.</p>
  </section></div>;
}

function ChatProfileDialog({ person, wallpaper, onWallpaperChange, theme, onThemeChange, onClose, token }) {
  const [activeTab, setActiveTab] = useState("profil");
  const [profile, setProfile] = useState(person);
  const [relationship, setRelationship] = useState(() => localStorage.getItem(`veloce_contact_relation_${person._id}`) || "Ami(e)");
  const [chatSettings, setChatSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`veloce_contact_settings_${person._id}`) || "{}"); }
    catch { return {}; }
  });
  const [copied, setCopied] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [followNotice, setFollowNotice] = useState("");
  const [following, setFollowing] = useState(false);
  const [followSaving, setFollowSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/users/${person._id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.message || "Profil indisponible."); return data; })
      .then((data) => { if (active) { setProfile({ ...person, ...(data.user || data), stats: data.stats || data.user?.stats }); setFollowing(Boolean(data.isFollowing)); } })
      .catch((error) => { if (active) setProfileError(error.message); });
    return () => { active = false; };
  }, [person, token]);

  const changeRelationship = (value) => {
    setRelationship(value);
    localStorage.setItem(`veloce_contact_relation_${person._id}`, value);
  };
  const changeSetting = (key, value) => {
    setChatSettings((current) => {
      const next = { ...current, [key]: value };
      localStorage.setItem(`veloce_contact_settings_${person._id}`, JSON.stringify(next));
      window.dispatchEvent(new Event("veloce:contact-settings"));
      return next;
    });
  };
  const copyProfileLink = async () => {
    const url = `${window.location.origin}/?profile=${encodeURIComponent(person._id)}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setProfileError("Impossible de copier le lien sur cet appareil."); }
  };
  const changeFollow = async () => {
    try {
      setFollowSaving(true); setProfileError(""); setFollowNotice("");
      const result = await toggleUserFollow({ userId: person._id || person.id, token });
      setFollowing(Boolean(result.following));
      setProfile((current) => ({ ...current, stats: { ...current.stats, followersCount: Math.max(0, Number(current.stats?.followersCount || 0) + (result.following ? 1 : -1)) } }));
      setFollowNotice(result.following ? "Abonnement effectué · 0,5 Piz versé à cette personne." : "Tu ne suis plus cette personne.");
    } catch (error) {
      setProfileError(error.message || "Impossible de modifier cet abonnement.");
    } finally {
      setFollowSaving(false);
    }
  };

  return (
    <div className="chat-profile-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="chat-profile-dialog chat-profile-page" role="dialog" aria-modal="true" aria-label={`Profil de ${person.username}`}>
        <header><div><span>ESPACE CONTACT</span><h2>{profile.username || person.username}</h2></div><button type="button" onClick={onClose} aria-label="Fermer">×</button></header>
        <nav className="chat-profile-tabs" aria-label="Rubriques du contact">{[["profil", "Profil"], ["conversation", "Conversation"], ["parametres", "Paramètres"]].map(([key, label]) => <button key={key} type="button" className={activeTab === key ? "active" : ""} onClick={() => setActiveTab(key)}>{label}</button>)}</nav>
        {profileError && <p className="chat-profile-error" role="alert">{profileError}</p>}
        <label className="chat-favorite-toggle"><span>☆ Ajouter cette conversation aux favoris</span><input type="checkbox" checked={Boolean(chatSettings.favorite)} onChange={(event) => changeSetting("favorite", event.target.checked)} /></label>
        {activeTab === "profil" && <div className="chat-profile-content"><div className="chat-profile-hero"><span className="chat-profile-avatar">{profile.avatar ? <img src={profile.avatar} alt="" /> : emojiForPerson(profile)}</span><div><h3>{profile.username || person.username}</h3><small>@{profile.username || person.username}</small><p>{profile.bio || "Aucune biographie renseignée."}</p></div></div><div className="chat-profile-stats"><div><strong>{profile.stats?.followersCount ?? "—"}</strong><span>Abonnés</span></div><div><strong>{profile.stats?.followingCount ?? "—"}</strong><span>Abonnements</span></div><div><strong>{relationship}</strong><span>Ton lien</span></div></div><button type="button" className={`chat-follow-button ${following ? "following" : ""}`} onClick={() => void changeFollow()} disabled={followSaving}>{followSaving ? "Mise à jour…" : following ? "✓ Abonné(e) · Se désabonner" : "＋ S’abonner · 0,5 Piz"}</button>{followNotice && <p className="chat-follow-notice" role="status">{followNotice}</p>}<label className="chat-relation-field">Le lien qui vous unit<select value={relationship} onChange={(event) => changeRelationship(event.target.value)}>{["Ami(e)", "Famille", "Collègue", "Partenaire", "Connaissance", "Autre"].map((value) => <option key={value}>{value}</option>)}</select></label><button className="chat-copy-profile-link" type="button" onClick={copyProfileLink}>🔗 {copied ? "Lien copié" : "Copier le lien du profil"}</button></div>}
        {activeTab === "conversation" && <div className="chat-profile-content"><h3>Apparence de la conversation</h3><p>Le thème et le fond sont enregistrés sur cet appareil.</p><div className="chat-theme-options">{CHAT_THEMES.map((option) => <button key={option.id} type="button" className={theme === option.id ? "selected" : ""} onClick={() => onThemeChange(option.id)}><span style={{ background: option.swatch }} />{option.label}</button>)}</div><div className="chat-wallpaper-options">{CHAT_WALLPAPERS.map((option) => <button key={option.id} type="button" className={wallpaper === option.id ? "selected" : ""} onClick={() => onWallpaperChange(option.id)}><span style={{ background: option.swatch }} />Fond · {option.label}</button>)}</div><label className="chat-relation-field">Nom affiché dans ta messagerie<input value={chatSettings.nickname ?? profile.username ?? person.username ?? ""} onChange={(event) => changeSetting("nickname", event.target.value)} /></label><p className="chat-profile-hint">Le nom personnalisé et le fond restent privés sur cet appareil.</p></div>}
        {activeTab === "parametres" && <div className="chat-profile-content"><h3>Paramètres de ce contact</h3><label className="chat-setting-row"><span><strong>Mettre en sourdine</strong><small>Masquer les alertes de cette conversation</small></span><input type="checkbox" checked={Boolean(chatSettings.muted)} onChange={(event) => changeSetting("muted", event.target.checked)} /></label><label className="chat-setting-row"><span><strong>Épingler la conversation</strong><small>La garder en haut de ta liste</small></span><input type="checkbox" checked={Boolean(chatSettings.pinned)} onChange={(event) => changeSetting("pinned", event.target.checked)} /></label><label className="chat-relation-field">Relation<select value={relationship} onChange={(event) => changeRelationship(event.target.value)}>{["Ami(e)", "Famille", "Collègue", "Partenaire", "Connaissance", "Autre"].map((value) => <option key={value}>{value}</option>)}</select></label><p className="chat-profile-hint">Ces préférences sont locales à ton appareil.</p></div>}
        <footer><button type="button" onClick={onClose}>Fermer</button></footer>
      </section>
    </div>
  );
}

function MessageActionsSheet({ message, onSelect, onClose }) {
  return (
    <div className="message-actions-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="message-actions-sheet" role="menu" aria-label="Actions du message">
        <div className="message-actions-grabber" />
        <p>{message.content || "Pièce jointe"}</p>
        <button type="button" role="menuitem" onClick={() => onSelect("reply")}>↩ <span>Répondre</span></button>
        <button type="button" role="menuitem" onClick={() => onSelect("copy")} disabled={!message.content}>▢ <span>Copier</span></button>
        <button type="button" role="menuitem" onClick={() => onSelect("forward")}>➤ <span>Envoyer à une personne</span></button>
        <button type="button" role="menuitem" className="message-action-delete" onClick={() => onSelect("delete")}>⌫ <span>Supprimer de ma boîte</span></button>
      </section>
    </div>
  );
}

function ForwardMessageDialog({ conversations, onSelect, onClose }) {
  return (
    <div className="chat-profile-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="chat-profile-dialog forward-message-dialog" role="dialog" aria-modal="true" aria-label="Envoyer le message">
        <header><div><span>PARTAGER</span><h2>Envoyer à…</h2></div><button type="button" onClick={onClose} aria-label="Fermer">×</button></header>
        <div className="forward-contact-list">{conversations.map(({ user: person }) => (
          <button key={person._id} type="button" onClick={() => onSelect(person)}>
            <span className="message-avatar">{person.avatar ? <img src={person.avatar} alt="" /> : person.username?.charAt(0).toUpperCase()}</span>
            <strong>{person.username}</strong><span>Envoyer</span>
          </button>
        ))}{conversations.length === 0 && <p>Aucune autre conversation disponible.</p>}</div>
      </section>
    </div>
  );
}


function ClanCreateDialog({ token, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const value = query.trim();
    if (!value) { setResults([]); return undefined; }
    let active = true;
    const timer = setTimeout(() => searchUsers({ q: value, token }).then((items) => { if (active) setResults(items); }).catch((requestError) => { if (active) setError(requestError.message); }), 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query, token]);

  const submit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true); setError("");
      const clan = await createClan({ name, description, memberIds: selected, token });
      onCreated(clan);
    } catch (requestError) { setError(requestError.message || "Impossible de créer le clan."); }
    finally { setSaving(false); }
  };

  const visibleIds = results.map((person) => String(person.id || person._id)).filter(Boolean);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const toggleAllVisible = () => {
    setError("");
    if (!allVisibleSelected && new Set([...selected, ...visibleIds]).size > 99) {
      setError("Un clan peut compter au maximum 100 membres, chef compris. Retire d’abord des membres déjà sélectionnés.");
      return;
    }
    setSelected((current) => {
      if (allVisibleSelected) return current.filter((id) => !visibleIds.includes(id));
      return [...new Set([...current, ...visibleIds])].slice(0, 99);
    });
  };
  const toggleClanMember = (id) => {
    const memberId = String(id);
    setError("");
    if (selected.includes(memberId)) { setSelected((current) => current.filter((item) => item !== memberId)); return; }
    if (selected.length >= 99) { setError("Un clan peut compter au maximum 100 membres, chef compris."); return; }
    setSelected((current) => [...current, memberId]);
  };

  return <div className="clan-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="clan-modal" onSubmit={submit}>
      <header><div><span>NOUVEL ESPACE PRIVÉ</span><h2>Créer un clan</h2></div><button type="button" onClick={onClose} aria-label="Fermer">×</button></header>
      <label>Nom du clan<input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="Ex. Cercle de lecture" required /></label>
      <label>Description <small>(facultative)</small><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={240} placeholder="De quoi parle ce clan ?" /></label>
      <label>Inviter des membres<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un nom d’utilisateur" /></label>
      <div className="clan-selection-toolbar"><span>{selected.length} membre{selected.length === 1 ? "" : "s"} sélectionné{selected.length === 1 ? "" : "s"} · {selected.length + 1}/100 places</span>{visibleIds.length > 0 && <button type="button" onClick={toggleAllVisible}>{allVisibleSelected ? "Désélectionner les résultats" : `Tout cocher · ${visibleIds.length} résultats`}</button>}</div>
      <div className="clan-user-results">{results.map((person) => { const id = String(person.id || person._id); return <label key={id} className={`clan-user-option ${selected.includes(id) ? "selected" : ""}`}><input type="checkbox" checked={selected.includes(id)} onChange={() => toggleClanMember(id)} /><span className="message-avatar">{person.avatar ? <img src={person.avatar} alt="" /> : person.username?.charAt(0).toUpperCase()}</span><span><strong>{person.username}</strong><small>{person.bio || "Membre de Veloce"}</small></span></label>; })}{query.trim() && results.length === 0 && <p className="clan-search-empty">Aucun membre ne correspond à cette recherche.</p>}</div>
      {error && <p className="clan-form-error" role="alert">{error}</p>}
      <p className="clan-modal-note">Les messages du clan sont des enveloppes : seuls les destinataires choisis pourront les ouvrir.</p>
      <footer><button type="button" onClick={onClose}>Annuler</button><button type="submit" disabled={saving || !name.trim()}>{saving ? "Création…" : "Créer le clan"}</button></footer>
    </form>
  </div>;
}

function ClanRoom({ clan, token, user, onBack, onClanUpdated }) {
  const [envelopes, setEnvelopes] = useState([]);
  const [loadingClan, setLoadingClan] = useState(true);
  const [text, setText] = useState("");
  const [recipientIds, setRecipientIds] = useState([]);
  const [signed, setSigned] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState([]);
  const [governanceOpen, setGovernanceOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem(`veloce_clan_dark_${clan._id}`) === "true");
  const envelopeListRef = useRef(null);
  const myId = String(user?.id || user?._id || "");
  const members = (clan.members || []).filter((member) => String(member._id || member.id) !== myId);

  const refresh = async () => {
    try { setEnvelopes(await getClanMessages({ clanId: clan._id, token })); }
    catch (requestError) { setError(requestError.message || "Impossible de charger le clan."); }
    finally { setLoadingClan(false); }
  };
  useEffect(() => { refresh(); }, [clan._id, token]);
  useEffect(() => { localStorage.setItem(`veloce_clan_dark_${clan._id}`, String(darkMode)); }, [clan._id, darkMode]);
  useEffect(() => { if (envelopeListRef.current) envelopeListRef.current.scrollTop = envelopeListRef.current.scrollHeight; }, [envelopes]);

  const chooseReply = (envelope) => {
    const targets = envelope.replyTargets || [];
    setReplyTo(envelope);
    setRecipientIds(targets.length ? [String(targets[0]._id)] : []);
    setError("");
  };

  const openEnvelope = async (messageId) => {
    try {
      const opened = await openClanEnvelope({ clanId: clan._id, messageId, token });
      setEnvelopes((current) => current.map((item) => item._id === messageId ? opened : item));
    } catch (requestError) { setError(requestError.message || "Impossible d'ouvrir cette enveloppe."); }
  };

  const revealEnvelopeSender = async (messageId) => {
    try {
      const updated = await revealClanSender({ clanId: clan._id, messageId, token });
      setEnvelopes((current) => current.map((item) => item._id === messageId ? updated : item));
    } catch (requestError) {
      setError(requestError.message || "Impossible de révéler l’expéditeur.");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if ((!text.trim() && !files.length) || !recipientIds.length) return;
    try {
      setSending(true); setError("");
      const sent = await sendClanEnvelope({ clanId: clan._id, content: text, files, recipientIds, signed, replyTo: replyTo?._id, token });
      setEnvelopes((current) => [...current, sent]);
      setText(""); setFiles([]); setRecipientIds([]); setReplyTo(null); setSigned(false);
    } catch (requestError) { setError(requestError.message || "Impossible d'envoyer l'enveloppe."); }
    finally { setSending(false); }
  };

  const selectableMembers = replyTo ? (replyTo.replyTargets || []).map((target) => ({ ...target, id: target._id })) : members;
  const selectableIds = selectableMembers.map((member) => String(member.id || member._id));
  const everyoneSelected = selectableIds.length > 0 && selectableIds.every((id) => recipientIds.includes(id));
  const toggleAllRecipients = () => setRecipientIds((current) => everyoneSelected ? current.filter((id) => !selectableIds.includes(id)) : [...new Set([...current.filter((id) => selectableIds.includes(id)), ...selectableIds])]);
  const toggleRecipient = (id) => setRecipientIds((current) => current.includes(String(id)) ? current.filter((value) => value !== String(id)) : [...current, String(id)]);

  return <div className={`clan-room ${darkMode ? "clan-room-dark" : ""}`}>
    <header className="conversation-header clan-room-header"><button type="button" className="mobile-conversation-back" onClick={onBack} aria-label="Retour aux conversations">←</button><div className="clan-avatar">✉</div><div><strong>{clan.name}</strong><small>{clan.memberCount || clan.members?.length} membres · enveloppes privées</small></div><button className="clan-theme-toggle" type="button" onClick={() => setDarkMode((current) => !current)} aria-label={darkMode ? "Activer le mode clair" : "Activer le mode sombre"}>{darkMode ? "☀️" : "🌙"}</button><button className="clan-governance-open" type="button" onClick={() => setGovernanceOpen(true)}>⚖ Gouvernance</button></header>
    <div className="clan-envelope-list" ref={envelopeListRef}>
      {loadingClan && <p className="messages-empty">Chargement des enveloppes…</p>}
      {!loadingClan && envelopes.length === 0 && <div className="clan-empty-state"><span>✉</span><strong>Un message privé au milieu du clan</strong><p>Écris à certains membres. Les autres ne verront qu’une enveloppe verrouillée.</p></div>}
      {envelopes.map((envelope) => <article className={`clan-envelope ${envelope.isOwn ? "clan-envelope-own" : ""} ${envelope.replyTo ? "clan-envelope-reply" : ""}`} key={envelope._id}>
        {envelope.replyTo && <small className="clan-reply-context">↳ Réponse à une enveloppe</small>}
        {(envelope.signed || envelope.senderRevealed) && envelope.sender?.username && <span className="clan-signature">{envelope.signed ? `Signé par ${envelope.sender.username}` : `Expéditeur révélé : @${envelope.sender.username}`}</span>}
        {envelope.opened ? <div className="clan-open-content"><span className="clan-open-stamp">✉</span>{envelope.content && <p>{envelope.content}</p>}{envelope.attachments?.map((file) => <PrivateAttachment key={file.fileId} attachment={file} token={token} />)}</div> : envelope.canOpen ? <button type="button" className="clan-open-button" onClick={() => openEnvelope(envelope._id)}><span>✉</span><strong>Ouvrir mon enveloppe</strong><small>Ce message t’a été adressé</small></button> : <div className="clan-locked-envelope" aria-label="Enveloppe verrouillée, non destinée à ce membre"><span>🔒</span><strong>Enveloppe verrouillée</strong><small>Le contenu est réservé à ses destinataires.</small></div>}
        <time>{new Date(envelope.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</time>
        {envelope.canRevealSender && <button type="button" className="clan-reply-button" onClick={() => revealEnvelopeSender(envelope._id)}>Révéler l’expéditeur · 5 Piz</button>}
        {envelope.canReply && <button type="button" className="clan-reply-button" onClick={() => chooseReply(envelope)}>Répondre dans une enveloppe</button>}
      </article>)}
    </div>
    {error && <p className="message-send-error" role="alert">{error}</p>}
    <form className="clan-composer" onSubmit={submit}>
      {replyTo && <div className="clan-replying"><span>Réponse à une enveloppe</span><button type="button" onClick={() => { setReplyTo(null); setRecipientIds([]); }}>Annuler</button></div>}
      <div className="clan-recipient-picker"><div className="clan-recipient-heading"><strong>Destinataires</strong>{selectableMembers.length > 0 && <span>{recipientIds.filter((id) => selectableIds.includes(id)).length}/{selectableMembers.length} sélectionnés</span>}</div>{selectableMembers.length > 0 && <button type="button" className="clan-select-all" onClick={toggleAllRecipients}>{everyoneSelected ? "Tout désélectionner" : `Tout cocher · ${selectableMembers.length}`}</button>}<div className="clan-recipient-list">{selectableMembers.map((member) => { const id = String(member.id || member._id); return <label key={id}><input type="checkbox" checked={recipientIds.includes(id)} onChange={() => toggleRecipient(id)} />{member.avatar ? <img src={member.avatar} alt="" /> : <span className="clan-recipient-initial">{member.username?.charAt(0)?.toUpperCase() || "M"}</span>}<span>{member.username || "Membre"}</span></label>; })}{selectableMembers.length === 0 && <small>Ouvre une enveloppe pour pouvoir y répondre.</small>}</div></div>
      <label className="clan-attach-button">＋ Photo ou fichier<input type="file" multiple hidden accept="image/*,.pdf,.doc,.docx,.txt,.zip" onChange={(event) => { const chosen = Array.from(event.target.files || []); if (chosen.length + files.length > 4 || chosen.some((file) => file.size > 8 * 1024 * 1024)) { setError("Maximum 4 fichiers, 8 Mo chacun."); return; } setFiles((current) => [...current, ...chosen]); event.target.value = ""; }} /></label>
      {files.length > 0 && <div className="message-file-chips">{files.map((file, index) => <button type="button" key={`${file.name}-${index}`} onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}>📎 {file.name} ×</button>)}</div>}
      <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={5000} placeholder="Écris un message à placer dans une enveloppe…" />
      <div className="clan-composer-footer"><label><input type="checkbox" checked={signed} onChange={(event) => setSigned(event.target.checked)} />Signer avec mon nom</label><button type="submit" disabled={sending || (!text.trim() && !files.length) || !recipientIds.length}>{sending ? "Envoi…" : "Placer dans une enveloppe"}</button></div>
    </form>
    {governanceOpen && <ClanGovernance clan={clan} token={token} user={user} darkMode={darkMode} onClanUpdated={onClanUpdated} onClose={() => setGovernanceOpen(false)} />}
  </div>;
}

function ClanGovernance({ clan, token, user, darkMode, onClose, onClanUpdated }) {
  const [votes, setVotes] = useState([]); const [kind, setKind] = useState("leader"); const [title, setTitle] = useState(""); const [target, setTarget] = useState(""); const [candidates, setCandidates] = useState([]); const [inviteeIds, setInviteeIds] = useState([]); const [query, setQuery] = useState(""); const [results, setResults] = useState([]); const [error, setError] = useState(""); const [stakeAmount, setStakeAmount] = useState("1");
  const [localMembers, setLocalMembers] = useState(clan.members || []);
  const [localClan, setLocalClan] = useState(clan);
  const myId = String(user?.id || user?._id); const members = localMembers.filter((person) => String(person._id || person.id) !== myId);
  const chief = String(localClan.owner?._id || localClan.owner) === myId;
  const admins = localClan.administrators || [];
  const moderators = localClan.moderators || [];
  const knownMembers = new Set(localMembers.map((person) => String(person._id || person.id)));
  const inviteResults = results.filter((person) => {
    const id = String(person.id || person._id);
    return id !== myId && !knownMembers.has(id);
  });
  const inviteResultIds = inviteResults.map((person) => String(person.id || person._id));
  const allInviteesSelected = inviteResultIds.length > 0 && inviteResultIds.every((id) => inviteeIds.includes(id));
  const toggleAllInvitees = () => setInviteeIds((current) => allInviteesSelected
    ? current.filter((id) => !inviteResultIds.includes(id))
    : [...new Set([...current, ...inviteResultIds])]);
  const canInvite = chief || admins.some((id) => String(id?._id || id) === myId) || moderators.some((id) => String(id?._id || id) === myId);
  const memberRole = (person) => {
    const id = String(person._id || person.id);
    if (id === String(localClan.owner?._id || localClan.owner)) return "Chef";
    if (admins.some((item) => String(item?._id || item) === id)) return "Administrateur";
    if (moderators.some((item) => String(item?._id || item) === id)) return "Modérateur";
    return "Membre";
  };
  const memberSections = ["Chef", "Administrateur", "Modérateur", "Membre"].map((role) => ({
    role,
    members: localMembers.filter((person) => memberRole(person) === role).sort((a, b) => String(a.username || "").localeCompare(String(b.username || ""), "fr"))
  })).filter((section) => section.members.length);
  const refresh = () => Promise.all([getClanVotes({ clanId: clan._id, token }), getClans(token)]).then(([items, currentClans]) => { setVotes(items); const current = currentClans.find((item) => String(item._id) === String(clan._id)); if (current) { setLocalClan(current); setLocalMembers(current.members || []); onClanUpdated?.(current); } }).catch((e) => setError(e.message));
  useEffect(() => { refresh(); }, [clan._id, token]);
  useEffect(() => { const timer = setInterval(refresh, 30000); return () => clearInterval(timer); }, [clan._id, token]);
  useEffect(() => { const q = query.trim(); if (!q) { setResults([]); return; } const timer = setTimeout(() => searchUsers({ q, token }).then(setResults).catch(() => {}), 250); return () => clearTimeout(timer); }, [query, token]);
  const invite = async () => { try { const chosen = inviteResults.filter((person) => inviteeIds.includes(String(person.id || person._id))); if (!chosen.length) return; const updated = await addClanMembers({ clanId: clan._id, memberIds: chosen.map((p) => p.id || p._id), token }); setLocalMembers(updated.members || localMembers); setLocalClan(updated); onClanUpdated?.(updated); setInviteeIds([]); setQuery(""); setResults([]); setError("Les membres sélectionnés ont été ajoutés au clan."); } catch (e) { setError(e.message); } };
  const startVote = async (event) => { event.preventDefault(); try { const payload = kind === "leader" ? { title, kind, options: candidates.map((id) => { const person = localMembers.find((m) => String(m._id || m.id) === id); return { key: id, label: person?.username || "Membre" }; }) } : { title, kind, target }; await createClanVote({ clanId: clan._id, payload, token }); setTitle(""); setCandidates([]); await refresh(); } catch (e) { setError(e.message); } };
  const toggle = (id) => setCandidates((list) => list.includes(String(id)) ? list.filter((item) => item !== String(id)) : [...list, String(id)]);
  const toggleInvitee = (id) => setInviteeIds((list) => list.includes(String(id)) ? list.filter((item) => item !== String(id)) : [...list, String(id)]);
  return <div className={`clan-modal-overlay ${darkMode ? "clan-dark-modal-overlay" : ""}`}><section className={`clan-modal clan-governance-modal ${darkMode ? "clan-governance-dark" : ""}`}><header><div><span>DÉCISIONS COLLECTIVES</span><h2>Gouvernance du clan</h2></div><button type="button" onClick={onClose}>×</button></header>
    <div className="clan-rank-list"><div className="clan-member-roster-heading"><strong>Membres du clan</strong><span>{localMembers.length}/100</span></div><small>Les rôles sont regroupés pour retrouver rapidement les responsables et les membres.</small>{memberSections.map((section) => <section className="clan-member-section" key={section.role}><header><strong>{section.role}</strong><span>{section.members.length}</span></header>{section.members.map((person) => { const id = String(person._id || person.id); return <div className="clan-member-row" key={id}><span className="clan-member-avatar">{person.avatar ? <img src={person.avatar} alt="" /> : person.username?.charAt(0)?.toUpperCase() || "M"}</span><span className="clan-member-name">{person.username || "Membre"}</span>{id === myId && <small>Toi</small>}</div>; })}</section>)}</div>
    {canInvite && <div className="clan-invite-controls"><strong>Inviter des membres</strong><p>Recherche un nom, puis sélectionne une personne ou tout le résultat.</p><input placeholder="Rechercher un membre à ajouter" value={query} onChange={(e) => setQuery(e.target.value)} />{inviteResults.length > 0 && <div className="clan-invite-select-all"><span>{inviteeIds.filter((id) => inviteResultIds.includes(id)).length}/{inviteResults.length} sélectionnés</span><button type="button" onClick={toggleAllInvitees}>{allInviteesSelected ? "Tout désélectionner" : `Tout cocher · ${inviteResults.length}`}</button></div>}{inviteResults.map((p) => <label className="clan-invite-result" key={p.id || p._id}><input type="checkbox" checked={inviteeIds.includes(String(p.id || p._id))} onChange={() => toggleInvitee(p.id || p._id)} /><span className="clan-member-avatar">{p.avatar ? <img src={p.avatar} alt="" /> : p.username?.charAt(0)?.toUpperCase() || "M"}</span>{p.username}</label>)}{query.trim() && inviteResults.length === 0 && <small>Aucun nouveau membre à ajouter dans ces résultats.</small>}<button type="button" onClick={invite} disabled={!inviteResults.some((p) => inviteeIds.includes(String(p.id || p._id)))}>Ajouter les membres sélectionnés</button></div>}
    <form className="clan-vote-form" onSubmit={startVote}><strong>Proposer un vote anonyme</strong><input required maxLength={140} placeholder="Objet du vote" value={title} onChange={(e) => setTitle(e.target.value)} /><select value={kind} onChange={(e) => { setKind(e.target.value); setCandidates([]); }}><option value="leader">Élire un nouveau chef</option><option value="rank">Modifier le rang d’un membre</option></select>{kind === "rank" ? <select required value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Membre concerné</option>{members.filter((m) => String(m._id || m.id) !== String(clan.owner?._id || clan.owner)).map((m) => <option key={m._id || m.id} value={m._id || m.id}>{m.username}</option>)}</select> : <div className="clan-candidate-list">{localMembers.map((m) => <label key={m._id || m.id}><input type="checkbox" checked={candidates.includes(String(m._id || m.id))} onChange={() => toggle(m._id || m.id)} />{m.username}</label>)}</div>}<button disabled={!title.trim() || (kind === "leader" && candidates.length < 2) || (kind === "rank" && !target)}>Lancer le vote (72 h)</button></form>
    <div className="clan-vote-list"><strong>Votes anonymes pondérés par Piz</strong>{votes.map((vote) => <article key={vote._id}><h3>{vote.title}</h3>{vote.status === "open" && !vote.hasVoted && <label className="clan-vote-stake">Piz déployés · 1 Piz = 1 voix<input type="number" min="0.01" max="100000" step="0.01" value={stakeAmount} onChange={(event) => setStakeAmount(event.target.value)} /></label>}{vote.options.map((option) => <div className="clan-vote-option" key={option.key}><span>{option.label} · {Number(option.votes).toLocaleString("fr-FR")} Piz de poids</span>{vote.status === "open" && !vote.hasVoted && <button onClick={() => castClanVote({ clanId: clan._id, voteId: vote._id, option: option.key, amount: Number(stakeAmount), token }).then(refresh).catch((e) => setError(e.message))}>Déployer</button>}</div>)}<small>{vote.status === "open" ? `Ouvert jusqu’au ${new Date(vote.closesAt).toLocaleString("fr-FR")}` : vote.result === "no-majority" ? "Clos : aucun candidat élu, les Piz ont été rendus" : `Résultat validé · ${Number(vote.totalPizStaked).toLocaleString("fr-FR")} Piz engagés`}</small>{vote.status === "open" && vote.hasVoted && <small>Ton poids de vote est enregistré. Le choix individuel reste privé.</small>}</article>)}</div>
    {error && <p className="clan-form-error">{error}</p>}<footer><button type="button" onClick={onClose}>Fermer</button></footer></section></div>;
}

function PrivateAttachment({ attachment, token }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true; let objectUrl = "";
    fetch(`${API_BASE_URL.replace(/\/api$/, "")}${attachment.url}`, { headers: { Authorization: `Bearer ${token}` } }).then((response) => { if (!response.ok) throw new Error("Fichier indisponible"); return response.blob(); }).then((blob) => { objectUrl = URL.createObjectURL(blob); if (active) setSrc(objectUrl); }).catch(() => {});
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [attachment.url, token]);
  if (!src) return <span className="private-file-link">📎 {attachment.originalName} · Chargement…</span>;
  return attachment.mimetype?.startsWith("image/") ? <img className="private-message-image" src={src} alt={attachment.originalName} /> : <a className="private-file-link" href={src} download={attachment.originalName}>📎 {attachment.originalName} · Télécharger</a>;
}

export default Messages;
