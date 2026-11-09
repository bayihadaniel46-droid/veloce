import { useEffect, useState } from "react";
import { useAuth } from "../context/authContext";
import {
  getAdminClans,
  getAdminMembers,
  getAdminOverview,
  getAdminPizTransactions,
  getAdminPosts,
  getModerationQueue,
  reviewContentReport
} from "../services/userService";
import "./AdminPanel.css";

const numberFormat = new Intl.NumberFormat("fr-FR");
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const resourceLoaders = {
  members: (token, params) => getAdminMembers(token, params),
  posts: (token, params) => getAdminPosts(token, params),
  clans: (token, params) => getAdminClans(token, params),
  transactions: (token, params) => getAdminPizTransactions(token, { ...params, status: "completed" }),
  failedTransactions: (token, params) => getAdminPizTransactions(token, { ...params, status: "failed" })
};

const formatDate = (value) => value ? dateFormat.format(new Date(value)) : "Date inconnue";
const formatDateTime = (value) => value ? dateTimeFormat.format(new Date(value)) : "Date inconnue";
const formatDuration = (seconds = 0) => {
  const hours = Math.floor((Number(seconds) || 0) / 3600);
  return hours < 1 ? "Moins d’une heure" : `${numberFormat.format(hours)} h d’activité`;
};

