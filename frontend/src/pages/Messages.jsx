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
  sendClanEnvelope,
  addClanMembers, getClanVotes, createClanVote, castClanVote
} from "../services/messageService";
import { API_BASE_URL } from "../config";
import "./Messages.css";

const EMOJI_LIBRARY = [
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
const MESSAGE_EMOJIS = ["😀", "😂", "🥰", "😍", "😘", "😊", "😎", "😭", "😢", "😡", "🤔", "🙏", "👏", "👍", "👎", "❤️", "💖", "💔", "🔥", "✨", "🎉", "👋", "💪", "🤝", "✅", "❌", "⚠️", "💰", "🏠", "🎵", "🍽️", "☀️"];
const MESSAGE_LETTERS = "abcdefghijklmnopqrstuvwxyzàâçéèêëîïôùûüÿœæ'!?.,".split("");

function keepLettersSeparated(value) {
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
  searchUsers
} from "../services/userService";


function Messages({ initialUser = null, onInitialUserHandled, onComposerStateChange = () => {} }) {
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
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showCreateClan, setShowCreateClan] = useState(false);
  const [showEmojiLibrary, setShowEmojiLibrary] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [showEmojiKeyboard, setShowEmojiKeyboard] = useState(false);
  const [emojiKeyboardMode, setEmojiKeyboardMode] = useState("emoji");
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
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const addComposerText = (text) => {
    setContent((current) => keepLettersSeparated(`${current}${text}`));
    onComposerStateChange(true);
    window.setTimeout(() => composerRef.current?.focus(), 0);
  };

  const matchingEmojis = EMOJI_LIBRARY.filter((entry) => {
    const query = emojiSearch.trim().toLocaleLowerCase("fr");
    return !query || entry.words.some((word) => word.toLocaleLowerCase("fr").includes(query)) || entry.label.toLocaleLowerCase("fr").includes(query);
  });

  const openEmojiLibrary = () => {
    setEmojiSearch("");
    setShowEmojiLibrary(true);
  };

  useEffect(() => () => onComposerStateChange(false), [onComposerStateChange]);

  useEffect(() => {
    if (!selectedUser?._id) return;
    const key = `veloce_chat_wallpaper_${selectedUser._id}`;
    setChatWallpaper(localStorage.getItem(key) || "night");
  }, [selectedUser?._id]);

  const updateWallpaper = (value) => {
    setChatWallpaper(value);
    if (selectedUser?._id) {
      localStorage.setItem(`veloce_chat_wallpaper_${selectedUser._id}`, value);
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

        setConversations(data);

      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

  const refreshMessagesPage = async () => {
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
      } else if (selectedClan) {
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


  const openConversation = useCallback(
    async (person) => {
      const personId = person._id || person.id;
      activeConversationId.current = personId;
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
    setSelectedUser(null);
    setSelectedClan(null);
  };

  const openClan = (clan) => {
    activeConversationId.current = clan._id;
    setSelectedUser(null);
    setSelectedClan(clan);
    setSendError("");
  };

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

      <div className={`messages-layout ${selectedUser || selectedClan ? "conversation-open" : ""}`}>

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


          <div className="conversation-list">

            {clans.length > 0 && <div className="conversation-group-label">TES CLANS</div>}
            {clans.map((clan) => <button key={clan._id} type="button" className={`conversation-card clan-conversation-card ${selectedClan?._id === clan._id ? "conversation-active" : ""}`} onClick={() => openClan(clan)}>
              <div className="clan-avatar">✉</div><div className="conversation-info"><strong>{clan.name}</strong><span>{clan.memberCount} membres · Enveloppes privées</span></div>
            </button>)}
            <div className="conversation-group-label">CONVERSATIONS</div>

            {conversations.length === 0 ? (
              <p className="messages-empty">
                Aucune conversation.
              </p>
            ) : (
              conversations.map(
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
                          conversation.user
                            .username
                        }
                      </strong>

                      <span>
                        {
                          conversation.lastMessage
                        }
                      </span>

                    </div>

                    {conversation.unread > 0 && (
                      <b>
                        {conversation.unread}
                      </b>
                    )}

                  </button>
                )
              )
            )}

          </div>

        </div>


        {/* ==================================================
            CONVERSATION
        ================================================== */}

        <div className="messages-conversation">

          {selectedClan ? <ClanRoom clan={selectedClan} token={token} user={user} onBack={closeConversation} onClanUpdated={(updated) => { setSelectedClan(updated); setClans((current) => current.map((item) => item._id === updated._id ? { ...item, ...updated, memberCount: updated.members?.length || item.memberCount } : item)); }} /> : !selectedUser ? (
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
                  aria-label={`Options de conversation avec ${selectedUser.username}`}
                >
                  <span className="message-avatar">
                    {selectedUser.avatar ? <img src={selectedUser.avatar} alt="" /> : selectedUser.username?.charAt(0).toUpperCase()}
                  </span>
                  <span><strong>{selectedUser.username}</strong><small>Profil et apparence</small></span>
                  <span className="conversation-profile-chevron">⌄</span>
                </button>
                <div className="conversation-call-actions" aria-label="Options d’appel">
                  <button type="button" aria-label="Appel audio" title="Appel audio"><CallGlyph /><span>Appel</span></button>
                  <button type="button" aria-label="Appel vidéo" title="Appel vidéo"><CallGlyph video /><span>Vidéo</span></button>
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
                    const nextValue = keepLettersSeparated(event.target.value);
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

              {showEmojiKeyboard && <div className="veloce-emoji-keyboard" aria-label="Clavier Veloce">
                <div className="veloce-emoji-keyboard-head"><strong>{emojiKeyboardMode === "emoji" ? "Clavier emoji" : "Une lettre à la fois"}</strong><button type="button" onClick={() => setEmojiKeyboardMode((mode) => mode === "emoji" ? "letters" : "emoji")}>{emojiKeyboardMode === "emoji" ? "ABC" : "😊"}</button><button type="button" onClick={() => setShowEmojiKeyboard(false)} aria-label="Fermer le clavier">×</button></div>
                <div className="veloce-emoji-keyboard-grid">{(emojiKeyboardMode === "emoji" ? MESSAGE_EMOJIS : MESSAGE_LETTERS).map((key) => <button type="button" key={key} disabled={emojiKeyboardMode === "letters" && /^(\p{L})$/u.test(key) && /\p{L}$/u.test(Array.from(content).at(-1) || "")} onClick={() => addComposerText(key)}>{key}</button>)}</div>
                <div className="veloce-emoji-keyboard-foot"><button type="button" onClick={() => { setContent((current) => Array.from(current).slice(0, -1).join("")); composerRef.current?.focus(); }}>⌫ Effacer</button><button type="button" onClick={() => addComposerText(" ")}>Espace</button></div>
              </div>}

              {showChatProfile && <ChatProfileDialog person={selectedUser} wallpaper={chatWallpaper} onWallpaperChange={updateWallpaper} onClose={() => setShowChatProfile(false)} />}
              {activeMessage && <MessageActionsSheet message={activeMessage} onSelect={performMessageAction} onClose={() => setActiveMessage(null)} />}
              {forwardTarget && <ForwardMessageDialog conversations={conversations} onSelect={forwardMessageTo} onClose={() => setForwardTarget(null)} />}

            </>

          )}

        </div>

      </div>

      {showCreateClan && <ClanCreateDialog token={token} onClose={() => setShowCreateClan(false)} onCreated={handleClanCreated} />}
      {showEmojiLibrary && <div className="veloce-emoji-library-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowEmojiLibrary(false); }}><section className="veloce-emoji-library" role="dialog" aria-modal="true" aria-labelledby="emoji-library-title"><header><div><span>VOCE VISUELLE</span><h2 id="emoji-library-title">Bibliothèque d’emojis</h2></div><button type="button" onClick={() => setShowEmojiLibrary(false)} aria-label="Fermer">×</button></header><label className="veloce-emoji-search">Trouver une idée<input autoFocus value={emojiSearch} onChange={(event) => setEmojiSearch(event.target.value)} placeholder="Écris un mot : amour, merci, rire…" /></label><div className="veloce-emoji-library-results">{matchingEmojis.map((entry) => <button type="button" key={entry.label} onClick={() => { addComposerText(entry.emoji); setShowEmojiLibrary(false); }}><span>{entry.emoji}</span><strong>{entry.label}</strong><small>{entry.words.slice(0, 3).join(" · ")}</small></button>)}{matchingEmojis.length === 0 && <p>Aucun emoji trouvé. Essaie un autre mot.</p>}</div></section></div>}

    </section>
  );
}

const CHAT_WALLPAPERS = [
  { id: "night", label: "Nuit", swatch: "#17191f" },
  { id: "violet", label: "Violet", swatch: "#211832" },
  { id: "ocean", label: "Océan", swatch: "#122936" },
  { id: "rose", label: "Prune", swatch: "#351d31" },
];

function ChatProfileDialog({ person, wallpaper, onWallpaperChange, onClose }) {
  return (
    <div className="chat-profile-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="chat-profile-dialog" role="dialog" aria-modal="true" aria-label={`Profil de ${person.username}`}>
        <header><div><span>CONVERSATION PRIVÉE</span><h2>Profil du contact</h2></div><button type="button" onClick={onClose} aria-label="Fermer">×</button></header>
        <div className="chat-profile-identity">
          <span className="message-avatar">{person.avatar ? <img src={person.avatar} alt="" /> : person.username?.charAt(0).toUpperCase()}</span>
          <div><strong>{person.username}</strong><small>{person.bio || "Membre de Veloce"}</small></div>
        </div>
        <h3>Fond d’écran de cette conversation</h3>
        <p>Ce réglage est enregistré uniquement sur cet appareil.</p>
        <div className="chat-wallpaper-options">
          {CHAT_WALLPAPERS.map((option) => (
            <button key={option.id} type="button" className={wallpaper === option.id ? "selected" : ""} onClick={() => onWallpaperChange(option.id)}>
              <span style={{ background: option.swatch }} />{option.label}
            </button>
          ))}
        </div>
        <footer><button type="button" onClick={onClose}>Terminé</button></footer>
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

  return <div className="clan-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="clan-modal" onSubmit={submit}>
      <header><div><span>NOUVEL ESPACE PRIVÉ</span><h2>Créer un clan</h2></div><button type="button" onClick={onClose} aria-label="Fermer">×</button></header>
      <label>Nom du clan<input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="Ex. Cercle de lecture" required /></label>
      <label>Description <small>(facultative)</small><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={240} placeholder="De quoi parle ce clan ?" /></label>
      <label>Inviter des membres<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un nom d’utilisateur" /></label>
      {selected.length > 0 && <p className="clan-selection-count">{selected.length} membre{selected.length > 1 ? "s" : ""} sélectionné{selected.length > 1 ? "s" : ""}</p>}
      <div className="clan-user-results">{results.map((person) => <label key={person.id} className="clan-user-option"><input type="checkbox" checked={selected.includes(person.id)} onChange={() => setSelected((current) => current.includes(person.id) ? current.filter((id) => id !== person.id) : [...current, person.id])} /><span className="message-avatar">{person.avatar ? <img src={person.avatar} alt="" /> : person.username?.charAt(0).toUpperCase()}</span><span><strong>{person.username}</strong><small>{person.bio || "Membre de Veloce"}</small></span></label>)}</div>
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
  const toggleRecipient = (id) => setRecipientIds((current) => current.includes(String(id)) ? current.filter((value) => value !== String(id)) : [...current, String(id)]);

  return <div className={`clan-room ${darkMode ? "clan-room-dark" : ""}`}>
    <header className="conversation-header clan-room-header"><button type="button" className="mobile-conversation-back" onClick={onBack} aria-label="Retour aux conversations">←</button><div className="clan-avatar">✉</div><div><strong>{clan.name}</strong><small>{clan.memberCount || clan.members?.length} membres · enveloppes privées</small></div><button className="clan-theme-toggle" type="button" onClick={() => setDarkMode((current) => !current)} aria-label={darkMode ? "Activer le mode clair" : "Activer le mode sombre"}>{darkMode ? "☀️" : "🌙"}</button><button className="clan-governance-open" type="button" onClick={() => setGovernanceOpen(true)}>⚖ Gouvernance</button></header>
    <div className="clan-envelope-list" ref={envelopeListRef}>
      {loadingClan && <p className="messages-empty">Chargement des enveloppes…</p>}
      {!loadingClan && envelopes.length === 0 && <div className="clan-empty-state"><span>✉</span><strong>Un message privé au milieu du clan</strong><p>Écris à certains membres. Les autres ne verront qu’une enveloppe verrouillée.</p></div>}
      {envelopes.map((envelope) => <article className={`clan-envelope ${envelope.isOwn ? "clan-envelope-own" : ""} ${envelope.replyTo ? "clan-envelope-reply" : ""}`} key={envelope._id}>
        {envelope.replyTo && <small className="clan-reply-context">↳ Réponse à une enveloppe</small>}
        {envelope.signed && envelope.sender?.username && <span className="clan-signature">Signé par {envelope.sender.username}</span>}
        {envelope.opened ? <div className="clan-open-content"><span className="clan-open-stamp">✉</span>{envelope.content && <p>{envelope.content}</p>}{envelope.attachments?.map((file) => <PrivateAttachment key={file.fileId} attachment={file} token={token} />)}</div> : envelope.canOpen ? <button type="button" className="clan-open-button" onClick={() => openEnvelope(envelope._id)}><span>✉</span><strong>Ouvrir mon enveloppe</strong><small>Ce message t’a été adressé</small></button> : <div className="clan-locked-envelope" aria-label="Enveloppe verrouillée, non destinée à ce membre"><span>🔒</span><strong>Enveloppe verrouillée</strong><small>Le contenu est réservé à ses destinataires.</small></div>}
        <time>{new Date(envelope.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</time>
        {envelope.canReply && <button type="button" className="clan-reply-button" onClick={() => chooseReply(envelope)}>Répondre dans une enveloppe</button>}
      </article>)}
    </div>
    {error && <p className="message-send-error" role="alert">{error}</p>}
    <form className="clan-composer" onSubmit={submit}>
      {replyTo && <div className="clan-replying"><span>Réponse à une enveloppe</span><button type="button" onClick={() => { setReplyTo(null); setRecipientIds([]); }}>Annuler</button></div>}
      <div className="clan-recipient-picker"><strong>Destinataires</strong><div>{selectableMembers.map((member) => { const id = String(member.id || member._id); return <label key={id}><input type="checkbox" checked={recipientIds.includes(id)} onChange={() => toggleRecipient(id)} />{member.username || "Membre"}</label>; })}{selectableMembers.length === 0 && <small>Ouvre une enveloppe pour pouvoir y répondre.</small>}</div></div>
      <label className="clan-attach-button">＋ Photo ou fichier<input type="file" multiple hidden accept="image/*,.pdf,.doc,.docx,.txt,.zip" onChange={(event) => { const chosen = Array.from(event.target.files || []); if (chosen.length + files.length > 4 || chosen.some((file) => file.size > 8 * 1024 * 1024)) { setError("Maximum 4 fichiers, 8 Mo chacun."); return; } setFiles((current) => [...current, ...chosen]); event.target.value = ""; }} /></label>
      {files.length > 0 && <div className="message-file-chips">{files.map((file, index) => <button type="button" key={`${file.name}-${index}`} onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}>📎 {file.name} ×</button>)}</div>}
      <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={5000} placeholder="Écris un message à placer dans une enveloppe…" />
      <div className="clan-composer-footer"><label><input type="checkbox" checked={signed} onChange={(event) => setSigned(event.target.checked)} />Signer avec mon nom</label><button type="submit" disabled={sending || (!text.trim() && !files.length) || !recipientIds.length}>{sending ? "Envoi…" : "Placer dans une enveloppe"}</button></div>
    </form>
    {governanceOpen && <ClanGovernance clan={clan} token={token} user={user} darkMode={darkMode} onClanUpdated={onClanUpdated} onClose={() => setGovernanceOpen(false)} />}
  </div>;
}

function ClanGovernance({ clan, token, user, darkMode, onClose, onClanUpdated }) {
  const [votes, setVotes] = useState([]); const [kind, setKind] = useState("leader"); const [title, setTitle] = useState(""); const [target, setTarget] = useState(""); const [candidates, setCandidates] = useState([]); const [query, setQuery] = useState(""); const [results, setResults] = useState([]); const [error, setError] = useState("");
  const [localMembers, setLocalMembers] = useState(clan.members || []);
  const [localClan, setLocalClan] = useState(clan);
  const myId = String(user?.id || user?._id); const members = localMembers.filter((person) => String(person._id || person.id) !== myId);
  const chief = String(localClan.owner?._id || localClan.owner) === myId;
  const admins = localClan.administrators || [];
  const moderators = localClan.moderators || [];
  const canInvite = chief || admins.some((id) => String(id?._id || id) === myId) || moderators.some((id) => String(id?._id || id) === myId);
  const refresh = () => Promise.all([getClanVotes({ clanId: clan._id, token }), getClans(token)]).then(([items, currentClans]) => { setVotes(items); const current = currentClans.find((item) => String(item._id) === String(clan._id)); if (current) { setLocalClan(current); setLocalMembers(current.members || []); onClanUpdated?.(current); } }).catch((e) => setError(e.message));
  useEffect(() => { refresh(); }, [clan._id, token]);
  useEffect(() => { const timer = setInterval(refresh, 30000); return () => clearInterval(timer); }, [clan._id, token]);
  useEffect(() => { const q = query.trim(); if (!q) { setResults([]); return; } const timer = setTimeout(() => searchUsers({ q, token }).then(setResults).catch(() => {}), 250); return () => clearTimeout(timer); }, [query, token]);
  const invite = async () => { try { const chosen = results.filter((person) => candidates.includes(String(person.id || person._id))); if (!chosen.length) return; const updated = await addClanMembers({ clanId: clan._id, memberIds: chosen.map((p) => p.id || p._id), token }); setLocalMembers(updated.members || localMembers); setLocalClan(updated); onClanUpdated?.(updated); setCandidates([]); setQuery(""); setResults([]); setError("Les membres sélectionnés ont été ajoutés au clan."); } catch (e) { setError(e.message); } };
  const startVote = async (event) => { event.preventDefault(); try { const payload = kind === "leader" ? { title, kind, options: candidates.map((id) => { const person = localMembers.find((m) => String(m._id || m.id) === id); return { key: id, label: person?.username || "Membre" }; }) } : { title, kind, target }; await createClanVote({ clanId: clan._id, payload, token }); setTitle(""); setCandidates([]); await refresh(); } catch (e) { setError(e.message); } };
  const toggle = (id) => setCandidates((list) => list.includes(String(id)) ? list.filter((item) => item !== String(id)) : [...list, String(id)]);
  return <div className={`clan-modal-overlay ${darkMode ? "clan-dark-modal-overlay" : ""}`}><section className={`clan-modal clan-governance-modal ${darkMode ? "clan-governance-dark" : ""}`}><header><div><span>DÉCISIONS COLLECTIVES</span><h2>Gouvernance du clan</h2></div><button type="button" onClick={onClose}>×</button></header>
    <div className="clan-rank-list"><strong>Hiérarchie et privilèges</strong><small>Chef : contrôle du clan et invitations · Administrateur : invitations · Modérateur : invitations · Membre : messages et votes anonymes</small>{localMembers.map((person) => { const id = String(person._id || person.id); const role = id === String(localClan.owner?._id || localClan.owner) ? "Chef" : admins.some((a) => String(a?._id || a) === id) ? "Administrateur" : moderators.some((a) => String(a?._id || a) === id) ? "Modérateur" : "Membre"; return <span key={id}>{person.username} <small>{role}</small></span>; })}</div>
    {canInvite && <div className="clan-invite-controls"><input placeholder="Rechercher un membre à ajouter" value={query} onChange={(e) => setQuery(e.target.value)} />{results.map((p) => <label key={p.id}><input type="checkbox" checked={candidates.includes(String(p.id || p._id))} onChange={() => toggle(p.id || p._id)} />{p.username}</label>)}<button type="button" onClick={invite} disabled={!results.some((p) => candidates.includes(String(p.id || p._id)))}>Ajouter les membres sélectionnés</button></div>}
    <form className="clan-vote-form" onSubmit={startVote}><strong>Proposer un vote anonyme</strong><input required maxLength={140} placeholder="Objet du vote" value={title} onChange={(e) => setTitle(e.target.value)} /><select value={kind} onChange={(e) => { setKind(e.target.value); setCandidates([]); }}><option value="leader">Élire un nouveau chef</option><option value="rank">Modifier le rang d’un membre</option></select>{kind === "rank" ? <select required value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Membre concerné</option>{members.filter((m) => String(m._id || m.id) !== String(clan.owner?._id || clan.owner)).map((m) => <option key={m._id || m.id} value={m._id || m.id}>{m.username}</option>)}</select> : <div className="clan-candidate-list">{localMembers.map((m) => <label key={m._id || m.id}><input type="checkbox" checked={candidates.includes(String(m._id || m.id))} onChange={() => toggle(m._id || m.id)} />{m.username}</label>)}</div>}<button disabled={!title.trim() || (kind === "leader" && candidates.length < 2) || (kind === "rank" && !target)}>Lancer le vote (72 h)</button></form>
    <div className="clan-vote-list"><strong>Votes anonymes</strong>{votes.map((vote) => <article key={vote._id}><h3>{vote.title}</h3>{vote.options.map((option) => <div className="clan-vote-option" key={option.key}><span>{option.label} · {option.votes} vote{option.votes === 1 ? "" : "s"}</span>{vote.status === "open" && !vote.hasVoted && <button onClick={() => castClanVote({ clanId: clan._id, voteId: vote._id, option: option.key, token }).then(refresh).catch((e) => setError(e.message))}>Voter</button>}</div>)}<small>{vote.status === "open" ? `Ouvert jusqu’au ${new Date(vote.closesAt).toLocaleString("fr-FR")}` : vote.result === "no-majority" ? "Clos : aucune majorité stricte" : `Résultat validé · ${vote.totalVotes} votes`}</small>{vote.status === "open" && vote.hasVoted && <small>Ton vote est enregistré. Le choix individuel reste privé.</small>}</article>)}</div>
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
