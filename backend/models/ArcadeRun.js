const mongoose = require("mongoose");

const arcadeRunSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  gameKey: { type: String, enum: ["emoji-rush"], required: true },
  rewardStatus: { type: String, enum: ["pending", "claiming", "claimed", "no-reward", "unavailable"], default: "pending", index: true },
  score: { type: Number, default: 0, min: 0 },
  giftCount: { type: Number, default: 0, min: 0 },
  rewardUnits: { type: Number, default: 0, min: 0 },
  completedAt: { type: Date, default: null }
}, { timestamps: true });

arcadeRunSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("ArcadeRun", arcadeRunSchema);
