const mongoose = require("mongoose");

const communityMessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  kind: { type: String, enum: ["message", "announcement", "ad"], default: "message", index: true },
  content: { type: String, required: true, trim: true, maxlength: 3000 }
}, { timestamps: true });

communityMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model("CommunityMessage", communityMessageSchema);
