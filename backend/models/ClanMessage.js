const mongoose = require("mongoose");

const clanMessageSchema = new mongoose.Schema({
  clan: { type: mongoose.Schema.Types.ObjectId, ref: "Clan", required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  content: { type: String, required: true, trim: true, maxlength: 5000 },
  signed: { type: Boolean, default: false },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "ClanMessage", default: null },
  openedBy: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], default: [] }
}, { timestamps: true });

clanMessageSchema.index({ clan: 1, createdAt: 1 });
module.exports = mongoose.model("ClanMessage", clanMessageSchema);
