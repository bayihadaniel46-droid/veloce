import { useEffect, useState } from "react";
import { useAuth } from "../context/authContext";
import { getMyAccountAppeals, submitAccountAppeal } from "../services/userService";
import "./SuspendedAccount.css";

function SuspendedAccount() {
  const { token, user, logout, refreshUser } = useAuth();
  const [appeals, setAppeals] = useState([]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    getMyAccountAppeals(token)
      .then((data) => { if (active) setAppeals(data.appeals || []); })
      .catch((requestError) => { if (active) setError(requestError.message || "Impossible de charger tes recours."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    const timer = window.setInterval(() => { refreshUser(); }, 30000);
    return () => window.clearInterval(timer);
  }, [token, refreshUser]);

  const sendAppeal = async (event) => {
    event.preventDefault();
    if (reason.trim().length < 30) {
      setError("Explique ta demande en au moins 30 caractères.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await submitAccountAppeal({ token, reason: reason.trim() });
      setAppeals((current) => [result.appeal, ...current]);
      setReason("");
      setMessage("Ton recours a été envoyé à l’équipe Veloce.");
    } catch (requestError) {
      setError(requestError.message || "Impossible d’envoyer ton recours.");
    } finally {
      setBusy(false);
    }
  };

  const pendingAppeal = appeals.find((appeal) => appeal.status === "pending");
  const submittedAt = user?.suspendedAt ? new Date(user.suspendedAt).toLocaleDateString("fr-FR", { dateStyle: "long" }) : "—";
  const endsAt = user?.suspendedUntil ? new Date(user.suspendedUntil).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "Sans date de fin";

  return (
    <main className="suspended-screen">
      <section className="suspended-card">
        <div className="suspended-mark" aria-hidden="true">!</div>
        <span className="suspended-eyebrow">COMPTE VELOCE · @{user?.username || "membre"}</span>
        <h1>Accès au compte suspendu</h1>
        <p className="suspended-intro">Les actions de publication et de messagerie sont mises en pause pendant l’examen de la situation.</p>
        <div className="suspended-details"><div><span>Motif transmis</span><strong>{user?.suspensionReason || "Consulte l’équipe de modération."}</strong></div><div><span>Début</span><strong>{submittedAt}</strong></div><div><span>Fin prévue</span><strong>{endsAt}</strong></div></div>

        <section className="suspended-appeal">
          <div><h2>Demander un réexamen</h2><p>Explique calmement ta situation. Un recours en attente empêche l’envoi d’un second.</p></div>
          {loading ? <p className="suspended-muted">Chargement de l’historique…</p> : pendingAppeal ? <div className="suspended-pending"><strong>Recours en cours d’examen</strong><p>Envoyé le {new Date(pendingAppeal.submittedAt).toLocaleString("fr-FR")}.</p><blockquote>{pendingAppeal.reason}</blockquote></div> : <form onSubmit={sendAppeal}>
            <label htmlFor="suspended-appeal-reason">Ton explication</label>
            <textarea id="suspended-appeal-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} minLength={30} rows={5} placeholder="Décris les faits et les éléments que tu souhaites faire réexaminer…" />
            <div className="suspended-form-footer"><small>{reason.length}/2 000 · 30 minimum</small><button type="submit" disabled={busy || reason.trim().length < 30}>{busy ? "Envoi…" : "Envoyer le recours"}</button></div>
          </form>}
          {appeals.filter((appeal) => appeal.status !== "pending").slice(0, 3).map((appeal) => <article className="suspended-previous-appeal" key={appeal._id}><strong>Recours {appeal.status === "accepted" ? "accepté" : "clos"}</strong><p>{appeal.decisionNote || appeal.reason}</p></article>)}
          {error && <p className="suspended-feedback error" role="alert">{error}</p>}
          {message && <p className="suspended-feedback success" role="status">{message}</p>}
        </section>
        <button type="button" className="suspended-logout" onClick={logout}>Se déconnecter</button>
      </section>
    </main>
  );
}

export default SuspendedAccount;
