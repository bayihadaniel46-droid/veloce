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
  sendClanEnvelope
} from "../services/messageService";

import {
  searchUsers
} from "../services/userService";


function Messages({ initialUser = null, onInitialUserHandled }) {
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
  const activeConversationId = useRef("");

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
        !content.trim() ||
        !selectedUser ||
        sendingMessage
      ) {
        return;
      }

      const messageContent = content.trim();
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
            token
          });

        if (activeConversationId.current === recipientId) {
          setMessages((previous) => previous.map((item) =>
            item._id === temporaryId ? message : item
          ));
        }

        void loadConversations();

      } catch (error) {
        console.error(error);
        if (activeConversationId.current === recipientId) {
          setMessages((previous) => previous.filter((item) => item._id !== temporaryId));
          setContent((previous) => previous || messageContent);
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


  if (loading) {
    return (
      <div className="empty-feed">
        Chargement des messages...
      </div>
    );
  }


  return (
    <section className="messages-page">

      <div className={`messages-layout ${selectedUser || selectedClan ? "conversation-open" : ""}`}>

        {/* ==================================================
            LISTE DES CONVERSATIONS
        ================================================== */}

        <div className="messages-sidebar">

          <div className="messages-title">
            <div><span className="messages-eyebrow">VÉLOCE</span><h1>Messages</h1></div>
            <div className="messages-new-wrap">
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

          {selectedClan ? <ClanRoom clan={selectedClan} token={token} user={user} onBack={closeConversation} /> : !selectedUser ? (
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
                <div className="message-avatar">

                  {selectedUser.avatar ? (
                    <img
                      src={
                        selectedUser.avatar
                      }
                      alt=""
                    />
                  ) : (
                    selectedUser.username
                      ?.charAt(0)
                      .toUpperCase()
                  )}

                </div>

                <strong>
                  {selectedUser.username}
                </strong>

              </div>


              <div className="message-list">

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
                      >

                        <div className="message-bubble">
                          {message.content}
                          {message.pending && <small className="message-pending">Envoi…</small>}
                        </div>

                        <button
                          type="button"
                          className="message-delete-button"
                          title="Supprimer de ma boîte"
                          aria-label="Supprimer ce message de ma boîte"
                          disabled={message.pending || deletingMessageId === message._id}
                          onClick={() => handleDeleteMessage(message._id)}
                        >
                          {message.pending || deletingMessageId === message._id ? "…" : "🗑"}
                        </button>

                      </div>
                    );
                  }
                )}

              </div>


              {sendError && <p className="message-send-error" role="alert">{sendError}</p>}
              <div className="message-input-area">

                <textarea
                  value={content}
                  onChange={event =>
                    setContent(
                      event.target.value
                    )
                  }
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
                  placeholder="Écrire un message..."
                />

                <button
                  onClick={handleSend}
                  disabled={
                    !content.trim() || sendingMessage
                  }
                >
                  {sendingMessage ? "Envoi…" : "Envoyer"}
                </button>

              </div>

            </>

          )}

        </div>

      </div>

      {showCreateClan && <ClanCreateDialog token={token} onClose={() => setShowCreateClan(false)} onCreated={handleClanCreated} />}

    </section>
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

