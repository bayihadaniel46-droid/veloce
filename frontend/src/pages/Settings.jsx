import { useEffect, useState } from "react";
import { useAuth } from "../context/authContext";
import { disablePushNotifications, enablePushNotifications, getPushStatus } from "../services/pushService";
import { acceptCommunityRules, deleteMyVeloceAccount, getCommunityRulesStatus, getModerationQueue, reviewContentReport } from "../services/userService";
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
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [accountDeleteError, setAccountDeleteError] = useState("");
  const [moderationReports, setModerationReports] = useState(null);
  const [moderationBusyId, setModerationBusyId] = useState("");
  const [moderationError, setModerationError] = useState("");
  const [rulesAccepted, setRulesAccepted] = useState(true);
  const [rulesBusy, setRulesBusy] = useState(false);
  const [rulesError, setRulesError] = useState("");

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

  useEffect(() => {
    let active = true;
    getModerationQueue(token).then((reports) => {
      if (active) setModerationReports(reports);
    }).catch((error) => {
      if (active && !/équipe de modération/i.test(error.message || "")) setModerationError(error.message);
    });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    let active = true;
    getCommunityRulesStatus(token).then((status) => {
      if (active) setRulesAccepted(Boolean(status.accepted));
    }).catch((error) => {
      if (active) setRulesError(error.message || "Impossible de vérifier les règles.");
    });
    return () => { active = false; };
  }, [token]);

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

  const deleteAccount = async () => {
    if (!window.confirm("Supprimer définitivement ton compte Veloce, tes publications, messages, médias et ton solde Piz Veloce ? Cette action ne peut pas être annulée. Un éventuel compte externe Piz n’est pas supprimé ici.")) return;
    if (window.prompt("Pour confirmer, tape SUPPRIMER en majuscules.") !== "SUPPRIMER") return;
    setDeletingAccount(true);
    setAccountDeleteError("");
    try {
      await deleteMyVeloceAccount(token);
      localStorage.removeItem(getStorageKey(user));
      onLogout();
    } catch (error) {
      setAccountDeleteError(error.message || "La suppression n’a pas abouti.");
    } finally {
      setDeletingAccount(false);
    }
  };

  const decideReport = async (report, action, status = "resolved") => {
    if (action === "remove" && !window.confirm("Retirer ce contenu de Veloce ? Cette action est définitive.")) return;
    setModerationBusyId(String(report._id));
    setModerationError("");
    try {
      const result = await reviewContentReport({ token, reportId: report._id, status, action, moderationType: report.moderationType });
      setModerationReports((current) => (current || []).map((item) => item._id === report._id ? { ...item, status: result.status } : item).filter((item) => item.status !== "resolved"));
    } catch (error) {
      setModerationError(error.message || "Impossible d’enregistrer la décision.");
    } finally {
      setModerationBusyId("");
    }
  };

  const acceptRules = async () => {
    setRulesBusy(true);
    setRulesError("");
    try {
      await acceptCommunityRules(token);
      setRulesAccepted(true);
    } catch (error) {
      setRulesError(error.message || "Impossible d’enregistrer ton acceptation.");
    } finally {
      setRulesBusy(false);
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
          {moderationReports !== null && <section className="settings-card settings-moderation-card">
            <div className="settings-card-heading"><span className="settings-card-icon">⚑</span><div><h2>Modération</h2><p>{moderationReports.length} signalement(s) à examiner.</p></div></div>
            {moderationReports.length === 0 ? <p className="settings-moderation-empty">Aucun contenu en attente.</p> : moderationReports.map((report) => <article className="settings-report-row" key={report._id}>
              <div><strong>{report.category} · {report.contentType === "account" ? `compte @${report.contentOwner?.username || "supprimé"}` : report.contentType}</strong><p>{report.preview || "Contenu indisponible"}</p><small>Signalé par {report.reporter?.username || "un compte supprimé"} · {new Date(report.createdAt).toLocaleString("fr-FR")}</small></div>
              <div className="settings-report-actions">{report.moderationType === "account" ? <><button type="button" disabled={moderationBusyId === report._id} onClick={() => decideReport(report, "keep", "reviewing")}>Examiner</button><button type="button" className="quiet" disabled={moderationBusyId === report._id} onClick={() => decideReport(report, "keep", "resolved")}>Clôturer</button></> : <><button type="button" disabled={moderationBusyId === report._id} onClick={() => decideReport(report, "keep")}>Conserver</button><button type="button" disabled={moderationBusyId === report._id} onClick={() => decideReport(report, "remove")}>Retirer</button></>}</div>
            </article>)}
            {moderationError && <p className="settings-push-feedback" role="alert">{moderationError}</p>}
          </section>}
          <section className="settings-card settings-legal-card">
            <div className="settings-card-heading"><span className="settings-card-icon">§</span><div><h2>Règles et confidentialité</h2><p>Consulte les règles de communauté et les informations sur tes données.</p></div></div>
            <div className="settings-legal-links"><a href="/community-rules.html" target="_blank" rel="noreferrer">Règles de la communauté</a><a href="/terms.html" target="_blank" rel="noreferrer">Conditions d’utilisation</a><a href="/privacy.html" target="_blank" rel="noreferrer">Confidentialité</a><a href="/delete-account.html" target="_blank" rel="noreferrer">Suppression du compte</a></div>
            {!rulesAccepted && <div className="settings-rules-accept"><p>Avant de publier ou d’envoyer du contenu, lis les règles et conditions. Consulte aussi la politique de confidentialité.</p><button type="button" disabled={rulesBusy} onClick={acceptRules}>{rulesBusy ? "Enregistrement…" : "J’accepte les règles et conditions"}</button>{rulesError && <small role="alert">{rulesError}</small>}</div>}
          </section>
          <section className="settings-card settings-delete-card">
            <div className="settings-card-heading"><span className="settings-card-icon">⌫</span><div><h2>Supprimer le compte</h2><p>Suppression définitive du compte Veloce et des données associées.</p></div></div>
            <p>Les publications et médias personnels, messages, notifications, profil et solde Piz Veloce seront supprimés. Les historiques de transaction nécessaires aux comptes seront conservés sous forme anonymisée. Un compte Piz externe n’est pas supprimé ici.</p>
            <button type="button" className="settings-delete-button" disabled={deletingAccount} onClick={deleteAccount}>{deletingAccount ? "Suppression…" : "Supprimer définitivement mon compte"}</button>
            {accountDeleteError && <p className="settings-push-feedback" role="alert">{accountDeleteError}</p>}
          </section>
          <p className="settings-saved-note">Vos préférences sont enregistrées automatiquement sur cet appareil.</p>
        </div>
      </div>
    </section>
  );
}

export default Settings;
