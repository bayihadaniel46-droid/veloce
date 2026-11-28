const mongoose = require("mongoose");
const Project = require("../models/Project");
const User = require("../models/User");

const MAX_FILE_BYTES = 220 * 1024;
const MAX_PROJECT_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 80;
const actorId = (req) => String(req.user.userId);
const objectId = (value) => mongoose.isValidObjectId(value);
const refId = (value) => String(value?._id || value);
const cleanPath = (value) => {
  const path = String(value || "").replace(/\\/g, "/").trim();
  if (!path || path.length > 180 || path.startsWith("/") || path.split("/").some((part) => !part || part === "." || part === "..")) return "";
  if (!/^[\p{L}\p{N}_.@()+ -]+(?:\/[\p{L}\p{N}_.@()+ -]+)*$/u.test(path)) return "";
  return path;
};
const addActivity = (project, action, detail, userId) => {
  project.activity.push({ actor: userId, action, detail: String(detail || "").slice(0, 180) });
  if (project.activity.length > 40) project.activity = project.activity.slice(-40);
};
const findProject = (projectId) => objectId(projectId) ? Project.findById(projectId) : null;
const collaborator = (project, userId) => project.collaborators.find((entry) => refId(entry.user) === String(userId));
const canRead = (project, userId) => project.visibility === "public" || refId(project.owner) === String(userId) || Boolean(collaborator(project, userId));
const canWrite = (project, userId) => refId(project.owner) === String(userId) || collaborator(project, userId)?.role === "editor";
const presentProject = (project) => ({
  id: String(project._id), title: project.title, description: project.description,
  visibility: project.visibility, owner: project.owner, collaborators: project.collaborators,
  files: project.files, activity: project.activity, createdAt: project.createdAt, updatedAt: project.updatedAt
});

const listProjects = async (req, res) => {
  try {
    const userId = actorId(req);
    const projects = await Project.find({ $or: [{ owner: userId }, { "collaborators.user": userId }, { visibility: "public" }] })
      .select("title description visibility owner collaborators activity createdAt updatedAt")
      .populate("owner", "username avatar").populate("collaborators.user", "username avatar")
      .sort({ updatedAt: -1 }).limit(100).lean();
    return res.json({ projects: projects.map((project) => ({
      id: String(project._id), title: project.title, description: project.description,
      visibility: project.visibility, owner: project.owner, collaborators: project.collaborators,
      activityCount: project.activity.length, updatedAt: project.updatedAt
    })) });
  } catch (error) {
    console.error("Project list failed:", error.message);
    return res.status(500).json({ message: "Impossible de charger les projets." });
  }
};

const createProject = async (req, res) => {
  const title = String(req.body?.title || "").trim();
  const description = String(req.body?.description || "").trim();
  const visibility = req.body?.visibility === "public" ? "public" : "private";
  if (title.length < 2 || title.length > 80 || description.length > 500) return res.status(400).json({ message: "Le nom doit contenir 2 à 80 caractères et la description 500 maximum." });
  try {
    const project = await Project.create({ title, description, visibility, owner: actorId(req), activity: [{ actor: actorId(req), action: "created", detail: title }] });
    await project.populate("owner", "username avatar");
    return res.status(201).json({ project: presentProject(project) });
  } catch (error) {
    console.error("Project creation failed:", error.message);
    return res.status(500).json({ message: "Impossible de créer ce projet." });
  }
};

const getProject = async (req, res) => {
  try {
    const project = await findProject(req.params.projectId);
    if (!project || !canRead(project, actorId(req))) return res.status(404).json({ message: "Projet introuvable ou privé." });
    const currentMember = collaborator(project, actorId(req));
    const isOwner = refId(project.owner) === actorId(req);
    await project.populate([
      { path: "owner", select: "username avatar" },
      { path: "collaborators.user", select: "username avatar" },
      { path: "activity.actor", select: "username" }
    ]);
    return res.json({ project: presentProject(project), permissions: {
      owner: isOwner, canWrite: canWrite(project, actorId(req)), canInvite: isOwner,
      role: isOwner ? "owner" : currentMember?.role || "viewer"
    } });
  } catch (error) {
    console.error("Project load failed:", error.message);
    return res.status(500).json({ message: "Impossible d’ouvrir ce projet." });
  }
};

const getProjectStatus = async (req, res) => {
  try {
    if (!objectId(req.params.projectId)) return res.status(404).json({ message: "Projet introuvable." });
    const project = await Project.findById(req.params.projectId).select("visibility owner collaborators.user collaborators.role changeVersion updatedAt");
    if (!project || !canRead(project, actorId(req))) return res.status(404).json({ message: "Projet introuvable ou privé." });
    return res.json({ changeVersion: project.changeVersion || 0, updatedAt: project.updatedAt });
  } catch (error) {
    console.error("Project status check failed:", error.message);
    return res.status(500).json({ message: "Impossible de vérifier les mises à jour du projet." });
  }
};

