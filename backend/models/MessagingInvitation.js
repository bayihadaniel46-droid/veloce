const mongoose = require("mongoose");

const messagingInvitationSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["conversation", "clan"], required: true },
  clan: { type: mongoose.Schema.Types.ObjectId, ref: "Clan", default: null },
  durationHours: { type: Number, enum: [1, 6, 24, 72, 168], required: true },
  status: { type: String, enum: ["pending", "accepted", "declined", "expired"], default: "pending", index: true },
  invitationExpiresAt: { type: Date, required: true },
  accessExpiresAt: { type: Date, default: null }
}, { timestamps: true });

messagingInvitationSchema.index({ recipient: 1, status: 1, createdAt: -1 });
messagingInvitationSchema.index({ sender: 1, recipient: 1, type: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("MessagingInvitation", messagingInvitationSchema);
