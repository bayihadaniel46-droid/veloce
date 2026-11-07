import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/authContext";
import PostCard from "../components/PostCard";
import { API_BASE_URL } from "../config";
import "./PublicProfileSafety.css";

const API = API_BASE_URL;
function PublicProfile({ userId, onBack, onMessage }) {
  const { token, user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportCategory, setReportCategory] = useState("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [safetyMessage, setSafetyMessage] = useState("");

  const load = useCallback(async () => {
    if (!userId || !token) return;
    setLoading(true); setError("");
    try {
      const [profileResponse, postsResponse] = await Promise.all([
        fetch(`${API}/users/${userId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/posts/user/${userId}`)
      ]);
      const profileData = await profileResponse.json();
      const postsData = await postsResponse.json();
      if (!profileResponse.ok) throw new Error(profileData.message || "Impossible de charger le profil.");
      if (!postsResponse.ok) throw new Error(postsData.message || "Impossible de charger les publications.");
      setProfile(profileData);
      setPosts(Array.isArray(postsData.posts) ? postsData.posts : Array.isArray(postsData) ? postsData : []);
      try {
        const blockedResponse = await fetch(`${API}/users/blocked`, { headers: { Authorization: `Bearer ${token}` } });
        if (blockedResponse.ok) {
          const blockedData = await blockedResponse.json();
          setIsBlocked((blockedData.users || []).some((blockedUser) => String(blockedUser._id) === String(profileData.user?._id)));
        }
      } catch { /* Le chargement du profil reste disponible si la liste de blocage échoue. */ }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [userId, token]);

  useEffect(() => { load(); }, [load]);

  const toggleFollow = async () => {
    if (busy || !profile) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API}/users/${userId}/follow`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Impossible de modifier l’abonnement.");
      setProfile((current) => ({
        ...current,
        isFollowing: data.following,
        stats: { ...current.stats, followersCount: Math.max(0, current.stats.followersCount + (data.following ? 1 : -1)) }
      }));
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const toggleBlock = async () => {
    if (busy || !profile) return;
    setBusy(true); setError(""); setSafetyMessage("");
    try {
      const response = await fetch(`${API}/users/${userId}/block`, {
        method: isBlocked ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Impossible de modifier le blocage.");
      setIsBlocked(Boolean(data.blocked));
      setSafetyMessage(data.blocked ? "Compte bloqué : il ne pourra plus t’écrire ni t’appeler." : "Compte débloqué.");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const submitReport = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API}/users/${userId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ category: reportCategory, details: reportDetails })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Impossible d’envoyer le signalement.");
      setShowReport(false); setReportDetails("");
      setSafetyMessage("Signalement enregistré pour examen par la modération.");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="empty-feed">Chargement du profil…</div>;
  if (error && !profile) return <div className="error-message"><p>{error}</p><button onClick={onBack}>Retour</button></div>;
  if (!profile) return null;
  const person = profile.user;
  return (
    <section className="public-profile-page">
      <button className="public-profile-back" onClick={onBack}>← Retour</button>
      {error && <div className="profile-error">{error}</div>}
      <div className="profile-cover" />
      <div className="profile-main">
        <div className="profile-avatar">
          {person.avatar ? <img src={person.avatar} alt={person.username} /> : <span>{person.username?.charAt(0).toUpperCase()}</span>}
        </div>
        <div className="profile-information">
          <h1>{person.username}</h1>
          <p className="profile-handle">@{person.username}</p>
          <p className="profile-bio">{person.bio || "Aucune biographie pour le moment."}</p>
        </div>
        <div className="public-profile-actions">
          <button className="profile-edit-button" onClick={toggleFollow} disabled={busy}>
            {busy ? "…" : profile.isFollowing ? "Abonné(e)" : "S’abonner"}
          </button>
          {String(person._id) !== String(currentUser?._id || currentUser?.id) && (
            <>
              <button type="button" className="public-profile-message-button" onClick={() => onMessage?.(person)} disabled={isBlocked}>
                {isBlocked ? "Compte bloqué" : "✉ Écrire un message"}
              </button>
              <button type="button" className="profile-safety-button" onClick={toggleBlock} disabled={busy}>{isBlocked ? "Débloquer" : "Bloquer"}</button>
              <button type="button" className="profile-safety-button profile-report-button" onClick={() => setShowReport(true)}>Signaler</button>
            </>
          )}
        </div>
      </div>
      {safetyMessage && <p className="profile-safety-status" role="status">{safetyMessage}</p>}
      <div className="profile-stats">
        <div><strong>{posts.length}</strong><span>Publications</span></div>
        <div><strong>{profile.stats.followersCount}</strong><span>Abonnés</span></div>
        <div><strong>{profile.stats.followingCount}</strong><span>Abonnements</span></div>
      </div>
      <div className="public-profile-posts">
        <h2>Publications de {person.username}</h2>
        {posts.length ? posts.map((post) => <PostCard key={post._id} post={post} />) : <p className="empty-feed">Aucune publication pour le moment.</p>}
      </div>
      {showReport && <div className="profile-report-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowReport(false); }}><form className="profile-report-dialog" onSubmit={submitReport} role="dialog" aria-modal="true" aria-labelledby="profile-report-title"><header><div><span>SÉCURITÉ VELOCE</span><h2 id="profile-report-title">Signaler ce compte</h2></div><button type="button" onClick={() => setShowReport(false)} aria-label="Fermer">×</button></header><label>Motif<select value={reportCategory} onChange={(event) => setReportCategory(event.target.value)}><option value="harassment">Harcèlement</option><option value="spam">Spam</option><option value="impersonation">Usurpation d’identité</option><option value="inappropriate">Contenu inapproprié</option><option value="other">Autre</option></select></label><label>Détails facultatifs<textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={800} placeholder="Explique brièvement ce qui s’est passé…" /></label>{error && <p role="alert">{error}</p>}<footer><button type="button" onClick={() => setShowReport(false)}>Annuler</button><button type="submit" disabled={busy}>{busy ? "Envoi…" : "Envoyer le signalement"}</button></footer></form></div>}
    </section>
  );
}
export default PublicProfile;
