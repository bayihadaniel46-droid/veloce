const mongoose = require("mongoose");

const sourceSchema = new mongoose.Schema({
  document: { type: mongoose.Schema.Types.ObjectId, ref: "ClanAssistantKnowledge", required: true },
  clan: { type: mongoose.Schema.Types.ObjectId, ref: "Clan", required: true }
}, { _id: false });

const assistantResearchSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: "AssistantSubscription", required: true },
  requestId: { type: String, required: true },
  query: { type: String, default: "", maxlength: 200 },
  topics: [{ type: String }],
  sources: { type: [sourceSchema], default: [] },
  creditDebited: { type: Boolean, default: false },
  status: { type: String, enum: ["pending", "completed", "failed"], default: "pending", index: true },
  completedAt: { type: Date, default: null }
}, { timestamps: true });

assistantResearchSchema.index({ owner: 1, requestId: 1 }, { unique: true });
module.exports = mongoose.model("AssistantResearch", assistantResearchSchema);
