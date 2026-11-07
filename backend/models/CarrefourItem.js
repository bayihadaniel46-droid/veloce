const mongoose = require("mongoose");

const carrefourItemSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  content: { type: String, required: true, trim: true, maxlength: 3000 },
  clanProtected: { type: Boolean, default: false, index: true },
  allowIdentityReveal: { type: Boolean, default: false, index: true },
  revealedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
}, { timestamps: true });

module.exports = mongoose.model("CarrefourItem", carrefourItemSchema);
