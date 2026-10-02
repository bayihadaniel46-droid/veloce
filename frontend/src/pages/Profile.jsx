import {
  useEffect,
  useState
} from "react";

import {
  useAuth
} from "../context/authContext";
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
  const [showFinance, setShowFinance] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
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

  const handleAvatarUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    if (!file.type.startsWith("image/")) {
      setError("Choisis un fichier image valide.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("La photo ne doit pas dépasser 12 Mo.");
      return;
    }

    setError("");
    const reader = new FileReader();
    reader.onerror = () => setError("Impossible de lire cette image.");
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => setError("Impossible d’ouvrir cette image.");
      image.onload = () => {
        const scale = Math.min(1, 320 / image.width, 320 / image.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          setError("Impossible de préparer cette image.");
          return;
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        let quality = 0.8;
        let avatar = canvas.toDataURL("image/jpeg", quality);
        while (avatar.length > 180000 && quality > 0.4) {
          quality -= 0.08;
          avatar = canvas.toDataURL("image/jpeg", quality);
        }
        if (avatar.length > 200000) {
          setError("Cette photo reste trop volumineuse après compression.");
          return;
        }
        setForm((current) => ({ ...current, avatar }));
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
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

  if (showFinance) {
    const inviteLink = `${window.location.origin}/?ref=${encodeURIComponent(stats.referralCode || "")}`;
    const copyInvite = async () => {
      try { await navigator.clipboard.writeText(inviteLink); setInviteCopied(true); setTimeout(() => setInviteCopied(false), 2500); }
      catch { setError("La copie automatique a échoué. Sélectionne le lien puis copie-le."); }
    };
    const hours = Math.floor((stats.activeSeconds || 0) / 3600);
    const minutes = Math.floor(((stats.activeSeconds || 0) % 3600) / 60);
    return <section className="piz-page"><button className="piz-back" onClick={() => setShowFinance(false)}>← Retour au profil</button><header className="piz-hero"><span className="piz-eyebrow">COMPTE FINANCES · VIRTUALISÉ</span><h1>Mon compte PIZ</h1><p>Accumule des points PIZ grâce à ta participation sur Veloce.</p><div className="piz-balance-card"><span>Solde de points estimé</span><strong>{Number(stats.pizBalance || 0).toFixed(2)} <small>PIZ</small></strong><p>Compteur de récompenses interne — PIZ n’est pas encore un actif transférable et n’a pas de valeur monétaire garantie.</p><div className="piz-progress"><i style={{ width: `${Math.round(((stats.pizBalance || 0) % 10) * 10)}%` }} /></div><small>{(10 - ((stats.pizBalance || 0) % 10)).toFixed(2)} PIZ jusqu’au prochain palier indicatif</small></div></header>
      <div className="piz-actions"><article><span>↙</span><div><strong>Dépôt</strong><small>Fonction bientôt disponible</small></div><button disabled title="Cette fonction sera ajoutée ultérieurement">Bientôt</button></article><article><span>↗</span><div><strong>Retrait</strong><small>Fonction bientôt disponible</small></div><button disabled title="Cette fonction sera ajoutée ultérieurement">Bientôt</button></article></div>
      <section className="piz-section"><div className="piz-section-title"><div><span>COMMENT LES POINTS ÉVOLUENT</span><h2>Ta participation</h2></div><span className="piz-live">● Mise à jour régulière</span></div><div className="piz-stats-grid"><article><span>⏱</span><strong>{hours} h {minutes} min</strong><small>Temps actif dans Veloce · 0,5 PIZ / heure</small></article><article><span>✍</span><strong>{stats.postsCount || 0}</strong><small>Publications · 2 PIZ chacune</small></article><article><span>♡</span><strong>{stats.likesCount || 0} · {stats.commentsCount || 0}</strong><small>J’aime et commentaires · 0,1 / 0,5 PIZ</small></article><article><span>✉</span><strong>{stats.messagesCount || 0}</strong><small>Messages envoyés · 0,1 PIZ chacun</small></article><article><span>♧</span><strong>{stats.clansManagedCount || 0}</strong><small>Clans dirigés · 10 PIZ chacun</small></article><article><span>＋</span><strong>{stats.referralsCount || 0}</strong><small>Comptes inscrits avec ton lien · 25 PIZ chacun</small></article></div><p className="piz-rules-note">Le compteur est calculé selon ces règles d’activité. Le temps est comptabilisé pendant une session ouverte, avec une limite entre les signaux d’activité. Ces points ne sont ni une promesse de rendement, ni des jetons retirable.</p></section>
      <section className="piz-section piz-invite"><div><span>FAIS GRANDIR VELOCE</span><h2>Invite tes proches</h2><p>Chaque compte créé depuis ton lien est associé à ton profil.</p></div><div className="piz-link-row"><input readOnly value={inviteLink} aria-label="Lien d’invitation personnel" /><button onClick={copyInvite}>{inviteCopied ? "Lien copié ✓" : "Copier le lien"}</button></div><small>Code personnel : {stats.referralCode || "Préparation…"}</small></section>
    </section>;
  }


  // ==========================================================
  // INITIALE
  // ==========================================================

  const initial =
    user.username
      ?.charAt(0)
      .toUpperCase() || "?";

  if (editing) {
    return (
      <section className="profile-edit-page">
        <button type="button" className="profile-edit-back" onClick={cancelEditing} disabled={saving}>
          ← Retour au profil
        </button>
        <header className="profile-edit-heading">
          <span>COMPTE PERSONNEL</span>
          <h1>Informations du compte</h1>
          <p>Gère les informations visibles sur ton profil Veloce.</p>
        </header>

        <form className="profile-edit-form" onSubmit={handleSave}>
          <section className="profile-edit-section">
            <h2>Photo de profil</h2>
            <p>Choisis une image carrée ou portrait. Elle sera automatiquement recadrée et compressée.</p>
            <div className="profile-edit-photo-row">
              <div className="profile-edit-photo-preview">
                {form.avatar ? <img src={form.avatar} alt="Aperçu de la photo de profil" /> : <span>{form.username?.charAt(0).toUpperCase() || "?"}</span>}
              </div>
              <div className="profile-edit-photo-actions">
                <label className="profile-edit-upload" htmlFor="profile-avatar-file">Choisir une photo</label>
                <input id="profile-avatar-file" className="profile-edit-file" type="file" accept="image/*" onChange={handleAvatarUpload} />
                {form.avatar && <button type="button" className="profile-clear-avatar" onClick={() => setForm((current) => ({ ...current, avatar: "" }))}>Retirer la photo</button>}
                <small>JPG, PNG, WebP ou GIF · 12 Mo maximum</small>
              </div>
            </div>
          </section>

          <section className="profile-edit-section">
            <h2>Informations du compte</h2>
            <label htmlFor="profile-edit-username">Nom d’utilisateur</label>
            <input id="profile-edit-username" type="text" name="username" value={form.username} onChange={handleChange} minLength={3} maxLength={30} autoComplete="nickname" required />
            <label htmlFor="profile-edit-email">Adresse e-mail</label>
            <input id="profile-edit-email" type="email" value={user.email || ""} readOnly />
            <small>L’adresse e-mail ne peut pas être modifiée depuis cette page.</small>
            <label htmlFor="profile-edit-created">Membre depuis</label>
            <input id="profile-edit-created" type="text" value={user.createdAt ? new Date(user.createdAt).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" }) : "Date indisponible"} readOnly />
            <label htmlFor="profile-edit-bio">Biographie</label>
            <textarea id="profile-edit-bio" name="bio" value={form.bio} onChange={handleChange} maxLength={160} placeholder="Parle un peu de toi…" />
            <small className="profile-edit-character-count">{form.bio.length}/160 caractères</small>
          </section>

          {error && <p className="profile-error" role="alert">{error}</p>}
          {saveMessage && <p className="profile-save-success" role="status">{saveMessage}</p>}
          <div className="profile-edit-page-actions">
            <button type="button" onClick={cancelEditing} disabled={saving}>Annuler</button>
            <button type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer les modifications"}</button>
          </div>
        </form>
      </section>
    );
  }


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
          <button type="button" className="profile-finance-button" onClick={() => setShowFinance(true)}>◈ Compte finances · PIZ</button>
          <button type="button" className="profile-market-button" onClick={() => window.dispatchEvent(new Event("veloce:navigate-market"))}>
            ↗ Tendances du marché
          </button>
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
