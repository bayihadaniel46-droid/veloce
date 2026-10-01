const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema({
  fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  originalName: { type: String, required: true, maxlength: 180 },
  filename: { type: String, required: true, maxlength: 180 },
  mimetype: { type: String, required: true, maxlength: 120 },
  size: { type: Number, required: true },
  url: { type: String, required: true }
}, { _id: false });

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    content: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000
    },

    attachments: { type: [attachmentSchema], default: [] },

    read: {
      type: Boolean,
      default: false
    },

    deletedFor: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: []
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "Message",
  messageSchema
);
