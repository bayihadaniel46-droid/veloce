const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  requestedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
}, { _id: false });

const rankSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["subchief", "secretary", "envoy"], required: true },
  assignedAt: { type: Date, default: Date.now }
}, { _id: false });

const clanSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  description: { type: String, trim: true, maxlength: 240, default: "" },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  administrators: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  membershipPolicy: { type: String, enum: ["open", "approval"], default: "approval" },
  membershipRequests: { type: [requestSchema], default: [] },
  rankAssignments: { type: [rankSchema], default: [] },
  strategy: { type: String, trim: true, maxlength: 2000, default: "" },
  policyText: { type: String, trim: true, maxlength: 3000, default: "" },
  contributionCaps: {
    chef: { type: Number, default: 0, min: 0, max: 100000 },
    subchief: { type: Number, default: 0, min: 0, max: 100000 },
    secretary: { type: Number, default: 0, min: 0, max: 100000 },
    envoy: { type: Number, default: 0, min: 0, max: 100000 },
    member: { type: Number, default: 0, min: 0, max: 100000 }
  },
  treasuryUnits: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

module.exports = mongoose.model("Clan", clanSchema);