const updateProject = async (req, res) => {
  const title = String(req.body?.title || "").trim();
  const description = String(req.body?.description || "").trim();
  const visibility = req.body?.visibility === "public" ? "public" : "private";
  if (title.length < 2 || title.length > 80 || description.length > 500) return res.status(400).json({ message: "Nom ou description invalide." });
  try {
    const project = await findProject(req.params.projectId);
    if (!project || refId(project.owner) !== actorId(req)) return res.status(404).json({ message: "Seul le propriétaire peut modifier ces réglages." });
    project.title = title; project.description = description; project.visibility = visibility; project.changeVersion = (Number(project.changeVersion) || 0) + 1;
    await project.save();
    return res.json({ project: { id: String(project._id), title: project.title, description: project.description, visibility: project.visibility, changeVersion: project.changeVersion, updatedAt: project.updatedAt } });
  } catch (error) {
    console.error("Project update failed:", error.message);
    return res.status(500).json({ message: "Impossible de mettre à jour ce projet." });
  }
};

const validateFile = (file) => {
  const path = cleanPath(file?.path);
  const content = String(file?.content ?? "");
  if (!path) return { error: "Le chemin du fichier est invalide." };
  if (content.includes("\0")) return { error: `${path} n’est pas un fichier texte.` };
  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) return { error: `${path} dépasse la limite de 220 Ko.` };
  return { path, content };
};

const saveFile = async (req, res) => {
  const parsed = validateFile(req.body);
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  try {
    const project = await findProject(req.params.projectId);
    if (!project || !canWrite(project, actorId(req))) return res.status(404).json({ message: "Projet introuvable ou accès en lecture seule." });
    const index = project.files.findIndex((file) => file.path === parsed.path);
    if (index >= 0 && Number.isInteger(Number(req.body?.expectedRevision)) && Number(req.body.expectedRevision) !== project.files[index].revision) {
      return res.status(409).json({ message: "Ce fichier a été modifié par un autre collaborateur. Recharge-le avant d’enregistrer." });
    }
    const nextTotal = project.files.reduce((sum, file, fileIndex) => sum + (fileIndex === index ? 0 : Buffer.byteLength(file.content, "utf8")), 0) + Buffer.byteLength(parsed.content, "utf8");
    if (nextTotal > MAX_PROJECT_BYTES) return res.status(413).json({ message: "Ce projet dépasse la limite de 2 Mo de code." });
    if (index < 0 && project.files.length >= MAX_FILES) return res.status(400).json({ message: "Ce projet contient déjà 80 fichiers." });
    const action = index < 0 ? "file-added" : "file-updated";
    const userId = actorId(req);
    const now = new Date();
    const activity = { actor: userId, action, detail: parsed.path, createdAt: now };
    const accessFilter = { _id: project._id, $or: [{ owner: userId }, { collaborators: { $elemMatch: { user: userId, role: "editor" } } }] };
    let updated;
    if (index < 0) {
      updated = await Project.findOneAndUpdate({ ...accessFilter, "files.path": { $ne: parsed.path }, "files.79": { $exists: false } }, {
        $push: { files: { path: parsed.path, content: parsed.content, revision: 1, updatedBy: userId, updatedAt: now }, activity: { $each: [activity], $slice: -40 } },
        $inc: { changeVersion: 1 }
      }, { new: true, runValidators: true });
    } else {
      const revision = Number(project.files[index].revision) || 1;
      updated = await Project.findOneAndUpdate({ ...accessFilter, files: { $elemMatch: { path: parsed.path, revision } } }, {
        $set: { "files.$.content": parsed.content, "files.$.updatedBy": userId, "files.$.updatedAt": now },
        $inc: { "files.$.revision": 1, changeVersion: 1 },
        $push: { activity: { $each: [activity], $slice: -40 } }
      }, { new: true, runValidators: true });
    }
    if (!updated) return res.status(409).json({ message: "Ce fichier ou les accès du projet ont changé. Recharge le projet avant de réessayer." });
    const savedFile = updated.files.find((file) => file.path === parsed.path);
    return res.json({ file: savedFile, changeVersion: updated.changeVersion, updatedAt: updated.updatedAt });
  } catch (error) {
    console.error("Project file save failed:", error.message);
    return res.status(500).json({ message: "Impossible d’enregistrer ce fichier." });
  }
};

