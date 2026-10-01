const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema({
  fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  originalName: { type: String, required: true, maxlength: 180 },
  filename: { type: String, required: true, maxlength: 180 },
  mimetype: { type: String, required: true, maxlength: 120 },
  size: { type: Number, required: true },
  url: { type: String, required: true }
}, { _id: false });

const clanMessageSchema = new mongoose.Schema({
  clan: { type: mongoose.Schema.Types.ObjectId, ref: "Clan", required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  content: { type: String, default: "", trim: true, maxlength: 5000 },
  attachments: { type: [attachmentSchema], default: [] },
  signed: { type: Boolean, default: false },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "ClanMessage", default: null },
  openedBy: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], default: [] }
}, { timestamps: true });

clanMessageSchema.index({ clan: 1, createdAt: 1 });
module.exports = mongoose.model("ClanMessage", clanMessageSchema);
