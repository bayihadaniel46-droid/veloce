const mongoose = require("mongoose");

const communityGuidePurchaseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  guideId: { type: String, required: true },
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: "PizTransaction", default: null }
}, { timestamps: true });

communityGuidePurchaseSchema.index({ user: 1, guideId: 1 }, { unique: true });

module.exports = mongoose.model("CommunityGuidePurchase", communityGuidePurchaseSchema);