const importFiles = async (req, res) => {
  const files = Array.isArray(req.body?.files) ? req.body.files : [];
  if (!files.length || files.length > MAX_FILES) return res.status(400).json({ message: "Sélectionne de 1 à 80 fichiers texte." });
  const validated = [];
  const seen = new Set();
  let bytes = 0;
  for (const file of files) {
    const parsed = validateFile(file);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    if (seen.has(parsed.path)) return res.status(400).json({ message: `Le chemin ${parsed.path} apparaît plusieurs fois.` });
    seen.add(parsed.path); bytes += Buffer.byteLength(parsed.content, "utf8"); validated.push(parsed);
  }
  if (bytes > MAX_PROJECT_BYTES) return res.status(413).json({ message: "L’import dépasse la limite totale de 2 Mo." });
  try {
    const project = await findProject(req.params.projectId);
    if (!project || !canWrite(project, actorId(req))) return res.status(404).json({ message: "Projet introuvable ou accès en lecture seule." });
    const existing = new Map(project.files.map((file) => [file.path, file]));
    for (const file of validated) {
      const current = existing.get(file.path);
      existing.set(file.path, { path: file.path, content: file.content, revision: (current?.revision || 0) + 1, updatedBy: actorId(req), updatedAt: new Date() });
    }
    if (existing.size > MAX_FILES) return res.status(400).json({ message: "L’import dépasserait la limite de 80 fichiers." });
    const total = [...existing.values()].reduce((sum, file) => sum + Buffer.byteLength(file.content, "utf8"), 0);
    if (total > MAX_PROJECT_BYTES) return res.status(413).json({ message: "Les fichiers importés dépassent la limite totale du projet de 2 Mo." });
    project.files = [...existing.values()]; project.changeVersion = (Number(project.changeVersion) || 0) + 1;
    addActivity(project, "file-added", `${validated.length} fichier(s) importé(s)`, actorId(req));
    await project.save();
    return res.json({ files: project.files, changeVersion: project.changeVersion, updatedAt: project.updatedAt });
  } catch (error) {
    console.error("Project file import failed:", error.message);
    return res.status(500).json({ message: "Impossible d’importer ces fichiers." });
  }
};

const removeFile = async (req, res) => {
  const path = cleanPath(req.body?.path);
  if (!path) return res.status(400).json({ message: "Chemin de fichier invalide." });
  try {
    const project = await findProject(req.params.projectId);
    if (!project || !canWrite(project, actorId(req))) return res.status(404).json({ message: "Projet introuvable ou accès en lecture seule." });
    const before = project.files.length;
    project.files = project.files.filter((file) => file.path !== path);
    if (before === project.files.length) return res.status(404).json({ message: "Fichier introuvable." });
    addActivity(project, "file-removed", path, actorId(req)); project.changeVersion = (Number(project.changeVersion) || 0) + 1;
    await project.save();
    return res.json({ removed: true, changeVersion: project.changeVersion });
  } catch (error) {
    console.error("Project file remove failed:", error.message);
    return res.status(500).json({ message: "Impossible de retirer ce fichier." });
  }
};

const addCollaborator = async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const role = req.body?.role === "viewer" ? "viewer" : "editor";
  if (username.length < 3 || username.length > 30) return res.status(400).json({ message: "Saisis le pseudo exact du membre." });
  try {
    const project = await findProject(req.params.projectId);
    if (!project || refId(project.owner) !== actorId(req)) return res.status(404).json({ message: "Seul le propriétaire peut inviter des collaborateurs." });
    const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const user = await User.findOne({ username: { $regex: `^${escaped}$`, $options: "i" } }).select("username avatar");
    if (!user) return res.status(404).json({ message: "Aucun membre Veloce ne correspond à ce pseudo." });
    if (String(user._id) === actorId(req)) return res.status(400).json({ message: "Tu es déjà propriétaire du projet." });
    const current = collaborator(project, user._id);
    if (current) current.role = role; else project.collaborators.push({ user: user._id, role });
    project.changeVersion = (Number(project.changeVersion) || 0) + 1;
    addActivity(project, "collaborator-added", user.username, actorId(req));
    await project.save();
    await project.populate("collaborators.user", "username avatar");
    return res.json({ collaborators: project.collaborators });
  } catch (error) {
    console.error("Project collaborator add failed:", error.message);
    return res.status(500).json({ message: "Impossible d’ajouter ce collaborateur." });
  }
};

const removeCollaborator = async (req, res) => {
  if (!objectId(req.params.userId)) return res.status(400).json({ message: "Membre invalide." });
  try {
    const project = await findProject(req.params.projectId);
    if (!project || refId(project.owner) !== actorId(req)) return res.status(404).json({ message: "Seul le propriétaire peut retirer un collaborateur." });
    const before = project.collaborators.length;
    project.collaborators = project.collaborators.filter((entry) => refId(entry.user) !== req.params.userId);
    if (before === project.collaborators.length) return res.status(404).json({ message: "Collaborateur introuvable." });
    addActivity(project, "collaborator-removed", "Accès retiré", actorId(req)); project.changeVersion = (Number(project.changeVersion) || 0) + 1;
    await project.save();
    return res.json({ collaborators: project.collaborators });
  } catch (error) {
    console.error("Project collaborator remove failed:", error.message);
    return res.status(500).json({ message: "Impossible de retirer ce collaborateur." });
  }
};

module.exports = { listProjects, createProject, getProject, getProjectStatus, updateProject, saveFile, importFiles, removeFile, addCollaborator, removeCollaborator };
