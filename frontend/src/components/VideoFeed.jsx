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
  const [muted, setMuted] = useState(true);
  const [shareMessage, setShareMessage] = useState("");

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
          setMuted(true);
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

  const toggleSound = (item) => {
    const nextMuted = !muted;
    item.querySelectorAll("video").forEach((video) => { video.muted = nextMuted; });
    setMuted(nextMuted);
  };

  const sharePost = async (post) => {
    const author = post.author?.username || post.username || "un membre Veloce";
    const text = `${author} partage une vidéo sur Veloce${post.content ? ` : ${post.content}` : "."}`;
    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set("post", String(post._id));
    try {
      if (navigator.share) await navigator.share({ title: "Vidéo Veloce", text, url: shareUrl.toString() });
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${text} ${shareUrl.toString()}`);
        setShareMessage("Lien copié pour le partager.");
        window.setTimeout(() => setShareMessage(""), 2200);
      } else {
        setShareMessage("Le partage n’est pas disponible dans ce navigateur.");
        window.setTimeout(() => setShareMessage(""), 2600);
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        setShareMessage("Impossible de partager cette vidéo.");
        window.setTimeout(() => setShareMessage(""), 2600);
      }
    }
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
      {shareMessage && <p className="video-feed-status" role="status">{shareMessage}</p>}
      {visiblePosts.length === 0 ? <div className="video-feed-empty"><span>☆</span><strong>Aucune vidéo favorite pour le moment</strong><small>Appuie sur l’étoile d’un clip pour le retrouver ici.</small></div> : visiblePosts.map((post) => (
        <article className="video-feed-item" id={`video-post-${post._id}`} key={post._id}>
          <PostCard post={post} onLike={onLike} />
          <div className="video-feed-actions">
            <button type="button" className={favoriteIds.includes(String(post._id)) ? "is-favorite" : ""} aria-pressed={favoriteIds.includes(String(post._id))} onClick={() => toggleFavorite(post._id)}>{favoriteIds.includes(String(post._id)) ? "★ Enregistrée" : "☆ Ajouter aux favoris"}</button>
            <button type="button" onClick={(event) => toggleSound(event.currentTarget.closest(".video-feed-item"))}>{muted ? "🔇 Activer le son" : "🔊 Couper le son"}</button>
            <button type="button" onClick={() => void sharePost(post)}>↗ Partager</button>
          </div>
        </article>
      ))}
    </section>
  );
}

export default VideoFeed;
