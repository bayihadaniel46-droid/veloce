const mongoose = require("mongoose");

const projectFileSchema = new mongoose.Schema({
  path: { type: String, required: true, maxlength: 180 },
  content: { type: String, default: "", maxlength: 220000 },
  revision: { type: Number, default: 1, min: 1 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const collaboratorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["editor", "viewer"], default: "editor" },
  addedAt: { type: Date, default: Date.now }
}, { _id: false });

const activitySchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, enum: ["created", "file-added", "file-updated", "file-removed", "collaborator-added", "collaborator-removed"], required: true },
  detail: { type: String, default: "", maxlength: 180 },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const projectSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  description: { type: String, default: "", maxlength: 500 },
  visibility: { type: String, enum: ["private", "public"], default: "private", index: true },
  changeVersion: { type: Number, default: 0, min: 0 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  collaborators: { type: [collaboratorSchema], default: [] },
  files: { type: [projectFileSchema], default: [] },
  activity: { type: [activitySchema], default: [] }
}, { timestamps: true });

projectSchema.index({ owner: 1, updatedAt: -1 });
projectSchema.index({ "collaborators.user": 1, updatedAt: -1 });

module.exports = mongoose.model("Project", projectSchema);
