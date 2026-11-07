import { useEffect, useMemo, useRef, useState } from "react";
import PostCard from "./PostCard";
import "./VideoFeed.css";

const loadFavorites = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
};

/** Flux vidéo avec lecture visible, favoris locaux et partage natif. */
function VideoFeed({ posts = [], onLike, viewerId = "guest" }) {
  const feedRef = useRef(null);
  const favoritesKey = `veloce_video_favorites_${viewerId || "guest"}`;
  const [favoriteIds, setFavoriteIds] = useState(() => loadFavorites(favoritesKey));
  const [showFavorites, setShowFavorites] = useState(false);

  useEffect(() => setFavoriteIds(loadFavorites(favoritesKey)), [favoritesKey]);
  useEffect(() => {
    try { localStorage.setItem(favoritesKey, JSON.stringify(favoriteIds)); }
    catch { /* Le flux continue de fonctionner si le stockage local est désactivé. */ }
  }, [favoriteIds, favoritesKey]);

  useEffect(() => {
    const root = feedRef.current;
    if (!root) return undefined;
    const videos = Array.from(root.querySelectorAll("video"));
    if (!("IntersectionObserver" in window)) return undefined;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
          video.muted = true;
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { root, threshold: [0, 0.35, 0.65, 0.9] });

    videos.forEach((video) => observer.observe(video));
    return () => {
      observer.disconnect();
      videos.forEach((video) => video.pause());
    };
  }, [posts, showFavorites, favoriteIds]);

  const visiblePosts = useMemo(() => showFavorites
    ? posts.filter((post) => favoriteIds.includes(String(post._id)))
    : posts, [favoriteIds, posts, showFavorites]);

  const toggleFavorite = (postId) => {
    const id = String(postId);
    setFavoriteIds((current) => current.includes(id)
      ? current.filter((favoriteId) => favoriteId !== id)
      : [...current, id]);
  };

  if (!posts.length) return null;

  return (
    <section className="video-feed" ref={feedRef} aria-label="Vidéos Veloce">
      <div className="video-feed-tools">
        <div><span>TON ESPACE VIDÉO</span><strong>Découvre et garde tes clips</strong></div>
        <div className="video-feed-tool-actions">
          <button type="button" className={!showFavorites ? "active" : ""} aria-pressed={!showFavorites} onClick={() => setShowFavorites(false)}>Toutes</button>
          <button type="button" className={showFavorites ? "active" : ""} aria-pressed={showFavorites} onClick={() => setShowFavorites(true)}>★ Favoris {favoriteIds.length || ""}</button>
        </div>
      </div>
      {visiblePosts.length === 0 ? <div className="video-feed-empty"><span>☆</span><strong>Aucune vidéo favorite pour le moment</strong><small>Appuie sur l’étoile d’un clip pour le retrouver ici.</small></div> : visiblePosts.map((post) => (
        <article className="video-feed-item" id={`video-post-${post._id}`} key={post._id}>
          <PostCard post={post} onLike={onLike} videoOverlay={<button type="button" className={`video-favorite-overlay${favoriteIds.includes(String(post._id)) ? " is-favorite" : ""}`} aria-pressed={favoriteIds.includes(String(post._id))} aria-label={favoriteIds.includes(String(post._id)) ? "Retirer des favoris" : "Ajouter aux favoris"} title={favoriteIds.includes(String(post._id)) ? "Retirer des favoris" : "Ajouter aux favoris"} onClick={() => toggleFavorite(post._id)}>{favoriteIds.includes(String(post._id)) ? "★" : "☆"}</button>} />
        </article>
      ))}
    </section>
  );
}

export default VideoFeed;
