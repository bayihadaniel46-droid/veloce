import { useEffect, useRef } from "react";
import PostCard from "./PostCard";

/** Vertical, scroll-snapped video feed. Only the mostly visible clip plays. */
function VideoFeed({ posts, onLike }) {
  const feedRef = useRef(null);

  useEffect(() => {
    const root = feedRef.current;
    if (!root) return undefined;

    const videos = Array.from(root.querySelectorAll("video"));
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
  }, [posts]);

  if (!posts.length) return null;

  return (
    <section className="video-feed" ref={feedRef} aria-label="Vidéos Veloce">
      {posts.map((post) => (
        <div className="video-feed-item" key={post._id}>
          <PostCard post={post} onLike={onLike} />
        </div>
      ))}
    </section>
  );
}

export default VideoFeed;
