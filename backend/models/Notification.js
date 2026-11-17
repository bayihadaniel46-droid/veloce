const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    type: {
      type: String,
      enum: [
        "like",
        "follow",
        "warning",
        "announcement"
      ],
      required: true
    },

    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null
    },

    message: {
      type: String,
      required: true
    },

    title: {
      type: String,
      default: "",
      maxlength: 100
    },

    read: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "Notification",
  notificationSchema
);
