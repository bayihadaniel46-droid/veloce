const mongoose = require("mongoose");

const clanKnowledgePurchaseSchema = new mongoose.Schema({
  document: { type: mongoose.Schema.Types.ObjectId, ref: "ClanKnowledgeDocument", required: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amountUnits: { type: Number, required: true, min: 1 }
}, { timestamps: true });

clanKnowledgePurchaseSchema.index({ document: 1, buyer: 1 }, { unique: true });
module.exports = mongoose.model("ClanKnowledgePurchase", clanKnowledgePurchaseSchema);
