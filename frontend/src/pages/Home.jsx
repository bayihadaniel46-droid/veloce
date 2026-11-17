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
import AdminPanel from "./AdminPanel";
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

function FeedNavIcon({ type }) {
  const common = { viewBox: "0 0 48 48", fill: "none", "aria-hidden": true };
  switch (type) {
    case "posts":
      return <svg {...common}><path d="M14 11h22a3 3 0 0 1 3 3v22a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V14a3 3 0 0 1 3-3Z"/><path d="M17 20h16M17 26h13M17 32h9"/><path d="M8 34V11a3 3 0 0 1 3-3h22"/></svg>;
    case "carrefour":
      return <svg {...common}><path d="m24 5 19 19-19 19L5 24 24 5Z"/><circle cx="24" cy="24" r="5"/><path d="M24 8v11m0 10v11M8 24h11m10 0h11"/></svg>;
    case "videos":
      return <svg {...common}><rect x="6" y="10" width="36" height="28" rx="9"/><path d="m20 17 12 7-12 7V17Z"/><path d="M12 6v4m24-4v4M12 38v4m24-4v4"/></svg>;
    case "finance":
      return <svg {...common}><path d="M24 5 42 15v18L24 43 6 33V15L24 5Z"/><circle cx="24" cy="24" r="11"/><path d="M28 19.5c-.8-1-2-1.5-3.6-1.5-2 0-3.4 1-3.4 2.6 0 4 7.2 1.8 7.2 6.2 0 1.8-1.6 3.2-4 3.2-1.8 0-3.3-.6-4.2-1.8M24 15v18"/></svg>;
    default:
      return <svg {...common}><path d="M7 39h34M10 34l9-10 7 5 12-15"/><path d="M30 14h8v8"/><circle cx="10" cy="34" r="2"/><circle cx="19" cy="24" r="2"/><circle cx="26" cy="29" r="2"/><circle cx="38" cy="14" r="2"/></svg>;
  }
}


