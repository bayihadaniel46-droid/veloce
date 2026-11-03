const mongoose = require("mongoose");

const callEventSchema = new mongoose.Schema({
  sequence: { type: Number, required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["offer", "answer", "ice"], required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const callSessionSchema = new mongoose.Schema({
  caller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  mode: { type: String, enum: ["audio", "video"], default: "audio" },
  status: { type: String, enum: ["ringing", "active", "declined", "ended"], default: "ringing", index: true },
  events: { type: [callEventSchema], default: [] },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true });

callSessionSchema.index({ recipient: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("CallSession", callSessionSchema);
