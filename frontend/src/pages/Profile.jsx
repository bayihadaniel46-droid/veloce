import {
  useEffect,
  useState
} from "react";

import {
  useAuth
} from "../context/AuthContext";
import { API_BASE_URL, API_ORIGIN } from "../config";


// ============================================================
// URL API
// ============================================================

const API_URL = API_BASE_URL;


// ============================================================
// COMPOSANT
// ============================================================

function Profile({ onOpenSettings }) {

  const {
    user,
    token,
    updateUser,
    logout
  } = useAuth();


  // ==========================================================
  // ÉTATS
  // ==========================================================

  const [
    posts,
    setPosts
  ] = useState([]);

  const [stats, setStats] = useState({ followersCount: 0, followingCount: 0 });

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    error,
    setError
  ] = useState("");

  const [
    editing,
    setEditing
  ] = useState(false);

  const [
    saving,
    setSaving
  ] = useState(false);

  const [
    form,
    setForm
  ] = useState({
    username: "",
    bio: "",
    avatar: ""
  });
  const [saveMessage, setSaveMessage] = useState("");
  const userId = user?.id || user?._id;


  // ==========================================================
  // CHARGER LES INFORMATIONS DU FORMULAIRE
  // ==========================================================

  useEffect(() => {

    if (!user) {
      return;
    }

    setForm({
      username:
        user.username || "",

      bio:
        user.bio || "",

      avatar:
        user.avatar || ""
    });

  }, [user]);


  // ==========================================================
  // CHARGER LES PUBLICATIONS
  // ==========================================================

  const loadPosts =
    async () => {

      if (!userId) {
        return;
      }

      try {

        setLoading(true);
        setError("");

        const response =
          await fetch(
            `${API_URL}/posts/user/${userId}`
          );

        const data =
          await response.json();

        if (!response.ok) {

          throw new Error(
            data.message ||
            "Impossible de charger les publications."
          );
        }

        setPosts(
          Array.isArray(data.posts)
            ? data.posts
            : []
        );

      } catch (err) {

        console.error(
          "Erreur profil :",
          err
        );

        setError(
          err.message
        );

      } finally {

        setLoading(false);
      }
    };


  useEffect(() => {
    loadPosts();
  }, [userId]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/users/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => { if (response.ok) setStats(data); })
      .catch((err) => console.error("Erreur statistiques profil :", err));
  }, [token]);


  // ==========================================================
  // MODIFIER LE FORMULAIRE
  // ==========================================================

  const handleChange =
    (event) => {

      const {
        name,
        value
      } = event.target;

      setSaveMessage("");

      setForm(
        previous => ({
          ...previous,
          [name]: value
        })
      );
    };


  // ==========================================================
  // SAUVEGARDER LE PROFIL
  // ==========================================================

  const handleSave =
    async (event) => {

      event.preventDefault();

      if (!token) {
        return;
      }

      try {

        setSaving(true);
        setError("");
        setSaveMessage("");

        const updatedProfile = {
          username: form.username.trim(),
          bio: form.bio.trim(),
          avatar: form.avatar.trim()
        };

        if (updatedProfile.avatar) {
          let avatarUrl;
          try {
            avatarUrl = new URL(updatedProfile.avatar, window.location.origin);
          } catch {
            throw new Error("L’adresse de la photo de profil n’est pas valide.");
          }
          if (!["http:", "https:"].includes(avatarUrl.protocol) && !updatedProfile.avatar.startsWith("data:image/")) {
            throw new Error("La photo doit utiliser une adresse HTTP ou HTTPS valide.");
          }
        }

        const response =
          await fetch(
            `${API_URL}/auth/profile`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`
              },

              body:
                JSON.stringify(updatedProfile)
            }
          );

        const data =
          await response.json();

        if (!response.ok) {

          throw new Error(
            data.message ||
            "Impossible de modifier le profil."
          );
        }

        updateUser(data.user);
        setForm({
          username: data.user.username || "",
          bio: data.user.bio || "",
          avatar: data.user.avatar || ""
        });

        setEditing(false);
        setSaveMessage("Profil mis à jour.");
        await loadPosts();

      } catch (err) {

        console.error(
          "Erreur modification profil :",
          err
        );

        setError(
          err.message
        );

      } finally {

        setSaving(false);
      }
    };


  // ==========================================================
  // ANNULER
  // ==========================================================

  const cancelEditing =
    () => {

      setForm({
        username:
          user?.username || "",

        bio:
          user?.bio || "",

        avatar:
          user?.avatar || ""
      });

      setEditing(false);
      setError("");
      setSaveMessage("");
    };


  // ==========================================================
  // PAS CONNECTÉ
  // ==========================================================

  if (!user) {

    return (
      <div className="empty-feed">

        <h2>
          Aucun utilisateur connecté
        </h2>

      </div>
    );
  }


  // ==========================================================
  // INITIALE
  // ==========================================================

  const initial =
    user.username
      ?.charAt(0)
      .toUpperCase() || "?";


  // ==========================================================
  // RENDU
  // ==========================================================

  return (

    <section className="profile-page">

      {/* ====================================================
          COUVERTURE
      ==================================================== */}

      <div className="profile-cover">
      </div>


      {/* ====================================================
          INFORMATIONS PRINCIPALES
      ==================================================== */}

      <div className="profile-main">

        <div className="profile-avatar">

          {user.avatar ? (

            <img
              src={user.avatar}
              alt={user.username}
            />

          ) : (

            <span>
              {initial}
            </span>

          )}

        </div>


        <div className="profile-information">

          <h1>
            {user.username}
          </h1>

          <p className="profile-handle">
            @{user.username}
          </p>

          <p className="profile-email">
            {user.email}
          </p>

          <p className="profile-bio">

            {user.bio
              ? user.bio
              : "Aucune biographie pour le moment."
            }

          </p>

        </div>


        <div className="profile-header-actions">
          <button type="button" className="profile-edit-button" onClick={() => setEditing(true)}>
            Modifier le profil
          </button>
          <button type="button" className="profile-settings-button" onClick={onOpenSettings}>
            ⚙ Paramètres
          </button>
          <button type="button" className="profile-logout-button" onClick={logout}>
            ⇥ Déconnexion
          </button>
        </div>

      </div>


      {/* ====================================================
          STATISTIQUES
      ==================================================== */}

      <div className="profile-stats">

        <div>

          <strong>
            {posts.length}
          </strong>

          <span>
            Publications
          </span>

        </div>


        <div>

          <strong>
            {stats.followersCount}
          </strong>

          <span>
            Abonnés
          </span>

        </div>


        <div>

          <strong>
            {stats.followingCount}
          </strong>

          <span>
            Abonnements
          </span>

        </div>

      </div>


      {/* ====================================================
          ERREUR
      ==================================================== */}

      {error && (

        <div className="profile-error">
          {error}
        </div>

      )}

      {saveMessage && <p className="profile-save-success" role="status">{saveMessage}</p>}


      {/* ====================================================
          MODIFICATION
      ==================================================== */}

      {editing && (

        <div className="profile-edit-card">

          <form
            onSubmit={handleSave}
          >

            <h2>
              Modifier mon profil
            </h2>


            <label>
              Nom d'utilisateur
            </label>

            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              minLength={3}
              maxLength={30}
              autoComplete="nickname"
              required
            />


            <label>
              Biographie
            </label>

            <textarea
              name="bio"
              value={form.bio}
              onChange={handleChange}
              maxLength={160}
              placeholder="Parle un peu de toi..."
            />


            <label>
              URL de l'avatar
            </label>

            <input
              type="text"
              name="avatar"
              value={form.avatar}
              onChange={handleChange}
              inputMode="url"
              maxLength={2048}
              placeholder="https://..."
            />

            {form.avatar && <img className="profile-edit-avatar-preview" src={form.avatar} alt="Aperçu de la photo de profil" />}
            <button type="button" className="profile-clear-avatar" onClick={() => setForm((current) => ({ ...current, avatar: "" }))}>Retirer la photo</button>


            <div className="profile-edit-actions">

              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Enregistrement..."
                  : "Enregistrer"
                }
              </button>

            </div>

          </form>

        </div>

      )}


      {/* ====================================================
          PUBLICATIONS
      ==================================================== */}

      <div className="profile-section">

        <div className="profile-section-header">

          <h2>
            Publications
          </h2>

          <span>
            {posts.length}
          </span>

        </div>


        {loading ? (

          <div className="profile-loading">
            Chargement des publications...
          </div>

        ) : posts.length === 0 ? (

          <div className="profile-empty-posts">

            <h3>
              Aucune publication
            </h3>

            <p>
              Tes publications apparaîtront ici.
            </p>

          </div>

        ) : (

          <div className="profile-posts">

            {posts.map(
              post => (

                <article
                  className="profile-post-card"
                  key={post._id}
                >

                  <div className="profile-post-header">

                    <div className="profile-post-author">

                      <div className="profile-post-avatar">

                        {post.author?.avatar ? (

                          <img
                            src={
                              post.author.avatar
                            }
                            alt={
                              post.author.username
                            }
                          />

                        ) : (

                          <span>
                            {(
                              post.author?.username ||
                              post.username ||
                              "?"
                            )
                              .charAt(0)
                              .toUpperCase()
                            }
                          </span>

                        )}

                      </div>


                      <div>

                        <strong>
                          {
                            post.author?.username ||
                            post.username
                          }
                        </strong>

                        <small>
                          {new Date(
                            post.createdAt
                          ).toLocaleString(
                            "fr-FR"
                          )}
                        </small>

                      </div>

                    </div>

                  </div>


                  {post.content && (

                    <p className="profile-post-content">
                      {post.content}
                    </p>

                  )}


                  {Array.isArray(
                    post.attachments
                  ) &&
                    post.attachments.length > 0 && (

                      <div className="profile-post-files">

                        {post.attachments.map(
                          file => (

                            <a
                              key={
                                file.fileId
                              }
                              href={
                                file.url.startsWith("http")
                                  ? file.url
                                  : `${API_ORIGIN}${file.url}`
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="profile-file"
                            >
                              📎 {file.originalName}
                            </a>

                          )
                        )}

                      </div>

                    )}


                  <div className="profile-post-stats">

                    <span>
                      ❤️ {post.likes || 0}
                    </span>

                    <span>
                      💬 {post.comments || 0}
                    </span>

                    <span>
                      🔄 {post.reposts || 0}
                    </span>

                  </div>

                </article>

              )
            )}

          </div>

        )}

      </div>

    </section>
  );
}


export default Profile;