function AdminPanel({ onBack, onOpenUserProfile }) {
  const { token } = useAuth();
  const [overview, setOverview] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeResource, setActiveResource] = useState("");
  const [resourceSearch, setResourceSearch] = useState("");
  const [resourcePage, setResourcePage] = useState(1);
  const [resourceItems, setResourceItems] = useState([]);
  const [resourcePagination, setResourcePagination] = useState(null);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceError, setResourceError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([getAdminOverview(token), getModerationQueue(token)])
      .then(([data, queue]) => {
        if (!active) return;
        setOverview(data);
        setReports(queue);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Impossible d’ouvrir l’administration.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [token, refreshKey]);

  useEffect(() => {
    if (!activeResource) return undefined;
    let active = true;
    const timer = window.setTimeout(() => {
      setResourceLoading(true);
      setResourceError("");
      resourceLoaders[activeResource](token, { page: resourcePage, q: resourceSearch })
        .then((data) => {
          if (!active) return;
          setResourceItems(data.items || []);
          setResourcePagination(data.pagination || null);
        })
        .catch((requestError) => {
          if (active) setResourceError(requestError.message || "Impossible de charger cette liste.");
        })
        .finally(() => {
          if (active) setResourceLoading(false);
        });
    }, resourceSearch ? 220 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [token, activeResource, resourcePage, resourceSearch, refreshKey]);

  useEffect(() => {
    if (activeResource) document.getElementById("admin-records")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeResource]);

  const openMetric = (resource) => {
    if (resource === "reports") {
      document.getElementById("admin-reports")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setActiveResource(resource);
    setResourceSearch("");
    setResourcePage(1);
  };

  const decideReport = async (report, action, status = "resolved") => {
    if (action === "remove" && !window.confirm("Retirer définitivement ce contenu de Veloce ?")) return;
    setBusyId(String(report._id));
    setError("");
    setNotice("");
    try {
      await reviewContentReport({
        token,
        reportId: report._id,
        status,
        action,
        moderationType: report.moderationType
      });
      setReports((current) => current.filter((item) => item._id !== report._id));
      setNotice(status === "reviewing" ? "Signalement marqué comme en cours d’examen." : "Décision enregistrée.");
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || "Impossible d’enregistrer cette décision.");
    } finally {
      setBusyId("");
    }
  };

  const stats = overview?.stats || {};
  const metricCards = [
    { resource: "members", icon: "♙", label: "Membres", value: stats.members, note: `+${numberFormat.format(stats.newMembers30d || 0)} ces 30 derniers jours`, tone: "violet" },
    { resource: "posts", icon: "▤", label: "Publications", value: stats.posts, note: "Ouvrir la liste des publications", tone: "blue" },
    { resource: "clans", icon: "♧", label: "Clans", value: stats.clans, note: "Ouvrir les clans enregistrés", tone: "teal" },
    { resource: "reports", icon: "⚑", label: "Signalements", value: (stats.contentReports || 0) + (stats.accountReports || 0), note: `${numberFormat.format(stats.contentReports || 0)} contenus · ${numberFormat.format(stats.accountReports || 0)} comptes`, tone: "amber" },
    { resource: "transactions", icon: "◈", label: "Mouvements Piz", value: stats.pizMovements30d, note: "Mouvements confirmés · 30 jours", tone: "pink" },
    { resource: "failedTransactions", icon: "!", label: "Échecs Piz", value: stats.failedPizMovements7d, note: "Mouvements échoués · 7 jours", tone: "red" }
  ];
  const resourceTitles = {
    members: "Membres de Veloce",
    posts: "Publications récentes",
    clans: "Clans enregistrés",
    transactions: "Mouvements Piz confirmés",
    failedTransactions: "Mouvements Piz échoués"
  };

  const renderResourceItem = (item) => {
    if (activeResource === "members") return (
      <article className="admin-record admin-member-record" key={item._id}>
        <div className="admin-record-avatar">{item.avatar ? <img src={item.avatar} alt="" /> : (item.username || "V").charAt(0).toUpperCase()}</div>
        <div className="admin-record-main"><strong>@{item.username || "membre"}</strong><p>{item.bio || "Aucune biographie renseignée."}</p><small>Inscrit le {formatDate(item.createdAt)} · {formatDuration(item.activeSeconds)}</small></div>
        {onOpenUserProfile && <button type="button" className="admin-record-action" onClick={() => onOpenUserProfile(String(item._id))}>Voir le profil</button>}
      </article>
    );

    if (activeResource === "posts") return (
      <article className="admin-record" key={item._id}>
        <div className="admin-record-main"><div className="admin-record-title"><strong>{item.author?.username ? `@${item.author.username}` : `@${item.username || "membre"}`}</strong><time>{formatDateTime(item.createdAt)}</time></div>
          <p>{item.preview || (item.attachmentCount ? "Publication composée de média(s)." : "Publication sans texte.")}</p>
          <small>{item.likes || 0} j’aime · {item.comments || 0} commentaires · {item.attachmentCount || 0} média(s)</small>
        </div>
        {item.author?._id && onOpenUserProfile && <button type="button" className="admin-record-action" onClick={() => onOpenUserProfile(String(item.author._id))}>Voir l’auteur</button>}
      </article>
    );

    if (activeResource === "clans") return (
      <article className="admin-record" key={item._id}>
        <div className="admin-record-main"><div className="admin-record-title"><strong>{item.name}</strong><span className="admin-record-pill">{item.membershipPolicy === "open" ? "Ouvert" : "Sur autorisation"}</span></div>
          <p>{item.description || "Aucune description."}</p><small>Chef : @{item.owner?.username || "compte indisponible"} · {numberFormat.format(item.memberCount || 0)} membre(s) · créé le {formatDate(item.createdAt)}</small>
        </div>
        {item.owner?._id && onOpenUserProfile && <button type="button" className="admin-record-action" onClick={() => onOpenUserProfile(String(item.owner._id))}>Voir le chef</button>}
      </article>
    );

    return (
      <details className="admin-record admin-transaction-record" key={item._id}>
        <summary><span className={`admin-transaction-status ${item.status}`}>{item.status === "completed" ? "Confirmé" : item.status === "failed" ? "Échoué" : "En attente"}</span>
          <span className="admin-transaction-copy"><strong>{item.type || "Mouvement Piz"}</strong><small>{item.fromUser?.username ? `@${item.fromUser.username}` : item.fromClan?.name || "Réserve"} → {item.toUser?.username ? `@${item.toUser.username}` : item.toClan?.name || "Réserve"}</small></span>
          <strong className="admin-transaction-amount">{numberFormat.format(Number(item.amount) || 0)} Piz</strong><time>{formatDateTime(item.createdAt)}</time>
        </summary>
        <div className="admin-transaction-detail"><span>{item.description || "Aucune description fournie."}</span><small>Part plateforme : {numberFormat.format((Number(item.platformUnits) || 0) / 1_000_000)} Piz</small></div>
      </details>
    );
  };

  return (
    <section className="admin-page">
      <header className="admin-header">
        <button type="button" className="admin-back" onClick={onBack}>← Paramètres</button>
        <div className="admin-title-row">
          <div>
            <span className="admin-eyebrow">ESPACE PRIVÉ · ÉQUIPE VELOCE</span>
            <h1>Administration</h1>
            <p>Consulte les données réelles, ouvre les profils et traite les signalements.</p>
          </div>
          <button type="button" className="admin-refresh" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading || resourceLoading}>
            {loading || resourceLoading ? "Actualisation…" : "↻ Actualiser"}
          </button>
        </div>
      </header>

      {error && <p className="admin-feedback error" role="alert">{error}</p>}
      {notice && <p className="admin-feedback success" role="status">{notice}</p>}

      {loading && !overview ? <div className="admin-loading">Chargement du tableau de bord…</div> : overview && <>
        <div className={`admin-system-status ${overview.database === "connected" ? "is-online" : "is-offline"}`}>
          <span className="admin-status-dot" />
          <strong>Base de données {overview.database === "connected" ? "connectée" : "indisponible"}</strong>
          <small>Actualisé {overview.checkedAt ? new Date(overview.checkedAt).toLocaleTimeString("fr-FR") : "à l’instant"}</small>
        </div>

        <div className="admin-metrics-grid">
          {metricCards.map((card) => <button type="button" className={`admin-metric ${card.tone} ${activeResource === card.resource ? "is-selected" : ""}`} key={card.label} onClick={() => openMetric(card.resource)} aria-label={`Ouvrir ${card.label}`}>
            <span className="admin-metric-icon" aria-hidden="true">{card.icon}</span>
            <span className="admin-metric-label">{card.label}</span>
            <strong>{numberFormat.format(Number(card.value) || 0)}</strong>
            <small>{card.note}</small>
            <span className="admin-metric-open">Ouvrir →</span>
          </button>)}
        </div>

        {activeResource && <section className="admin-records-section" id="admin-records">
          <div className="admin-section-heading"><div><span>DONNÉES DU SERVICE</span><h2>{resourceTitles[activeResource]}</h2></div>
            <button type="button" className="admin-close-list" onClick={() => setActiveResource("")}>Fermer</button>
          </div>
          <div className="admin-list-tools"><label><span className="sr-only">Rechercher dans cette liste</span><input value={resourceSearch} onChange={(event) => { setResourceSearch(event.target.value); setResourcePage(1); }} placeholder={activeResource === "members" ? "Rechercher un nom d’utilisateur" : activeResource === "clans" ? "Rechercher un clan" : activeResource === "posts" ? "Rechercher une publication ou un auteur" : "Rechercher un type ou une description"} /></label>
            {resourcePagination && <small>{numberFormat.format(resourcePagination.total)} résultat(s)</small>}
          </div>
          {resourceError && <p className="admin-feedback error" role="alert">{resourceError}</p>}
          {resourceLoading ? <div className="admin-loading">Chargement des données…</div> : resourceItems.length ? <div className="admin-record-list">{resourceItems.map(renderResourceItem)}</div> : <div className="admin-empty-reports"><strong>Aucun résultat</strong><p>Essaie une autre recherche ou actualise la liste.</p></div>}
          {resourcePagination && resourcePagination.pages > 1 && <div className="admin-pagination"><button type="button" disabled={resourcePage <= 1 || resourceLoading} onClick={() => setResourcePage((value) => value - 1)}>← Précédent</button><span>Page {resourcePagination.page} sur {resourcePagination.pages}</span><button type="button" disabled={resourcePage >= resourcePagination.pages || resourceLoading} onClick={() => setResourcePage((value) => value + 1)}>Suivant →</button></div>}
        </section>}

        <section className="admin-reports-section" id="admin-reports">
          <div className="admin-section-heading">
            <div><span>À TRAITER</span><h2>File de modération</h2></div>
            <b>{numberFormat.format(reports.length)} en attente</b>
          </div>
          {reports.length === 0 ? <div className="admin-empty-reports"><span aria-hidden="true">✓</span><strong>La file est à jour</strong><p>Aucun signalement ouvert pour le moment.</p></div> : <div className="admin-report-list">
            {reports.map((report) => <article className="admin-report" key={`${report.moderationType}-${report._id}`}>
              <div className="admin-report-topline">
                <span className={`admin-report-tag ${report.moderationType === "account" ? "account" : "content"}`}>
                  {report.moderationType === "account" ? "Compte" : report.contentType}
                </span>
                <span className="admin-report-category">{report.category}</span>
                <time>{new Date(report.createdAt).toLocaleString("fr-FR")}</time>
              </div>
              <p className="admin-report-preview">{report.preview || "Contenu indisponible"}</p>
              <div className="admin-report-meta">
                <span>Signalé par @{report.reporter?.username || "compte supprimé"}</span>
                {report.contentOwner?.username && <span>Compte concerné : @{report.contentOwner.username}</span>}
              </div>
              <div className="admin-report-actions">
                {report.moderationType === "account" ? <>
                  <button type="button" onClick={() => decideReport(report, "keep", "reviewing")} disabled={busyId === report._id || report.status === "reviewing"}>
                    {report.status === "reviewing" ? "En examen" : "Examiner"}
                  </button>
                  <button type="button" className="quiet" onClick={() => decideReport(report, "keep")} disabled={busyId === report._id}>Clôturer</button>
                </> : <>
                  <button type="button" onClick={() => decideReport(report, "keep")} disabled={busyId === report._id}>Conserver</button>
                  <button type="button" className="danger" onClick={() => decideReport(report, "remove")} disabled={busyId === report._id}>Retirer le contenu</button>
                </>}
              </div>
            </article>)}
          </div>}
        </section>
        <p className="admin-footnote">Les listes exposent uniquement les données nécessaires à la gestion. Les actions de modération restent protégées par le serveur et demandent une confirmation pour un retrait.</p>
      </>}
    </section>
  );
}

export default AdminPanel;
