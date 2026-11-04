import { useEffect, useState } from "react";
import { useAuth } from "../context/authContext";
import { disablePushNotifications, enablePushNotifications, getPushStatus } from "../services/pushService";
import "./Settings.css";

const getStorageKey = (user) => `veloce_settings_${user?._id || user?.id || "account"}`;
const defaults = { density: "comfortable", reduceMotion: false, startPage: "home", showBadges: true };

function readSettings(user) {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(getStorageKey(user)) || "{}") };
  } catch {
    return defaults;
  }
}

function applySettings(settings) {
  const root = document.documentElement;
  root.dataset.veloceDensity = settings.density;
  root.dataset.veloceMotion = settings.reduceMotion ? "reduced" : "full";
  root.dataset.veloceBadges = settings.showBadges ? "visible" : "hidden";
}

function Settings({ onBack, onLogout, onOpenProfile }) {
  const { user, token } = useAuth();
  const [settings, setSettings] = useState(() => readSettings(user));
  const [pushStatus, setPushStatus] = useState({ supported: true, permission: "checking", subscribed: false });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState("");

  useEffect(() => {
    applySettings(settings);
    localStorage.setItem(getStorageKey(user), JSON.stringify(settings));
  }, [settings, user]);

  useEffect(() => {
    let active = true;
    getPushStatus().then((status) => { if (active) setPushStatus(status); })
      .catch(() => { if (active) setPushStatus({ supported: false, permission: "unsupported", subscribed: false }); });
    return () => { active = false; };
  }, []);

  const update = (key, value) => setSettings((current) => ({ ...current, [key]: value }));

  const togglePushNotifications = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    setPushMessage("");
    try {
      if (pushStatus.subscribed) {
        await disablePushNotifications(token);
        setPushMessage("Les notifications sont désactivées sur cet appareil.");
      } else {
        await enablePushNotifications(token);
        setPushMessage("Les notifications de messages sont activées sur cet appareil.");
      }
      setPushStatus(await getPushStatus());
    } catch (error) {
      setPushMessage(error.message || "Impossible de modifier les notifications.");
      setPushStatus(await getPushStatus().catch(() => pushStatus));
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <section className="settings-page">
      <header className="settings-page-header">
        <button type="button" className="settings-back-button" onClick={onBack} aria-label="Retour au profil">←</button>
        <div>
          <span className="settings-eyebrow">VOTRE ESPACE</span>
          <h1>Paramètres</h1>
          <p>Personnalisez votre expérience sur Veloce.</p>
        </div>
      </header>

      <div className="settings-layout">
        <aside className="settings-summary">
          <div className="settings-avatar">{user?.avatar ? <img src={user.avatar} alt="" /> : (user?.username?.charAt(0).toUpperCase() || "V")}</div>
          <strong>{user?.username || "Mon compte"}</strong>
          <span>{user?.email || "Compte Veloce"}</span>
          <button type="button" onClick={onOpenProfile}>Gérer mon profil</button>
        </aside>

        <div className="settings-sections">
          <section className="settings-card">
            <div className="settings-card-heading"><span className="settings-card-icon">◉</span><div><h2>Votre compte</h2><p>Les informations associées à votre session.</p></div></div>
            <div className="settings-account-row"><span>Nom d’utilisateur</span><strong>@{user?.username || "—"}</strong></div>
            <div className="settings-account-row"><span>Adresse e-mail</span><strong>{user?.email || "—"}</strong></div>
            <div className="settings-account-row"><span>État de la session</span><strong className="settings-session-state"><i /> Connectée</strong></div>
          </section>

          <section className="settings-card">
            <div className="settings-card-heading"><span className="settings-card-icon">✧</span><div><h2>Affichage et confort</h2><p>Adaptez l’interface à votre façon de consulter le fil.</p></div></div>
            <label className="settings-select-row"><span><strong>Densité du fil</strong><small>Choisissez l’espace entre les publications.</small></span><select value={settings.density} onChange={(event) => update("density", event.target.value)}><option value="comfortable">Confortable</option><option value="compact">Compact</option></select></label>
            <label className="settings-select-row"><span><strong>Page au démarrage</strong><small>Page affichée après votre connexion.</small></span><select value={settings.startPage} onChange={(event) => update("startPage", event.target.value)}><option value="home">Accueil</option><option value="explorer">Explorer</option><option value="assistant">Assistant IA</option></select></label>
            <label className="settings-toggle-row"><span><strong>Réduire les animations</strong><small>Privilégiez une interface plus stable et accessible.</small></span><input type="checkbox" checked={settings.reduceMotion} onChange={(event) => update("reduceMotion", event.target.checked)} /><i aria-hidden="true" /></label>
          </section>

          <section className="settings-card">
            <div className="settings-card-heading"><span className="settings-card-icon">♧</span><div><h2>Notifications</h2><p>Gardez les compteurs de nouveaux éléments à portée de vue.</p></div></div>
            <label className="settings-toggle-row"><span><strong>Pastilles de notification</strong><small>Afficher les compteurs sur les raccourcis et la navigation.</small></span><input type="checkbox" checked={settings.showBadges} onChange={(event) => update("showBadges", event.target.checked)} /><i aria-hidden="true" /></label>
            <div className="settings-push-row">
              <div><strong>Messages même lorsque Veloce est fermé</strong><small>{!pushStatus.supported ? "Ce navigateur ne prend pas en charge les notifications Push." : pushStatus.permission === "denied" ? "Les notifications sont bloquées dans les réglages de ce navigateur." : pushStatus.subscribed ? "Cet appareil recevra les notifications de nouveaux messages." : "Autorise les notifications pour être averti des nouveaux messages."}</small></div>
              <button type="button" className="settings-push-button" disabled={!pushStatus.supported || pushBusy || pushStatus.permission === "denied"} onClick={togglePushNotifications}>
                {pushBusy ? "Mise à jour…" : pushStatus.subscribed ? "Désactiver" : "Activer"}
              </button>
              {pushMessage && <p className="settings-push-feedback" role="status">{pushMessage}</p>}
            </div>
          </section>

          <section className="settings-card settings-session-card">
            <div className="settings-card-heading"><span className="settings-card-icon">⇥</span><div><h2>Session</h2><p>Déconnectez-vous de cet appareil.</p></div></div>
            <button type="button" className="settings-logout-button" onClick={onLogout}>Se déconnecter</button>
          </section>
          <p className="settings-saved-note">Vos préférences sont enregistrées automatiquement sur cet appareil.</p>
        </div>
      </div>
    </section>
  );
}

export default Settings;