function ClanRoom({ clan, token, user, onBack }) {
  const [envelopes, setEnvelopes] = useState([]);
  const [loadingClan, setLoadingClan] = useState(true);
  const [text, setText] = useState("");
  const [recipientIds, setRecipientIds] = useState([]);
  const [signed, setSigned] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const myId = String(user?.id || user?._id || "");
  const members = (clan.members || []).filter((member) => String(member._id || member.id) !== myId);

  const refresh = async () => {
    try { setEnvelopes(await getClanMessages({ clanId: clan._id, token })); }
    catch (requestError) { setError(requestError.message || "Impossible de charger le clan."); }
    finally { setLoadingClan(false); }
  };
  useEffect(() => { refresh(); }, [clan._id, token]);

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
    if (!text.trim() || !recipientIds.length) return;
    try {
      setSending(true); setError("");
      const sent = await sendClanEnvelope({ clanId: clan._id, content: text, recipientIds, signed, replyTo: replyTo?._id, token });
      setEnvelopes((current) => [...current, sent]);
      setText(""); setRecipientIds([]); setReplyTo(null); setSigned(false);
    } catch (requestError) { setError(requestError.message || "Impossible d'envoyer l'enveloppe."); }
    finally { setSending(false); }
  };

  const selectableMembers = replyTo ? (replyTo.replyTargets || []).map((target) => ({ ...target, id: target._id })) : members;
  const toggleRecipient = (id) => setRecipientIds((current) => current.includes(String(id)) ? current.filter((value) => value !== String(id)) : [...current, String(id)]);

  return <div className="clan-room">
    <header className="conversation-header clan-room-header"><button type="button" className="mobile-conversation-back" onClick={onBack} aria-label="Retour aux conversations">←</button><div className="clan-avatar">✉</div><div><strong>{clan.name}</strong><small>{clan.memberCount || clan.members?.length} membres · enveloppes privées</small></div></header>
    <div className="clan-envelope-list">
      {loadingClan && <p className="messages-empty">Chargement des enveloppes…</p>}
      {!loadingClan && envelopes.length === 0 && <div className="clan-empty-state"><span>✉</span><strong>Un message privé au milieu du clan</strong><p>Écris à certains membres. Les autres ne verront qu’une enveloppe verrouillée.</p></div>}
      {envelopes.map((envelope) => <article className={`clan-envelope ${envelope.isOwn ? "clan-envelope-own" : ""} ${envelope.replyTo ? "clan-envelope-reply" : ""}`} key={envelope._id}>
        {envelope.replyTo && <small className="clan-reply-context">↳ Réponse à une enveloppe</small>}
        {envelope.signed && envelope.sender?.username && <span className="clan-signature">Signé par {envelope.sender.username}</span>}
        {envelope.opened ? <div className="clan-open-content"><span className="clan-open-stamp">✉</span><p>{envelope.content}</p></div> : envelope.canOpen ? <button type="button" className="clan-open-button" onClick={() => openEnvelope(envelope._id)}><span>✉</span><strong>Ouvrir mon enveloppe</strong><small>Ce message t’a été adressé</small></button> : <div className="clan-locked-envelope" aria-label="Enveloppe verrouillée, non destinée à ce membre"><span>🔒</span><strong>Enveloppe verrouillée</strong><small>Le contenu est réservé à ses destinataires.</small></div>}
        <time>{new Date(envelope.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</time>
        {envelope.canReply && <button type="button" className="clan-reply-button" onClick={() => chooseReply(envelope)}>Répondre dans une enveloppe</button>}
      </article>)}
    </div>
    {error && <p className="message-send-error" role="alert">{error}</p>}
    <form className="clan-composer" onSubmit={submit}>
      {replyTo && <div className="clan-replying"><span>Réponse à une enveloppe</span><button type="button" onClick={() => { setReplyTo(null); setRecipientIds([]); }}>Annuler</button></div>}
      <div className="clan-recipient-picker"><strong>Destinataires</strong><div>{selectableMembers.map((member) => { const id = String(member.id || member._id); return <label key={id}><input type="checkbox" checked={recipientIds.includes(id)} onChange={() => toggleRecipient(id)} />{member.username || "Membre"}</label>; })}{selectableMembers.length === 0 && <small>Ouvre une enveloppe pour pouvoir y répondre.</small>}</div></div>
      <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={5000} placeholder="Écris un message à placer dans une enveloppe…" />
      <div className="clan-composer-footer"><label><input type="checkbox" checked={signed} onChange={(event) => setSigned(event.target.checked)} />Signer avec mon nom</label><button type="submit" disabled={sending || !text.trim() || !recipientIds.length}>{sending ? "Envoi…" : "Placer dans une enveloppe"}</button></div>
    </form>
  </div>;
}

export default Messages;
