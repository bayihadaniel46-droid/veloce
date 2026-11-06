const mongoose = require("mongoose");

const pizReserveSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: "platform-admin" },
  balanceUnits: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

module.exports = mongoose.model("PizReserve", pizReserveSchema);
