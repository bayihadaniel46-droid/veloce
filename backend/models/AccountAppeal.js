const mongoose = require("mongoose");

const accountAppealSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  reason: { type: String, required: true, maxlength: 2000 },
  status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending", index: true },
  submittedAt: { type: Date, default: Date.now, index: true },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  decisionNote: { type: String, default: "", maxlength: 1000 }
}, { timestamps: true });

accountAppealSchema.index({ user: 1, status: 1, submittedAt: -1 });
accountAppealSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });

module.exports = mongoose.model("AccountAppeal", accountAppealSchema);
