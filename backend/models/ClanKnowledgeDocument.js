const mongoose = require("mongoose");

const clanKnowledgeDocumentSchema = new mongoose.Schema({
  clan: { type: mongoose.Schema.Types.ObjectId, ref: "Clan", required: true, index: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  summary: { type: String, required: true, trim: true, maxlength: 500 },
  content: { type: String, required: true, trim: true, maxlength: 20000 },
  priceUnits: { type: Number, required: true, min: 1 },
  published: { type: Boolean, default: true, index: true },
  purchaseCount: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

module.exports = mongoose.model("ClanKnowledgeDocument", clanKnowledgeDocumentSchema);
