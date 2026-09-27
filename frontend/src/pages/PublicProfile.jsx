import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/authContext";
import PostCard from "../components/PostCard";
import { API_BASE_URL } from "../config";

const API = API_BASE_URL;
function PublicProfile({ userId, onBack }) {
  const { token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
        <button className="profile-edit-button" onClick={toggleFollow} disabled={busy}>
          {busy ? "…" : profile.isFollowing ? "Abonné(e)" : "S’abonner"}
        </button>
      </div>
      <div className="profile-stats">
        <div><strong>{posts.length}</strong><span>Publications</span></div>
        <div><strong>{profile.stats.followersCount}</strong><span>Abonnés</span></div>
        <div><strong>{profile.stats.followingCount}</strong><span>Abonnements</span></div>
      </div>
      <div className="public-profile-posts">
        <h2>Publications de {person.username}</h2>
        {posts.length ? posts.map((post) => <PostCard key={post._id} post={post} />) : <p className="empty-feed">Aucune publication pour le moment.</p>}
      </div>
    </section>
  );
}
export default PublicProfile;
