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

    password: {
      type: String,
      required: true
    },

    avatar: {
      type: String,
      default: ""
    },

    bio: {
      type: String,
      default: ""
    },
    referralCode: { type: String, unique: true, sparse: true, index: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    activeSeconds: { type: Number, default: 0, min: 0 },
    pizSpent: { type: Number, default: 0, min: 0 },
    lastActivityPing: { type: Date },
    pizAccountId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);
