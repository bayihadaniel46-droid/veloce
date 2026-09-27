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
import Notifications from "./Notifications";
import Messages from "./Messages";
import Profile from "./Profile";
import Settings from "./Settings";
import PublicProfile from "./PublicProfile";
import Assistant from "./Assistant";

import FloatingButton from "../components/FloatingButton";
import MobileNavigation from "../components/MobileNavigation";
import CreatePostModal from "../components/CreatePostModal";

import {
  getPosts,
  toggleLike
} from "../services/postService";
import { getUnreadMessageCount } from "../services/messageService";
import { getUnreadNotificationCount } from "../services/notificationService";

import { useAuth } from "../context/authContext";


function Home() {

  const {
    token,
    user,
    logout
  } = useAuth();

  const [currentPage, setCurrentPage] =
    useState(() => {
      try {
        const userId = user?._id || user?.id || "account";
        const saved = JSON.parse(localStorage.getItem(`veloce_settings_${userId}`) || "{}");
        return ["home", "explorer", "assistant"].includes(saved.startPage) ? saved.startPage : "home";
      } catch {
        return "home";
      }
    });

  const [viewedUserId, setViewedUserId] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const [posts, setPosts] =
    useState([]);
  const likeRequests = useRef(new Set());

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [showModal, setShowModal] =
    useState(false);


  // ==========================================================
  // CHARGER LES POSTS
  // ==========================================================

  const loadPosts = useCallback(async () => {

    try {

      setLoading(true);
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
      if (messages.status === "fulfilled") setUnreadMessages(messages.value);
      if (notifications.status === "fulfilled") setUnreadNotifications(notifications.value);
    };
    refreshCounts();
    const timer = setInterval(refreshCounts, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [token]);

  useEffect(() => {

    const openProfile = () => setCurrentPage("profile");
    const openUserProfile = (event) => {
      const id = event.detail?.userId;
      if (!id) return;
      setViewedUserId(id);
      setCurrentPage("user-profile");
    };
    window.addEventListener("veloce:navigate-profile", openProfile);
    window.addEventListener("veloce:open-user-profile", openUserProfile);
    return () => {
      window.removeEventListener("veloce:navigate-profile", openProfile);
      window.removeEventListener("veloce:open-user-profile", openUserProfile);
    };

  }, []);

  // ==========================================================
  // NAVIGATION
  // ==========================================================

  const handleNavigation =
    useCallback((page) => {

      setCurrentPage(page);

    }, []);


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

      case "home":

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


        if (posts.length === 0) {

          return (
            <div className="empty-feed">

              <h2>
                Aucun post pour le moment
              </h2>

              <p>
                {user?.username
                  ? `${user.username}, sois le premier à publier quelque chose sur Veloce.`
                  : "Sois le premier à publier quelque chose sur Veloce."
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


        return (
          <section className="home-feed">

            {posts.map(
              (post, index) => (

                <PostCard
                  key={
                    post._id ||
                    `post-${index}`
                  }
                  post={post}
                  onLike={handleLike}
                />

              )
            )}

          </section>
        );


      case "explorer":
        return <Explorer />;


      case "notifications":
        return <Notifications />;


      case "messages":
        return <Messages />;


      case "profile":
        return <Profile onOpenSettings={() => setCurrentPage("settings")} />;

      case "settings":
        return <Settings onBack={() => setCurrentPage("profile")} onOpenProfile={() => setCurrentPage("profile")} onLogout={logout} />;

      case "user-profile":
        return <PublicProfile userId={viewedUserId} onBack={() => setCurrentPage("explorer")} />;

      case "assistant":
        return <Assistant />;


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

      <main className="feed">

        {renderCurrentPage()}

      </main>

      <Rightbar />

      <FloatingButton
        onClick={openCreatePost}
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
