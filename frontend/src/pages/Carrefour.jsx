import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/authContext";
import { getCarrefour, publishAnonymousPost, publishStatus, revealCarrefourAuthor } from "../services/carrefourService";
import { submitContentReport } from "../services/userService";
import "../carrefour.css";

function Carrefour({ onBack }) {
  const { token, user } = useAuth();
  const [statuses, setStatuses] = useState([]);
  const [anonymousPosts, setAnonymousPosts] = useState([]);
  const [statusText, setStatusText] = useState("");
  const [anonymousText, setAnonymousText] = useState("");
  const [allowIdentityReveal, setAllowIdentityReveal] = useState(false);
  const [revealedAuthors, setRevealedAuthors] = useState({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reportingId, setReportingId] = useState("");
  const [canRevealIdentity, setCanRevealIdentity] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await getCarrefour(token);
      setStatuses(data.statuses || []);
      setAnonymousPosts(data.anonymousPosts || []);
      setCanRevealIdentity(Boolean(data.canRevealIdentity));
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
      const item = await publishAnonymousPost({ content: anonymousText, allowIdentityReveal, token });
      setAnonymousPosts((current) => [item, ...current]);
      setAnonymousText("");
      setAllowIdentityReveal(false);
      setNotice(item.allowIdentityReveal
        ? "Publication ajoutée. Tu as autorisé la révélation payante de ton identité · 1 Piz débité."
        : "Publication ajoutée en gardant ton identité privée · 1 Piz débité.");
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

  const reportItem = async (item) => {
    const category = window.prompt("Motif : harassment, hate, sexual, violence, spam, fraud, privacy ou other", "spam");
    if (!category) return;
    const normalizedCategory = category.trim().toLowerCase();
    if (!["harassment", "hate", "sexual", "violence", "spam", "fraud", "privacy", "other"].includes(normalizedCategory)) {
      setError("Choisis un motif valide dans la liste proposée.");
      return;
    }
    try {
      setReportingId(item._id);
      setError("");
      await submitContentReport({ token, contentType: "carrefour", contentId: item._id, category: normalizedCategory });
      setNotice("Signalement transmis à l’équipe de modération.");
    } catch (requestError) { setError(requestError.message || "Impossible de signaler cette publication."); }
    finally { setReportingId(""); }
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
        {canRevealIdentity ? <label className="carrefour-identity-consent">
          <input type="checkbox" checked={allowIdentityReveal} onChange={(event) => setAllowIdentityReveal(event.target.checked)} />
          <span><strong>J’autorise la révélation de mon identité</strong><small>Un lecteur pourra payer 15 Piz pour la voir. Je recevrai 7,5 Piz ; l’autre moitié ira à l’administration. Ce choix facultatif se fait maintenant, au dépôt.</small></span>
        </label> : <p className="carrefour-clan-privacy">En tant que membre d’un clan, ton identité reste protégée : la révélation payante est désactivée.</p>}
        <div><small>La publication coûte 1 Piz. Sans cette autorisation, personne ne peut payer pour révéler ton identité.</small><button type="submit" disabled={sending || !anonymousText.trim()}>{sending ? "Publication…" : "Déposer anonymement"}</button></div>
      </form>
      {notice && <p className="carrefour-notice" role="status">{notice}</p>}
      {error && <p className="carrefour-error" role="alert">{error}</p>}
      <div className="carrefour-anonymous-feed">
        {loading && <p className="carrefour-empty">Chargement du Carrefour…</p>}
        {!loading && anonymousPosts.length === 0 && <div className="carrefour-empty"><span>◈</span><strong>Le Carrefour est encore calme</strong><p>La première contribution apparaîtra ici, sans nom.</p></div>}
        {anonymousPosts.map((item) => {
          const author = revealedAuthors[item._id] || item.revealedAuthor;
          return <article className="carrefour-anonymous-card" key={item._id}>
            <div className="carrefour-anonymous-meta"><span className="carrefour-anonymous-mark">◈</span><strong>Une voix du Carrefour</strong><time>{new Date(item.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div>
            <p>{item.content}</p>
            <div className="carrefour-card-footer"><div>{author ? <div className="carrefour-revealed-author">{item.isOwner ? "Ta publication" : "Auteur révélé"} : <strong>@{author.username}</strong></div>
              : item.isOwner ? <span className="carrefour-revealed-author">{item.clanProtected ? "Identité protégée par le clan." : item.allowIdentityReveal ? "Tu as autorisé la révélation payante de ton identité." : "Tu as choisi de garder ton identité privée."}</span>
                : item.clanProtected ? <span className="carrefour-revealed-author">Identité protégée par le clan.</span>
                  : item.allowIdentityReveal ? <button type="button" className="carrefour-reveal-button" onClick={() => reveal(item)}>Révéler l’identité · 15 Piz</button>
                    : <span className="carrefour-revealed-author">L’auteur a choisi de rester anonyme.</span>}</div>
              {!item.isOwner && <button type="button" className="carrefour-report-button" disabled={reportingId === item._id} onClick={() => reportItem(item)}>{reportingId === item._id ? "…" : "⚑ Signaler"}</button>}
            </div>
          </article>;
        })}
      </div>
    </section>
  </section>;
}

export default Carrefour;
