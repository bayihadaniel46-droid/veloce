const mongoose = require("mongoose");

const adminAuditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  actorUsername: { type: String, required: true, maxlength: 30 },
  action: { type: String, required: true, maxlength: 64, index: true },
  targetType: { type: String, required: true, maxlength: 32, index: true },
  targetId: { type: String, default: "", maxlength: 80, index: true },
  targetLabel: { type: String, default: "", maxlength: 140 },
  reason: { type: String, default: "", maxlength: 1000 },
  details: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

adminAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AdminAuditLog", adminAuditLogSchema);
