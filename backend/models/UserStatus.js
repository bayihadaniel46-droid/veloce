const mongoose = require("mongoose");

const userStatusSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  content: { type: String, required: true, trim: true, maxlength: 500 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: true });

module.exports = mongoose.model("UserStatus", userStatusSchema);
