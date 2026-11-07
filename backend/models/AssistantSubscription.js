const mongoose = require("mongoose");

const assistantSubscriptionSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  operationId: { type: String, unique: true, sparse: true },
  status: { type: String, enum: ["pending", "active", "expired"], default: "pending", index: true },
  startsAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null, index: true },
  creditsTotal: { type: Number, default: 5, min: 0 },
  creditsRemaining: { type: Number, default: 5, min: 0 },
  creditsUsed: { type: Number, default: 0, min: 0 },
  usedResearches: [{ type: mongoose.Schema.Types.ObjectId, ref: "AssistantResearch" }]
}, { timestamps: true });

module.exports = mongoose.model("AssistantSubscription", assistantSubscriptionSchema);
