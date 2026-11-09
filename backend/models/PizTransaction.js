const mongoose = require("mongoose");

const pizTransactionSchema = new mongoose.Schema({
  operationId: { type: String, unique: true, sparse: true, index: true },
  type: { type: String, required: true, index: true },
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  fromClan: { type: mongoose.Schema.Types.ObjectId, ref: "Clan", default: null, index: true },
  toClan: { type: mongoose.Schema.Types.ObjectId, ref: "Clan", default: null, index: true },
  hiddenForUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  amountUnits: { type: Number, required: true, min: 1 },
  platformUnits: { type: Number, default: 0, min: 0 },
  description: { type: String, default: "", maxlength: 240 },
  status: { type: String, enum: ["pending", "completed", "failed"], default: "pending", index: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

pizTransactionSchema.index({ status: 1, createdAt: -1 });
module.exports = mongoose.model("PizTransaction", pizTransactionSchema);
