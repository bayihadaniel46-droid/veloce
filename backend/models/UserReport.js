const mongoose = require("mongoose");

const userReportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  category: { type: String, enum: ["harassment", "spam", "impersonation", "inappropriate", "other"], required: true },
  details: { type: String, default: "", maxlength: 800 },
  status: { type: String, enum: ["open", "reviewing", "resolved"], default: "open", index: true }
}, { timestamps: true });

userReportSchema.index({ reporter: 1, reportedUser: 1, createdAt: -1 });

module.exports = mongoose.model("UserReport", userReportSchema);
