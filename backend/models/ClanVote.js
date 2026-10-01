const mongoose = require("mongoose");
const optionSchema = new mongoose.Schema({ key: { type: String, required: true }, label: { type: String, required: true, maxlength: 100 }, votes: { type: Number, default: 0, min: 0 } }, { _id: false });
const clanVoteSchema = new mongoose.Schema({
  clan: { type: mongoose.Schema.Types.ObjectId, ref: "Clan", required: true, index: true },
  proposer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true, maxlength: 140 },
  kind: { type: String, enum: ["leader", "rank"], required: true },
  target: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  options: { type: [optionSchema], required: true },
  eligibleVoters: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  votedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  closesAt: { type: Date, required: true },
  status: { type: String, enum: ["open", "closed"], default: "open" },
  result: { type: String, default: null }
}, { timestamps: true });
module.exports = mongoose.model("ClanVote", clanVoteSchema);
