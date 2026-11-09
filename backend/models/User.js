const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    communityRulesAcceptedAt: { type: Date, default: null },
    termsAcceptedAt: { type: Date, default: null },
    privacyAcknowledgedAt: { type: Date, default: null },

    password: {
      type: String,
      required: true
    },

    accountStatus: { type: String, enum: ["active", "suspended"], default: "active", index: true },
    suspensionReason: { type: String, default: "", maxlength: 1000 },
    suspendedAt: { type: Date, default: null },
    suspendedUntil: { type: Date, default: null },
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    avatar: {
      type: String,
      default: ""
    },

    bio: {
      type: String,
      default: ""
    },
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],
    referralCode: { type: String, unique: true, sparse: true, index: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    activeSeconds: { type: Number, default: 0, min: 0 },
    pizSpent: { type: Number, default: 0, min: 0 },
    // Wallet values are stored in millionths of a PIZ to support half-PIZ splits.
    pizBalanceUnits: { type: Number, default: null, min: 0 },
    pizWalletInitializedAt: { type: Date, default: null },
    pizRewardCheckpoint: { type: Number, default: null, min: 0 },
    gameRewardDay: { type: String, default: "", index: true },
    gameRewardUnits: { type: Number, default: 0, min: 0 },
    fullKeyboardUntil: { type: Date, default: null },
    lastActivityPing: { type: Date },
    pizAccountId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);
