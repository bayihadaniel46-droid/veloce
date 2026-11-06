import { useCallback, useEffect, useRef, useState } from "react";
import { getCommunityMessages, publishCommunityUpdate, sendCommunityMessage } from "../services/messageService";
import "./CommunityRoom.css";

function CommunityRoom({ token, user, onBack }) {
  const [messages, setMessages] = useState([]);
  const [canPublish, setCanPublish] = useState(false);
  const [kind, setKind] = useState("message");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const stayAtBottomRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getCommunityMessages(token);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setCanPublish(Boolean(data.canPublish));
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Impossible de charger le clan serveur.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(refresh, 9000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const list = listRef.current;
    if (list && stayAtBottomRef.current) list.scrollTop = list.scrollHeight;
  }, [messages]);

  const submit = async (event) => {
    event.preventDefault();
    if (!content.trim() || sending) return;
    try {
      setSending(true);
      setError("");
      stayAtBottomRef.current = true;
      const sent = kind === "announcement"
        ? await publishCommunityUpdate({ content, kind, token })
        : await sendCommunityMessage({ content, kind, token });
      setMessages((current) => [...current, sent]);
      setContent("");
      setKind("message");
    } catch (requestError) {
      setError(requestError.message || "Impossible d’envoyer le message.");
    } finally {
      setSending(false);
    }
  };

  const handleScroll = () => {
    const list = listRef.current;
    if (!list) return;
    stayAtBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 100;
  };

  return <section className="community-room">
    <header className="community-room-header">
      <button type="button" className="mobile-conversation-back" onClick={onBack} aria-label="Retour aux conversations">←</button>
      <div className="community-room-mark" aria-hidden="true">🌐</div>
      <div className="community-room-heading"><span>ESPACE COMMUN VELOCE</span><strong>Clan serveur</strong><small>Questions · nouveautés · aide</small></div>
      <div className="community-room-presence"><i />Ouvert à tous</div>
    </header>

    <div className="community-room-messages" ref={listRef} onScroll={handleScroll} role="log" aria-label="Messages du clan serveur" aria-live="polite">
      <div className="community-room-welcome"><span>✨</span><div><strong>Bienvenue dans le clan serveur</strong><p>Pose une question, partage une idée ou retrouve ici les nouveautés et les guides de Veloce. Les messages sont visibles par tous les membres.</p></div></div>
      {loading && messages.length === 0 && <p className="community-room-state">Chargement de l’espace commun…</p>}
      {!loading && messages.length === 0 && <p className="community-room-state">L’espace est prêt. Lance la première discussion !</p>}
      {messages.map((message) => {
        const isAnnouncement = message.kind === "announcement";
        const isQuestion = message.kind === "question";
        const isAd = message.kind === "ad";
        const isOwn = String(message.sender?._id || "") === String(user?.id || user?._id || "");
        const author = message.sender?.username || (isAd ? "Partenaire Veloce" : "Équipe Veloce");
        return <article className={`community-message${isAnnouncement ? " is-announcement" : ""}${isQuestion ? " is-question" : ""}${isAd ? " is-ad" : ""}${isOwn ? " is-own" : ""}`} key={message._id}>
          <div className="community-message-avatar">{message.sender?.avatar ? <img src={message.sender.avatar} alt="" /> : (author.charAt(0).toUpperCase() || "V")}</div>
          <div className="community-message-body">
            <div className="community-message-meta"><strong>{author}</strong>{isAnnouncement && <span className="community-message-tag">NOUVEAUTÉ</span>}{isQuestion && <span className="community-message-tag question">QUESTION · 10 PIZ</span>}{isAd && <span className="community-message-tag ad">PUBLICITÉ</span>}<time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div>
            <p>{message.content}</p>
          </div>
        </article>;
      })}
      {error && <p className="community-room-error" role="alert">{error}</p>}
    </div>

    <form className="community-room-composer" onSubmit={submit}>
      <div className="community-composer-note">Ton message sera public dans le clan serveur.</div>
      <div className="community-composer-row">
        {canPublish ? <label className="community-post-kind"><span>Publier</span><select value={kind} onChange={(event) => setKind(event.target.value)}><option value="message">Discussion</option><option value="question">Question · 10 Piz</option><option value="announcement">Nouveauté / guide</option></select></label> : <label className="community-post-kind"><span>Type</span><select value={kind} onChange={(event) => setKind(event.target.value)}><option value="message">Discussion</option><option value="question">Question · 10 Piz</option></select></label>}
        <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={3000} rows={2} placeholder={kind === "announcement" ? "Explique la nouveauté ou le guide…" : "Pose ta question ou démarre une discussion…"} aria-label="Écrire dans le clan serveur" />
        <button type="submit" disabled={sending || !content.trim()}>{sending ? "Envoi…" : "Envoyer"}</button>
      </div>
    </form>
  </section>;
}

export default CommunityRoom;