function Home() {

  const {
    token,
    user,
    logout,
    updateUser
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
  const [profileReturnPage, setProfileReturnPage] = useState("explorer");
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
  const [postDraft, setPostDraft] = useState("");

  useEffect(() => {
    if (!token) return undefined;
    const heartbeat = () => fetch(`${API_BASE_URL}/users/heartbeat`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).then(async (response) => {
      if (response.status !== 403) return;
      const result = await response.json().catch(() => ({}));
      if (result.code === "ACCOUNT_SUSPENDED" && result.account) updateUser({ ...user, ...result.account });
    }).catch(() => {});
    heartbeat();
    const timer = window.setInterval(heartbeat, 60000);
    return () => window.clearInterval(timer);
  }, [token, user, updateUser]);


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
    const openHome = () => setCurrentPage("home");
    const openUserProfile = (event) => {
      const id = event.detail?.userId;
      if (!id) return;
      setProfileReturnPage("explorer");
      setViewedUserId(id);
      setCurrentPage("user-profile");
    };
    window.addEventListener("veloce:navigate-profile", openProfile);
    window.addEventListener("veloce:navigate-market", openMarket);
    window.addEventListener("veloce:navigate-home", openHome);
    window.addEventListener("veloce:open-user-profile", openUserProfile);
    return () => {
      window.removeEventListener("veloce:navigate-profile", openProfile);
      window.removeEventListener("veloce:navigate-market", openMarket);
      window.removeEventListener("veloce:navigate-home", openHome);
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

  const openAdminUserProfile = useCallback((userId) => {
    if (!userId) return;
    setProfileReturnPage("admin");
    setViewedUserId(userId);
    setCurrentPage("user-profile");
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
      setPostDraft("");
      setShowModal(true);

    }, []);

  const shareGameScore = useCallback((content) => {
    setPostDraft(content);
    setCurrentPage("home");
    setFeedType("posts");
    setShowModal(true);
  }, []);


  const closeCreatePost =
    useCallback(() => {

      setShowModal(false);
      setPostDraft("");

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
        }).sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());

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
              {visiblePosts.map((post, index) => {
                const author = post.author && typeof post.author === "object" ? post.author : {};
                const name = post.username || author.username || "Membre";
                const avatar = author.avatar || post.avatar || "";
                const preview = (post.content || "Publication avec média").replace(/\s+/g, " ").trim();
                return <details className="single-post-fold" key={post._id || `post-${index}`}>
                  <summary className="single-post-fold-summary">
                    <span className="single-post-fold-avatar">{avatar ? <img src={avatar} alt="" /> : name.charAt(0).toUpperCase()}</span>
                    <span className="single-post-fold-copy">
                      <strong>{name}<time dateTime={post.createdAt || undefined}>{post.createdAt ? new Date(post.createdAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "Date indisponible"}</time></strong>
                      <span>{preview}</span>
                    </span>
                    <span className="single-post-fold-toggle"><span className="fold-open-label">Ouvrir</span><span className="fold-close-label">Réduire</span><b>⌄</b></span>
                  </summary>
                  <div className="single-post-fold-body"><PostCard post={post} onLike={handleLike} /></div>
              </details>
              })}

          </section>
        );
      }


      case "explorer":
        return <Explorer unreadNotifications={unreadNotifications} onUnreadCountChange={setUnreadNotifications} onOpenGames={() => setCurrentPage("games")} />;

      case "games":
        return <Games onBack={() => setCurrentPage("explorer")} onShareScore={shareGameScore} />;


      case "messages":
        return <Messages initialUser={messageRecipient} onInitialUserHandled={setMessageRecipient} initialClanId={messageClanId} onInitialClanHandled={setMessageClanId} onComposerStateChange={setMessageComposerActive} />;


      case "profile":
        return <Profile key="profile" onOpenSettings={() => setCurrentPage("settings")} />;

      case "piz-finance":
        return <Profile key="piz-finance" initialView="finance" onBack={() => setCurrentPage("home")} />;

      case "settings":
        return <Settings onBack={() => setCurrentPage("profile")} onOpenProfile={() => setCurrentPage("profile")} onOpenAdministration={() => setCurrentPage("admin")} onLogout={logout} />;

      case "admin":
        return <AdminPanel onBack={() => setCurrentPage("settings")} onOpenUserProfile={openAdminUserProfile} />;

      case "user-profile":
        return <PublicProfile userId={viewedUserId} onBack={() => { setCurrentPage(profileReturnPage); setProfileReturnPage("explorer"); const url = new URL(window.location.href); url.searchParams.delete("profile"); window.history.replaceState({}, "", url); }} onMessage={(person) => { setMessageRecipient(person); setCurrentPage("messages"); }} />;

      case "assistant":
        return <Assistant />;

      case "market":
        return <Market onBack={() => setCurrentPage("home")} />;

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
        {currentPage === "home" && <nav className="home-feed-switch" aria-label="Raccourcis principaux">
          {[
            { id: "posts", label: "Posts", active: feedType === "posts", action: () => { setCurrentPage("home"); setFeedType("posts"); } },
            { id: "carrefour", label: "Carrefour", active: currentPage === "carrefour", action: () => setCurrentPage("carrefour") },
            { id: "videos", label: "Vidéos", active: feedType === "videos", action: () => { setCurrentPage("home"); setFeedType("videos"); } },
            { id: "finance", label: "Compte PIZ", active: currentPage === "piz-finance", action: () => setCurrentPage("piz-finance") },
            { id: "market", label: "Tendances", active: currentPage === "market", action: () => setCurrentPage("market") },
          ].map((item) => <button key={item.id} type="button" className={`home-feed-icon-button home-feed-item-${item.id}${item.active ? " is-active" : ""}`} onClick={item.action} aria-label={item.label} aria-current={item.active ? "page" : undefined} title={item.label}>
            <span className="home-feed-icon-orbit"><FeedNavIcon type={item.id} /></span>
            <span className="home-feed-icon-label">{item.label}</span>
          </button>)}
        </nav>}
        {refreshingFeed && <div className="feed-refresh-status" role="status">Actualisation…</div>}
        {renderCurrentPage()}

      </main>

      <Rightbar />

      {currentPage !== "messages" && <FloatingButton
        onClick={openCreatePost}
        isRaised={messageComposerActive}
      />}

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
        initialContent={postDraft}
      />

    </div>
  );
}


export default Home;
