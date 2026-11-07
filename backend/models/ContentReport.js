const mongoose = require("mongoose");

const contentReportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  contentType: { type: String, enum: ["post", "comment", "carrefour", "message", "clan-message", "community-message"], required: true, index: true },
  contentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  contentOwner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  category: { type: String, enum: ["harassment", "hate", "sexual", "violence", "spam", "fraud", "privacy", "other"], required: true },
  details: { type: String, default: "", maxlength: 800 },
  status: { type: String, enum: ["open", "reviewing", "resolved"], default: "open", index: true }
}, { timestamps: true });

contentReportSchema.index({ reporter: 1, contentType: 1, contentId: 1, createdAt: -1 });

module.exports = mongoose.model("ContentReport", contentReportSchema);
