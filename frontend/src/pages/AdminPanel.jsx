import { useEffect, useState } from "react";
import { useAuth } from "../context/authContext";
import { getAdminOverview, getModerationQueue, reviewContentReport } from "../services/userService";
import "./AdminPanel.css";

const numberFormat = new Intl.NumberFormat("fr-FR");

function AdminPanel({ onBack }) {
  const { token } = useAuth();
  const [overview, setOverview] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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

  const decideReport = async (report, action, status = "resolved") => {
    if (action === "remove" && !window.confirm("Retirer définitivement ce contenu de Veloce ?")) return;
    setBusyId(String(report._id));
    setError("");
    setNotice("");
    try {
      const updated = await reviewContentReport({
        token,
        reportId: report._id,
        status,
        action,
        moderationType: report.moderationType
      });
      setReports((current) => current
        .map((item) => item._id === report._id ? { ...item, ...updated } : item)
        .filter((item) => item.status !== "resolved"));
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
    { icon: "♙", label: "Membres", value: stats.members, note: `+${numberFormat.format(stats.newMembers30d || 0)} ces 30 derniers jours`, tone: "violet" },
    { icon: "▤", label: "Publications", value: stats.posts, note: "Publications enregistrées", tone: "blue" },
    { icon: "♧", label: "Clans", value: stats.clans, note: "Espaces de groupe créés", tone: "teal" },
    { icon: "⚑", label: "Signalements", value: (stats.contentReports || 0) + (stats.accountReports || 0), note: `${numberFormat.format(stats.contentReports || 0)} contenus · ${numberFormat.format(stats.accountReports || 0)} comptes`, tone: "amber" },
    { icon: "◈", label: "Mouvements Piz", value: stats.pizMovements30d, note: "Mouvements confirmés · 30 jours", tone: "pink" },
    { icon: "!", label: "Échecs Piz", value: stats.failedPizMovements7d, note: "Mouvements échoués · 7 jours", tone: "red" }
  ];

  return (
    <section className="admin-page">
      <header className="admin-header">
        <button type="button" className="admin-back" onClick={onBack}>← Paramètres</button>
        <div className="admin-title-row">
          <div>
            <span className="admin-eyebrow">ESPACE PRIVÉ · ÉQUIPE VELOCE</span>
            <h1>Administration</h1>
            <p>Vue d’ensemble de l’activité et des signalements à traiter.</p>
          </div>
          <button type="button" className="admin-refresh" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}>
            {loading ? "Actualisation…" : "↻ Actualiser"}
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
          {metricCards.map((card) => <article className={`admin-metric ${card.tone}`} key={card.label}>
            <span className="admin-metric-icon" aria-hidden="true">{card.icon}</span>
            <span className="admin-metric-label">{card.label}</span>
            <strong>{numberFormat.format(Number(card.value) || 0)}</strong>
            <small>{card.note}</small>
          </article>)}
        </div>

        <section className="admin-reports-section">
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
        <p className="admin-footnote">Les actions d’administration sont vérifiées par le serveur. Cette page ne donne pas accès aux mots de passe ni aux clés de service.</p>
      </>}
    </section>
  );
}

export default AdminPanel;
