const mongoose = require("mongoose");

const clanRatingSchema = new mongoose.Schema({
  clan: { type: mongoose.Schema.Types.ObjectId, ref: "Clan", required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  review: { type: String, trim: true, maxlength: 500, default: "" }
}, { timestamps: true });

clanRatingSchema.index({ clan: 1, user: 1 }, { unique: true });
module.exports = mongoose.model("ClanRating", clanRatingSchema);
