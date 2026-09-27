import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/authContext";
import {
  getAssistant, updateAssistant, getAssistantDrafts, generateAssistantDrafts,
  publishAssistantDraft, dismissAssistantDraft
} from "../services/assistantService";
import "./Assistant.css";

const splitList = (value) => value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);

function Assistant() {
  const { token } = useAuth();
  const [profile, setProfile] = useState({ topics: [], preferredSources: [], language: "fr", tone: "accessible et informatif" });
  const [topicsText, setTopicsText] = useState("");
  const [sourcesText, setSourcesText] = useState("");
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const [profileData, draftData] = await Promise.all([getAssistant(token), getAssistantDrafts(token)]);
      const next = profileData.profile;
      setProfile(next);
      setTopicsText((next.topics || []).join(", "));
      setSourcesText((next.preferredSources || []).join(", "));
      setDrafts(draftData.drafts || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const savePreferences = async (event) => {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const data = await updateAssistant(token, {
        topics: splitList(topicsText),
        preferredSources: splitList(sourcesText),
        language: profile.language || "fr",
        tone: profile.tone || "accessible et informatif"
      });
      setProfile(data.profile);
      setTopicsText(data.profile.topics.join(", "));
      setSourcesText(data.profile.preferredSources.join(", "));
      setNotice("Tes préférences sont enregistrées dans ton espace privé.");
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const generate = async () => {
    setGenerating(true); setError(""); setNotice("");
    try {
      const data = await generateAssistantDrafts(token);
      setDrafts((current) => [...data.drafts, ...current]);
      setNotice("Tes nouveaux brouillons sont prêts. Consulte les sources avant de les partager.");
    } catch (e) { setError(e.message); }
    finally { setGenerating(false); }
  };

  const handleDraft = async (draft, action) => {
    setBusyId(draft._id); setError(""); setNotice("");
    try {
      if (action === "publish") {
        await publishAssistantDraft(token, draft._id);
        setNotice("La publication a été ajoutée au fil public.");
      } else {
        await dismissAssistantDraft(token, draft._id);
        setNotice("Brouillon écarté.");
      }
      setDrafts((items) => items.filter((item) => item._id !== draft._id));
    } catch (e) { setError(e.message); }
    finally { setBusyId(""); }
  };

  if (loading) return <div className="assistant-page"><p>Chargement de ton espace privé…</p></div>;

  return (
    <section className="assistant-page">
      <header className="assistant-header">
        <div><span className="assistant-eyebrow">TON ESPACE PRIVÉ</span><h1>✨ Mon assistant IA</h1>
          <p>Des idées d’actualité adaptées à tes intérêts, avec leurs sources. Tu choisis ce qui paraît sur ton profil.</p></div>
        <button className="assistant-generate" onClick={generate} disabled={generating || saving}>
          {generating ? "Recherche en cours…" : "🔎 Rechercher des idées"}
        </button>
      </header>

      {notice && <div className="assistant-notice">{notice}</div>}
      {error && <div className="assistant-error">{error}</div>}

      <div className="assistant-columns">
        <form className="assistant-preferences" onSubmit={savePreferences}>
          <h2>Ce qui t’intéresse</h2>
          <p>Ajoute des sujets séparés par des virgules. Ces préférences restent privées.</p>
          <label htmlFor="assistant-topics">Centres d’intérêt</label>
          <textarea id="assistant-topics" rows="4" placeholder="Technologie, sport, actualité au Cameroun…" value={topicsText} onChange={(e) => setTopicsText(e.target.value)} />
          <label htmlFor="assistant-sources">Sources à privilégier (facultatif)</label>
          <textarea id="assistant-sources" rows="2" placeholder="rfi.fr, lemonde.fr" value={sourcesText} onChange={(e) => setSourcesText(e.target.value)} />
          <label htmlFor="assistant-tone">Ton des propositions</label>
          <select id="assistant-tone" value={profile.tone || "accessible et informatif"} onChange={(e) => setProfile((p) => ({ ...p, tone: e.target.value }))}>
            <option value="accessible et informatif">Accessible et informatif</option>
            <option value="neutre et factuel">Neutre et factuel</option>
            <option value="chaleureux et conversationnel">Chaleureux et conversationnel</option>
            <option value="analytique et nuancé">Analytique et nuancé</option>
          </select>
          <button className="assistant-save" type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer mes préférences"}</button>
        </form>

        <div className="assistant-drafts">
          <div className="assistant-drafts-title"><div><h2>À consulter</h2><p>{drafts.length} brouillon{drafts.length === 1 ? "" : "s"} en attente</p></div></div>
          {!drafts.length ? <div className="assistant-empty"><span>📰</span><h3>Pas encore de brouillon</h3><p>Enregistre tes centres d’intérêt, puis lance une recherche pour recevoir des idées de publications sourcées.</p></div> : (
            <div className="assistant-draft-list">{drafts.map((draft) => (
              <article className="assistant-draft" key={draft._id}>
                <div className="assistant-draft-label">PROPOSITION DE L’ASSISTANT</div>
                <h3>{draft.title}</h3><p className="assistant-draft-content">{draft.content}</p>
                {draft.sources?.length > 0 && <div className="assistant-sources"><strong>Sources à consulter</strong>
                  <ul>{draft.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title || source.url}</a>{source.date ? <span> · {source.date}</span> : null}</li>)}</ul>
                </div>}
                <div className="assistant-draft-actions">
                  <button onClick={() => handleDraft(draft, "publish")} disabled={!!busyId}>{busyId === draft._id ? "Traitement…" : "Publier sur mon profil"}</button>
                  <button className="assistant-dismiss" onClick={() => handleDraft(draft, "dismiss")} disabled={!!busyId}>Écarter</button>
                </div>
              </article>
            ))}</div>
          )}
        </div>
      </div>
    </section>
  );
}
export default Assistant;
