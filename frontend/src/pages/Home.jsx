import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import Sidebar from "../components/Sidebar";
import Rightbar from "../components/Rightbar";
import PostCard from "../components/PostCard";

import Explorer from "./Explorer";
import Messages from "./Messages";
import Profile from "./Profile";
import Settings from "./Settings";
import PublicProfile from "./PublicProfile";
import Assistant from "./Assistant";
import Market from "./Market";
import Carrefour from "./Carrefour";
import Games from "./Games";
import "./MessagesEmojiFavorites.css";
import "../home-enhancements.css";

import FloatingButton from "../components/FloatingButton";
import MobileNavigation from "../components/MobileNavigation";
import CreatePostModal from "../components/CreatePostModal";
import VideoFeed from "../components/VideoFeed";

import {
  getPosts,
  toggleLike
} from "../services/postService";
import { getUnreadMessageCount } from "../services/messageService";
import { getUnreadNotificationCount } from "../services/notificationService";
import { API_BASE_URL } from "../config";
import { playUiSound } from "../services/soundService";

import { useAuth } from "../context/authContext";


function Home() {

  const {
    token,
    user,
    logout
  } = useAuth();

  const [currentPage, setCurrentPage] =
    useState(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.has("profile")) return "user-profile";
      if (params.has("contact") || params.get("page") === "messages") return "messages";
      if (params.has("post")) return "home";
      try {
        const userId = user?._id || user?.id || "account";
        const saved = JSON.parse(localStorage.getItem(`veloce_settings_${userId}`) || "{}");
        return ["home", "explorer", "assistant"].includes(saved.startPage) ? saved.startPage : "home";
      } catch {
        return "home";
      }
    });

  const [viewedUserId, setViewedUserId] = useState(() => new URLSearchParams(window.location.search).get("profile") || "");
  const [messageRecipient, setMessageRecipient] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const contact = params.get("contact");
    return contact ? { _id: contact, username: params.get("username") || "Contact" } : null;
  });
  const [messageClanId, setMessageClanId] = useState(() => new URLSearchParams(window.location.search).get("clan") || null);
  const [messageComposerActive, setMessageComposerActive] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [feedType, setFeedType] = useState(() => new URLSearchParams(window.location.search).has("post") ? "videos" : "posts");
  const [refreshingFeed, setRefreshingFeed] = useState(false);
  const feedTouchStart = useRef(null);
  const lastUnreadMessageCount = useRef(null);

  useEffect(() => {
    const playForInteractiveControl = (event) => {
      const control = event.target.closest?.("button, a, [role='button']");
      if (!control || control.disabled || control.getAttribute("aria-disabled") === "true") return;
      const sound = control.dataset.uiSound;
      if (sound === "silent") return;
      playUiSound(sound || "click");
    };
    document.addEventListener("click", playForInteractiveControl);
    return () => document.removeEventListener("click", playForInteractiveControl);
  }, []);

  const [posts, setPosts] =
    useState([]);
  const likeRequests = useRef(new Set());

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [showModal, setShowModal] =
    useState(false);

  useEffect(() => {
    if (!token) return undefined;
    const heartbeat = () => fetch(`${API_BASE_URL}/users/heartbeat`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    heartbeat();
    const timer = window.setInterval(heartbeat, 60000);
    return () => window.clearInterval(timer);
  }, [token]);


  // ==========================================================
  // CHARGER LES POSTS
  // ==========================================================

  const loadPosts = useCallback(async ({ silent = false } = {}) => {

    try {

      if (!silent) setLoading(true);
      setError("");

      const data =
        await getPosts({ token });

      setPosts(
        Array.isArray(data)
          ? data
          : []
      );

    } catch (error) {

      console.error(
        "Erreur chargement posts :",
        error
      );

      setError(
        error.message ||
        "Impossible de charger les publications."
      );

    } finally {

      setLoading(false);

    }

  }, [token]);


  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    const postId = new URLSearchParams(window.location.search).get("post");
    if (!postId || !posts.some((post) => String(post._id) === postId && post.attachments?.some((file) => file.mimetype?.startsWith("video/")))) return;
    const frame = window.requestAnimationFrame(() => document.getElementById(`video-post-${postId}`)?.scrollIntoView({ block: "start", behavior: "smooth" }));
    return () => window.cancelAnimationFrame(frame);
  }, [posts]);

  useEffect(() => {
    try {
      const userId = user?._id || user?.id || "account";
      const saved = JSON.parse(localStorage.getItem(`veloce_settings_${userId}`) || "{}");
      const root = document.documentElement;
      root.dataset.veloceDensity = saved.density === "compact" ? "compact" : "comfortable";
      root.dataset.veloceMotion = saved.reduceMotion ? "reduced" : "full";
      root.dataset.veloceBadges = saved.showBadges === false ? "hidden" : "visible";
    } catch {
      // Les valeurs par défaut restent appliquées si les préférences sont illisibles.
    }
  }, [user]);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    const refreshCounts = async () => {
      const [messages, notifications] = await Promise.allSettled([
        getUnreadMessageCount(token),
        getUnreadNotificationCount(token)
      ]);
      if (!active) return;
      if (messages.status === "fulfilled") {
        const nextUnreadCount = Number(messages.value) || 0;
        if (lastUnreadMessageCount.current !== null
          && nextUnreadCount > lastUnreadMessageCount.current
          && currentPage !== "messages"
          && document.visibilityState === "visible") {
          playUiSound("message");
        }
        lastUnreadMessageCount.current = nextUnreadCount;
        setUnreadMessages(nextUnreadCount);
      }
      if (notifications.status === "fulfilled") setUnreadNotifications(notifications.value);
    };
    refreshCounts();
    const timer = setInterval(refreshCounts, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [token, currentPage]);

  useEffect(() => {
    const refreshNotificationBadge = async () => {
      if (!token) return;
      try {
        setUnreadNotifications(await getUnreadNotificationCount(token));
      } catch {
        // Le compteur conserve sa dernière valeur si le réseau est indisponible.
      }
    };
    window.addEventListener("veloce:notifications-updated", refreshNotificationBadge);
    return () => window.removeEventListener("veloce:notifications-updated", refreshNotificationBadge);
  }, [token]);

  useEffect(() => {

    const openProfile = () => setCurrentPage("profile");
    const openMarket = () => setCurrentPage("market");
    const openUserProfile = (event) => {
      const id = event.detail?.userId;
      if (!id) return;
      setViewedUserId(id);
      setCurrentPage("user-profile");
    };
    window.addEventListener("veloce:navigate-profile", openProfile);
    window.addEventListener("veloce:navigate-market", openMarket);
    window.addEventListener("veloce:open-user-profile", openUserProfile);
    return () => {
      window.removeEventListener("veloce:navigate-profile", openProfile);
      window.removeEventListener("veloce:navigate-market", openMarket);
      window.removeEventListener("veloce:open-user-profile", openUserProfile);
    };

  }, []);

  // ==========================================================
  // NAVIGATION
  // ==========================================================

  const handleNavigation =
    useCallback((page) => {

      setMessageComposerActive(false);
      setCurrentPage(page);

    }, []);

  const startFeedTouch = (event) => {
    const main = event.currentTarget;
    if (currentPage === "home" && main.scrollTop <= 0 && event.touches.length === 1) {
      feedTouchStart.current = event.touches[0].clientY;
    } else {
      feedTouchStart.current = null;
    }
  };

  const finishFeedTouch = async (event) => {
    if (feedTouchStart.current === null) return;
    const distance = event.changedTouches[0].clientY - feedTouchStart.current;
    feedTouchStart.current = null;
    if (distance < 75 || refreshingFeed || loading) return;
    playUiSound("refresh");
    setRefreshingFeed(true);
    try {
      await loadPosts({ silent: true });
    } finally {
      setRefreshingFeed(false);
    }
  };


  // ==========================================================
  // MODAL CREATION
  // ==========================================================

  const openCreatePost =
    useCallback(() => {

      setShowModal(true);

    }, []);


  const closeCreatePost =
    useCallback(() => {

      setShowModal(false);

    }, []);


  // ==========================================================
  // AJOUTER LE NOUVEAU POST
  // ==========================================================

  const addPost =
    useCallback((newPost) => {

      setPosts((previousPosts) => [
        newPost,
        ...previousPosts
      ]);

      setCurrentPage("home");

    }, []);


  // ==========================================================
  // LIKE
  // ==========================================================

  const handleLike =
    useCallback(
      async (postId) => {

        if (!token || likeRequests.current.has(postId)) {
          return;
        }

        const originalPost = posts.find((post) => post._id === postId);
        if (!originalPost) return;

        const wasLiked = Boolean(originalPost.likedByCurrentUser);
        const originalLikes = Number(originalPost.likes) || 0;
        likeRequests.current.add(postId);
        setPosts((currentPosts) => currentPosts.map((post) =>
          post._id === postId
            ? {
                ...post,
                likes: Math.max(0, originalLikes + (wasLiked ? -1 : 1)),
                likedByCurrentUser: !wasLiked
              }
            : post
        ));

        try {

          const data =
            await toggleLike({
              postId,
              token
            });

          setPosts((currentPosts) => currentPosts.map((post) =>
            post._id === postId
              ? {
                  ...post,
                  likes: Number(data.post?.likes ?? post.likes) || 0,
                  likedByCurrentUser: Boolean(data.liked)
                }
              : post
          ));

        } catch (error) {

          setPosts((currentPosts) => currentPosts.map((post) =>
            post._id === postId
              ? {
                  ...post,
                  likes: originalLikes,
                  likedByCurrentUser: wasLiked
                }
              : post
          ));

          console.error(
            "Erreur like :",
            error
          );

        }

        likeRequests.current.delete(postId);

      },
      [token, posts]
    );


  // ==========================================================
  // PAGE COURANTE
  // ==========================================================

  const renderCurrentPage = () => {

    switch (currentPage) {

      case "home": {

        const visiblePosts = posts.filter((post) => {
          const hasVideo = Array.isArray(post.attachments) && post.attachments.some((file) => file.mimetype?.startsWith("video/"));
          return feedType === "videos" ? hasVideo : !hasVideo;
        });
        const authorStacks = new Map();
        if (feedType === "posts") {
          visiblePosts.forEach((post, index) => {
            const author = post.author && typeof post.author === "object" ? post.author : {};
            const authorId = String(author._id || (typeof post.author === "string" ? post.author : "") || post.username || post._id || `post-${index}`);
            if (!authorStacks.has(authorId)) {
              authorStacks.set(authorId, {
                id: authorId,
                name: post.username || author.username || "Membre",
                avatar: author.avatar || post.avatar || "",
                posts: [],
              });
            }
            authorStacks.get(authorId).posts.push(post);
          });
        }

        if (loading) {

          return (
            <div className="loading">
              <p>
                Chargement des publications...
              </p>
            </div>
          );

        }


        if (error) {

          return (
            <div className="error-message">

              <h2>
                Impossible de charger les posts
              </h2>

              <p>
                {error}
              </p>

              <button
                onClick={loadPosts}
                className="empty-feed-button"
              >
                Réessayer
              </button>

            </div>
          );

        }


        if (visiblePosts.length === 0) {

          return (
            <div className="empty-feed">

              <h2>{feedType === "videos" ? "Aucune vidéo pour le moment" : "Aucun post pour le moment"}</h2>

              <p>
                {user?.username
                  ? `${user.username}, ${feedType === "videos" ? "découvre bientôt les vidéos publiées sur Veloce." : "sois le premier à publier quelque chose sur Veloce."}`
                  : feedType === "videos" ? "Les vidéos publiées apparaîtront ici." : "Sois le premier à publier quelque chose sur Veloce."
                }
              </p>

              <button
                onClick={openCreatePost}
                className="empty-feed-button"
              >
                Créer une publication
              </button>

            </div>
          );

        }


        return feedType === "videos" ? (
          <VideoFeed posts={visiblePosts} onLike={handleLike} viewerId={user?._id || user?.id || "guest"} />
        ) : (
          <section className="home-feed">
            {[...authorStacks.values()].map((stack) => (
              <details className="author-publication-stack" key={stack.id}>
                <summary className="author-publication-stack-summary">
                  <span className="publication-stack-avatar">{stack.avatar ? <img src={stack.avatar} alt="" /> : stack.name.charAt(0).toUpperCase()}</span>
                  <span className="publication-stack-copy">
                    <strong>{stack.name}</strong>
                    <span>{stack.posts.length} publication{stack.posts.length === 1 ? "" : "s"} · {stack.posts[0]?.content || "Contenu photo ou vidéo"}</span>
                  </span>
                  <span className="publication-stack-toggle">Ouvrir <b>⌄</b></span>
                </summary>
                <div className="author-publication-stack-list">
                  {stack.posts.map((post, index) => (
                    <PostCard key={post._id || `${stack.id}-post-${index}`} post={post} onLike={handleLike} />
                  ))}
                </div>
              </details>
            ))}

          </section>
        );
      }


      case "explorer":
        return <Explorer unreadNotifications={unreadNotifications} onUnreadCountChange={setUnreadNotifications} onOpenGames={() => setCurrentPage("games")} />;

      case "games":
        return <Games onBack={() => setCurrentPage("explorer")} />;


      case "messages":
        return <Messages initialUser={messageRecipient} onInitialUserHandled={setMessageRecipient} initialClanId={messageClanId} onInitialClanHandled={setMessageClanId} onComposerStateChange={setMessageComposerActive} />;


      case "profile":
        return <Profile onOpenSettings={() => setCurrentPage("settings")} />;

      case "settings":
        return <Settings onBack={() => setCurrentPage("profile")} onOpenProfile={() => setCurrentPage("profile")} onLogout={logout} />;

      case "user-profile":
        return <PublicProfile userId={viewedUserId} onBack={() => { setCurrentPage("explorer"); const url = new URL(window.location.href); url.searchParams.delete("profile"); window.history.replaceState({}, "", url); }} onMessage={(person) => { setMessageRecipient(person); setCurrentPage("messages"); }} />;

      case "assistant":
        return <Assistant />;

      case "market":
        return <Market />;

      case "carrefour":
        return <Carrefour onBack={() => setCurrentPage("home")} />;


      default:

        return (
          <div className="empty-feed">

            <h2>
              Page introuvable
            </h2>

            <button
              onClick={() =>
                handleNavigation("home")
              }
              className="empty-feed-button"
            >
              Retour à l'accueil
            </button>

          </div>
        );
    }
  };


  return (
    <div className="layout">

      <Sidebar
        setCurrentPage={handleNavigation}
        unreadMessages={unreadMessages}
        unreadNotifications={unreadNotifications}
      />

      <main className="feed" onTouchStart={startFeedTouch} onTouchEnd={finishFeedTouch}>
        {currentPage === "home" && <div className="home-feed-switch" role="tablist" aria-label="Type de publications">
          <button type="button" role="tab" aria-selected={feedType === "videos"} className={feedType === "videos" ? "is-active" : ""} onClick={() => setFeedType("videos")}>▶ Vidéos</button>
          <button type="button" className="home-feed-carrefour" aria-label="Ouvrir le Carrefour Veloce" onClick={() => setCurrentPage("carrefour")}>◈<small>Carrefour</small></button>
          <button type="button" role="tab" aria-selected={feedType === "posts"} className={feedType === "posts" ? "is-active" : ""} onClick={() => setFeedType("posts")}>▤ Posts</button>
        </div>}
        {refreshingFeed && <div className="feed-refresh-status" role="status">Actualisation…</div>}
        {renderCurrentPage()}

      </main>

      <Rightbar />

      <FloatingButton
        onClick={openCreatePost}
        isRaised={messageComposerActive}
      />

      <MobileNavigation
        currentPage={currentPage}
        setCurrentPage={handleNavigation}
        unreadMessages={unreadMessages}
        unreadNotifications={unreadNotifications}
        onCreatePost={openCreatePost}
      />

      <CreatePostModal
        isOpen={showModal}
        onClose={closeCreatePost}
        onAddPost={addPost}
      />

    </div>
  );
}


export default Home;
