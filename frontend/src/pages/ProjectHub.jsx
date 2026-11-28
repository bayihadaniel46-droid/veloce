import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "../config";
import { useAuth } from "../context/authContext";
import "./ProjectHub.css";

const activityLabels = { created: "a créé le projet", "file-added": "a ajouté", "file-updated": "a modifié", "file-removed": "a supprimé", "collaborator-added": "a invité", "collaborator-removed": "a retiré un accès" };
const dateLabel = (value) => value ? new Date(value).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "À l’instant";
const authHeaders = (token, extra = {}) => ({ Authorization: `Bearer ${token}`, ...extra });

function ProjectHub({ onBack }) {
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [project, setProject] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [filePath, setFilePath] = useState("");
  const [editor, setEditor] = useState("");
  const [dirty, setDirty] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const fileInput = useRef(null);
  const selectedFile = useMemo(() => project?.files?.find((file) => file.path === filePath) || null, [project, filePath]);

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_BASE_URL}/projects${path}`, { ...options, headers: authHeaders(token, options.headers || {}) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Cette action n’a pas abouti.");
    return result;
  }, [token]);

  const loadProjects = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await request("/");
      setProjects(data.projects || []);
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, [request]);

  const loadProject = useCallback(async (id, quiet = false) => {
    if (!quiet) { setBusy(true); setError(""); }
    try {
      const data = await request(`/${id}`);
      setProject(data.project); setPermissions(data.permissions);
      if (!quiet) {
        setFilePath(data.project.files?.[0]?.path || "");
        setEditor(data.project.files?.[0]?.content || ""); setDirty(false);
      } else if (!dirty) {
        const remoteFile = data.project.files?.find((file) => file.path === filePath);
        if (remoteFile && remoteFile.revision !== selectedFile?.revision) setEditor(remoteFile.content || "");
        if (!remoteFile && filePath) { setFilePath(data.project.files?.[0]?.path || ""); setEditor(data.project.files?.[0]?.content || ""); }
      }
      setProjects((current) => current.map((entry) => entry.id === id ? { ...entry, updatedAt: data.project.updatedAt } : entry));
    } catch (loadError) { if (!quiet) setError(loadError.message); }
    finally { if (!quiet) setBusy(false); }
  }, [request, dirty, filePath, selectedFile?.revision]);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => { if (selectedId) loadProject(selectedId); }, [selectedId, loadProject]);
  useEffect(() => {
    if (!selectedId || !project || dirty) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const status = await request(`/${selectedId}/status`);
        if (Number(status.changeVersion) !== Number(project.changeVersion)) await loadProject(selectedId, true);
      } catch { /* Le dépôt reste ouvert si la connexion est momentanément coupée. */ }
    }, 12000);
    return () => window.clearInterval(timer);
  }, [selectedId, project?.changeVersion, dirty, request, loadProject]);
  useEffect(() => {
    if (!selectedId || !selectedFile || dirty) return;
    setEditor(selectedFile.content || "");
  }, [selectedId, selectedFile?.path, selectedFile?.revision, dirty]);

  const createProject = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const data = await request("/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description, visibility }) });
      setProjects((current) => [data.project, ...current]); setTitle(""); setDescription(""); setVisibility("private"); setShowCreate(false); setSelectedId(data.project.id);
      setNotice("Projet créé. Tu peux ajouter tes fichiers ou inviter un collaborateur.");
    } catch (createError) { setError(createError.message); }
    finally { setBusy(false); }
  };

  const saveFile = async (path = filePath, content = editor, expectedRevision = selectedFile?.revision) => {
    if (!path.trim()) { setError("Donne un nom à ce fichier avant l’enregistrement."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await request(`/${selectedId}/files`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, content, expectedRevision }) });
      setProject((current) => ({ ...current, files: [...(current.files || []).filter((file) => file.path !== path), data.file], changeVersion: data.changeVersion, updatedAt: data.updatedAt }));
      setFilePath(path); setEditor(content); setDirty(false); setNotice("Fichier enregistré et partagé avec l’équipe.");
    } catch (saveError) { setError(saveError.message); }
    finally { setBusy(false); }
  };

  const addEmptyFile = async () => {
    const path = window.prompt("Nom ou chemin du nouveau fichier", "src/main.js");
    if (!path) return;
    await saveFile(path.trim(), "", undefined);
  };

  const importDirectory = async (event) => {
    const selected = Array.from(event.target.files || []); event.target.value = "";
    if (!selected.length) return;
    if (selected.length > 80) { setError("Tu peux importer 80 fichiers maximum à la fois."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const files = await Promise.all(selected.map(async (file) => {
        if (file.size > 220 * 1024) throw new Error(`${file.name} dépasse la limite de 220 Ko.`);
        const content = await file.text();
        if (content.includes("\0")) throw new Error(`${file.name} n’est pas un fichier texte.`);
        return { path: file.webkitRelativePath || file.name, content };
      }));
      const data = await request(`/${selectedId}/files/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ files }) });
      await loadProject(selectedId, true); setNotice(`${files.length} fichier(s) importé(s) dans le projet.`);
      if (!filePath && data.files?.length) setFilePath(data.files[0].path);
    } catch (importError) { setError(importError.message); }
    finally { setBusy(false); }
  };

  const deleteFile = async () => {
    if (!selectedFile || !window.confirm(`Supprimer ${selectedFile.path} du projet ?`)) return;
    setBusy(true); setError("");
    try {
      const data = await request(`/${selectedId}/files`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: selectedFile.path }) });
      const next = project.files.filter((file) => file.path !== selectedFile.path); setProject((current) => ({ ...current, files: next, changeVersion: data.changeVersion }));
      setFilePath(next[0]?.path || ""); setEditor(next[0]?.content || ""); setDirty(false); setNotice("Fichier supprimé.");
    } catch (deleteError) { setError(deleteError.message); }
    finally { setBusy(false); }
  };

  const inviteCollaborator = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await request(`/${selectedId}/collaborators`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: inviteName, role: inviteRole }) });
      setInviteName(""); await loadProject(selectedId, true); setNotice("Collaborateur ajouté au projet.");
    } catch (inviteError) { setError(inviteError.message); }
    finally { setBusy(false); }
  };

  const removeCollaborator = async (userId) => {
    setBusy(true); setError("");
    try { await request(`/${selectedId}/collaborators/${userId}`, { method: "DELETE" }); await loadProject(selectedId, true); setNotice("Accès du collaborateur retiré."); }
    catch (removeError) { setError(removeError.message); }
    finally { setBusy(false); }
  };

  const saveProjectSettings = async () => {
    setBusy(true); setError("");
    try {
      const data = await request(`/${selectedId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: project.title, description: project.description, visibility: project.visibility }) });
      setProject((current) => ({ ...current, ...data.project })); await loadProjects(); setNotice("Réglages du projet mis à jour.");
    } catch (settingsError) { setError(settingsError.message); }
    finally { setBusy(false); }
  };

  const exportProject = () => {
    const blob = new Blob([JSON.stringify({ format: "veloce-project", version: 1, title: project.title, description: project.description, files: project.files.map(({ path, content }) => ({ path, content })) }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${project.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "projet"}.veloce.json`; link.click(); URL.revokeObjectURL(url);
  };

  const onEditorKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); if (dirty) saveFile(); }
    if (event.key === "Tab") { event.preventDefault(); const input = event.currentTarget; const start = input.selectionStart; const end = input.selectionEnd; const next = `${editor.slice(0, start)}  ${editor.slice(end)}`; setEditor(next); setDirty(true); requestAnimationFrame(() => { input.selectionStart = input.selectionEnd = start + 2; }); }
  };

  if (selectedId && project) return <section className="project-workspace">
    <header className="project-workspace-heading">
      <button type="button" className="project-back" onClick={() => { setSelectedId(""); setProject(null); setPermissions(null); setDirty(false); loadProjects(); }}>← Projets</button>
      <div className="project-title-block"><span>ESPACE DE TRAVAIL · {project.visibility === "public" ? "PUBLIC" : "PRIVÉ"}</span><h1>{project.title}</h1><p>{project.description || "Projet collaboratif"}</p></div>
      <button type="button" className="project-export" onClick={exportProject}>Exporter ↥</button>
    </header>
    {error && <p className="project-notice is-error" role="alert">{error}</p>}{notice && <p className="project-notice" role="status">{notice}</p>}
    <div className="project-settings-row">
      <label>Nom<input value={project.title} disabled={!permissions?.owner} onChange={(event) => setProject((current) => ({ ...current, title: event.target.value }))} /></label>
      <label>Description<input value={project.description || ""} disabled={!permissions?.owner} maxLength={500} onChange={(event) => setProject((current) => ({ ...current, description: event.target.value }))} /></label>
      {permissions?.owner && <label className="project-visibility-field">Visibilité<select value={project.visibility} onChange={(event) => setProject((current) => ({ ...current, visibility: event.target.value }))}><option value="private">Privé · équipe seulement</option><option value="public">Public · visible par tous</option></select></label>}
      {permissions?.owner && <button type="button" className="project-save-settings" disabled={busy} onClick={saveProjectSettings}>Enregistrer</button>}
    </div>
    <div className="project-workspace-grid">
      <aside className="project-file-panel">
        <div className="project-panel-heading"><div><span>FICHIERS</span><small>{project.files?.length || 0}/80</small></div>{permissions?.canWrite && <button type="button" title="Créer un fichier" onClick={addEmptyFile}>＋</button>}</div>
        {permissions?.canWrite && <div className="project-file-actions"><button type="button" onClick={() => fileInput.current?.click()} disabled={busy}>Importer un dossier</button><input ref={fileInput} type="file" multiple webkitdirectory="" directory="" onChange={importDirectory} hidden /></div>}
        <div className="project-file-list">{project.files?.length ? project.files.map((file) => <button key={file.path} type="button" className={file.path === filePath ? "is-selected" : ""} onClick={() => { if (dirty && !window.confirm("Abandonner les modifications non enregistrées ?")) return; setFilePath(file.path); setEditor(file.content || ""); setDirty(false); setError(""); }}><span aria-hidden="true">{file.path.split("/").length > 1 ? "▱" : "◇"}</span>{file.path}<small>{file.revision || 1}</small></button>) : <p>Aucun fichier pour l’instant.</p>}</div>
        <button type="button" className="project-export project-export-mobile" onClick={exportProject}>Exporter le projet</button>
      </aside>
      <section className="project-editor-panel">
        <div className="project-editor-topbar"><span><i /> {filePath || "Sans fichier"}</span><small>{selectedFile ? `révision ${selectedFile.revision || 1}` : "Nouveau fichier"}</small></div>
        <textarea className="project-code-editor" aria-label="Éditeur de code du projet" spellCheck="false" value={editor} placeholder={permissions?.canWrite ? "Commence à écrire ou importe un dossier…" : "Ce projet ne contient pas encore de fichier."} readOnly={!permissions?.canWrite} onChange={(event) => { setEditor(event.target.value); setDirty(true); }} onKeyDown={onEditorKeyDown} />
        <div className="project-editor-footer"><span>{dirty ? "Modifications non enregistrées" : "Enregistré et synchronisé"} · aucun code n’est exécuté dans Veloce</span><div>{permissions?.canWrite && selectedFile && <button type="button" className="project-delete-file" disabled={busy} onClick={deleteFile}>Supprimer</button>}{permissions?.canWrite && <button type="button" className="project-save-file" disabled={busy || !dirty} onClick={() => saveFile()}>{busy ? "Enregistrement…" : "Enregistrer · Ctrl S"}</button>}</div></div>
      </section>
      <aside className="project-team-panel">
        <div className="project-panel-heading"><div><span>ÉQUIPE</span><small>{1 + (project.collaborators?.length || 0)}</small></div></div>
        <div className="project-person"><span className="project-avatar">{(project.owner?.username || "M").slice(0, 1).toUpperCase()}</span><div><strong>{project.owner?.username || "Propriétaire"}</strong><small>Propriétaire</small></div></div>
        {(project.collaborators || []).map((member) => <div className="project-person" key={member.user?._id || member.user}><span className="project-avatar project-avatar-muted">{(member.user?.username || "M").slice(0, 1).toUpperCase()}</span><div><strong>{member.user?.username || "Membre"}</strong><small>{member.role === "editor" ? "Éditeur" : "Lecteur"}</small></div>{permissions?.canInvite && <button type="button" aria-label={`Retirer ${member.user?.username || "ce membre"}`} title="Retirer l’accès" onClick={() => removeCollaborator(member.user?._id || member.user)}>×</button>}</div>)}
        {permissions?.canInvite && <form className="project-invite-form" onSubmit={inviteCollaborator}><label>Inviter par pseudo Veloce<input value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="Pseudo exact" maxLength={30} required /></label><select aria-label="Rôle du collaborateur" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}><option value="editor">Peut modifier</option><option value="viewer">Lecture seule</option></select><button type="submit" disabled={busy}>Ajouter à l’équipe</button></form>}
        <div className="project-activity"><div className="project-panel-heading"><div><span>ACTIVITÉ RÉCENTE</span></div></div>{[...(project.activity || [])].reverse().slice(0, 8).map((entry, index) => <p key={`${entry.createdAt}-${index}`}><strong>{entry.actor?.username || "Membre"}</strong> {activityLabels[entry.action] || "a mis à jour le projet"} <b>{entry.detail}</b><small>{dateLabel(entry.createdAt)}</small></p>)}</div>
      </aside>
    </div>
  </section>;

  return <section className="projects-page">
    <header className="projects-hero"><div className="projects-hero-copy"><span>ATELIER COLLABORATIF · PISTON</span><h1>Projets en commun</h1><p>Partage ton code, travaille avec ton équipe et retrouve les fichiers dans un éditeur léger.</p></div><div className="projects-hero-actions"><button type="button" className="projects-create-button" onClick={() => setShowCreate((value) => !value)}>＋ Nouveau projet</button>{onBack && <button type="button" className="project-back" onClick={onBack}>Accueil</button>}</div></header>
    {error && <p className="project-notice is-error" role="alert">{error}</p>}{notice && <p className="project-notice" role="status">{notice}</p>}
    {showCreate && <form className="project-create-form" onSubmit={createProject}><div><span>NOUVEAU DÉPÔT</span><h2>Donne un point de départ à ton projet</h2></div><label>Nom du projet<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex. Mon jeu indépendant" required minLength={2} maxLength={80} autoFocus /></label><label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ce que tu construis avec ton équipe…" maxLength={500} rows={3} /></label><label>Visibilité<select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="private">Privé · toi et les collaborateurs</option><option value="public">Public · visible dans la liste Veloce</option></select></label><div><button className="projects-create-button" type="submit" disabled={busy}>{busy ? "Création…" : "Créer le projet"}</button><button type="button" className="project-cancel-button" onClick={() => setShowCreate(false)}>Annuler</button></div></form>}
    <div className="projects-list-heading"><div><span>ESPACE DE TRAVAIL</span><h2>Projets visibles</h2></div><small>{projects.length} projet{projects.length === 1 ? "" : "s"}</small></div>
    {loading ? <div className="projects-empty">Chargement des projets…</div> : projects.length ? <div className="projects-grid">{projects.map((item) => <button type="button" className="project-card" key={item.id} onClick={() => { setProject(null); setPermissions(null); setSelectedId(item.id); setNotice(""); setError(""); }}><div className="project-card-top"><span className="project-card-mark">{item.title.slice(0, 1).toUpperCase()}</span><span className={item.visibility === "public" ? "project-visibility is-public" : "project-visibility"}>{item.visibility === "public" ? "Public" : "Privé"}</span></div><strong>{item.title}</strong><p>{item.description || "Aucune description pour le moment."}</p><div className="project-card-footer"><span>par {item.owner?.username || "Membre"}</span><span>♧ {(item.collaborators || []).length}</span><time>{dateLabel(item.updatedAt)}</time></div></button>)}</div> : <div className="projects-empty"><span>⌘</span><h2>Ton atelier est encore vide</h2><p>Crée un dépôt privé, importe un dossier de fichiers texte et invite des membres Veloce à contribuer.</p><button type="button" className="projects-create-button" onClick={() => setShowCreate(true)}>Créer mon premier projet</button></div>}
    <div className="projects-footnote"><span>ÉDITEUR LÉGER</span><p>Enregistrement partagé, rôles de lecture et de modification, historique récent et détection des conflits. Les fichiers sont conservés dans la base Veloce, avec une limite de 2 Mo de texte par projet.</p></div>
  </section>;
}

export default ProjectHub;
