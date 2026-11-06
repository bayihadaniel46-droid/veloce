import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/authContext";
import { getCarrefour, publishAnonymousPost, publishStatus, revealCarrefourAuthor } from "../services/carrefourService";
import "../carrefour.css";

function Carrefour({ onBack }) {
  const { token, user } = useAuth();
  const [statuses, setStatuses] = useState([]);
  const [anonymousPosts, setAnonymousPosts] = useState([]);
  const [statusText, setStatusText] = useState("");
  const [anonymousText, setAnonymousText] = useState("");
  const [revealedAuthors, setRevealedAuthors] = useState({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const data = await getCarrefour(token);
      setStatuses(data.statuses || []);
      setAnonymousPosts(data.anonymousPosts || []);
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Impossible de charger le Carrefour.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void refresh(); }, [refresh]);

  const submitStatus = async (event) => {
    event.preventDefault();
    if (!statusText.trim() || sending) return;
    try {
      setSending(true); setError(""); setNotice("");
      const status = await publishStatus({ content: statusText, token });
      setStatuses((current) => [status, ...current]);
      setStatusText("");
      setNotice("Statut publié · 1 Piz débité · visible pendant 24 h.");
    } catch (requestError) { setError(requestError.message); }
    finally { setSending(false); }
  };

  const submitAnonymous = async (event) => {
    event.preventDefault();
    if (!anonymousText.trim() || sending) return;
    try {
      setSending(true); setError(""); setNotice("");
      const item = await publishAnonymousPost({ content: anonymousText, token });
      setAnonymousPosts((current) => [item, ...current]);
      setAnonymousText("");
      setNotice("Publication anonyme ajoutée · 1 Piz débité.");
    } catch (requestError) { setError(requestError.message); }
    finally { setSending(false); }
  };

  const reveal = async (item) => {
    if (!window.confirm("Révéler l’identité de l’auteur pour 15 Piz ? La moitié lui sera versée et l’autre moitié ira à l’administration.")) return;
    try {
      setError("");
      const result = await revealCarrefourAuthor({ itemId: item._id, token });
      setRevealedAuthors((current) => ({ ...current, [item._id]: result.author }));
      setAnonymousPosts((current) => current.map((entry) => entry._id === item._id ? { ...entry, identityRevealed: true } : entry));
    } catch (requestError) { setError(requestError.message); }
  };

  return <section className="carrefour-page">
    <header className="carrefour-hero">
      <button type="button" className="carrefour-back" onClick={onBack}>← Accueil</button>
      <span className="carrefour-kicker">LE CARREFOUR VELOCE</span>
      <h1>Tout se croise ici.</h1>
      <p>Les statuts restent signés. Les messages du Carrefour sont publiés sans nom.</p>
    </header>

    <section className="carrefour-status-section">
      <div className="carrefour-section-heading"><div><span>24 HEURES</span><h2>Statuts des utilisateurs</h2></div><small>Publication : 1 Piz</small></div>
      <form className="carrefour-composer carrefour-status-composer" onSubmit={submitStatus}>
        <span className="carrefour-user-avatar">{user?.avatar ? <img src={user.avatar} alt="" /> : user?.username?.charAt(0)?.toUpperCase()}</span>
        <input value={statusText} onChange={(event) => setStatusText(event.target.value)} maxLength={500} placeholder="Partage un statut avec ton nom…" aria-label="Écrire un statut" />
        <button type="submit" disabled={sending || !statusText.trim()}>Publier</button>
      </form>
      <div className="carrefour-status-list">
        {statuses.map((status) => <article className="carrefour-status-card" key={status._id}>
          <span className="carrefour-user-avatar">{status.author?.avatar ? <img src={status.author.avatar} alt="" /> : status.author?.username?.charAt(0)?.toUpperCase()}</span>
          <div><strong>{status.author?.username || "Utilisateur"}</strong><p>{status.content}</p><small>Expire {new Date(status.expiresAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</small></div>
        </article>)}
        {!loading && statuses.length === 0 && <p className="carrefour-empty-inline">Les nouveaux statuts apparaîtront ici.</p>}
      </div>
    </section>

    <section className="carrefour-anonymous-section">
      <div className="carrefour-section-heading"><div><span>ANONYME</span><h2>Le centre des informations</h2></div><small>Révéler un auteur : 15 Piz</small></div>
      <form className="carrefour-anonymous-composer" onSubmit={submitAnonymous}>
        <label htmlFor="carrefour-anonymous-text">Dépose une pensée, une question ou une information sans afficher ton nom.</label>
        <textarea id="carrefour-anonymous-text" value={anonymousText} onChange={(event) => setAnonymousText(event.target.value)} maxLength={3000} rows={3} placeholder="Écris ici… personne ne verra ton identité." />
        <div><small>La publication coûte 1 Piz. L’identité de l’auteur reste confidentielle.</small><button type="submit" disabled={sending || !anonymousText.trim()}>{sending ? "Publication…" : "Déposer anonymement"}</button></div>
      </form>
      {notice && <p className="carrefour-notice" role="status">{notice}</p>}
      {error && <p className="carrefour-error" role="alert">{error}</p>}
      <div className="carrefour-anonymous-feed">
        {loading && <p className="carrefour-empty">Chargement du Carrefour…</p>}
        {!loading && anonymousPosts.length === 0 && <div className="carrefour-empty"><span>◈</span><strong>Le Carrefour est encore calme</strong><p>La première contribution apparaîtra ici, sans nom.</p></div>}
        {anonymousPosts.map((item) => {
          const author = revealedAuthors[item._id];
          return <article className="carrefour-anonymous-card" key={item._id}>
            <div className="carrefour-anonymous-meta"><span className="carrefour-anonymous-mark">◈</span><strong>Une voix du Carrefour</strong><time>{new Date(item.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div>
            <p>{item.content}</p>
            {author ? <div className="carrefour-revealed-author">Auteur révélé : <strong>@{author.username}</strong></div> : item.identityRevealed ? <span className="carrefour-revealed-author">Identité déjà révélée sur ce compte.</span> : <button type="button" className="carrefour-reveal-button" onClick={() => reveal(item)}>Révéler l’identité · 15 Piz</button>}
          </article>;
        })}
      </div>
    </section>
  </section>;
}

export default Carrefour;
