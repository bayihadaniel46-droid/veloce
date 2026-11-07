const mongoose = require("mongoose");

const clanAssistantKnowledgeSchema = new mongoose.Schema({
  clan: { type: mongoose.Schema.Types.ObjectId, ref: "Clan", required: true, index: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  topic: { type: String, required: true, trim: true, maxlength: 80, index: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  summary: { type: String, required: true, trim: true, maxlength: 500 },
  content: { type: String, required: true, trim: true, maxlength: 12000 },
  published: { type: Boolean, default: true, index: true },
  usageCount: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

clanAssistantKnowledgeSchema.index({ published: 1, topic: 1, createdAt: -1 });
module.exports = mongoose.model("ClanAssistantKnowledge", clanAssistantKnowledgeSchema);
