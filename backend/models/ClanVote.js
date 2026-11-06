const mongoose = require("mongoose");
const optionSchema = new mongoose.Schema({ key: { type: String, required: true }, label: { type: String, required: true, maxlength: 100 }, votes: { type: Number, default: 0, min: 0 } }, { _id: false });
const ballotSchema = new mongoose.Schema({
  voter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  option: { type: String, required: true },
  amountUnits: { type: Number, required: true, min: 1 }
}, { _id: false });
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
  ballots: { type: [ballotSchema], default: [] },
  stakesUnits: { type: Number, default: 0, min: 0 },
  settlementStartedAt: { type: Date, default: null },
  settledAt: { type: Date, default: null },
  status: { type: String, enum: ["open", "settling", "closed"], default: "open" },
  result: { type: String, default: null }
}, { timestamps: true });
module.exports = mongoose.model("ClanVote", clanVoteSchema);
