const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  {
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },

    originalName: {
      type: String,
      required: true
    },

    filename: {
      type: String,
      required: true
    },

    mimetype: {
      type: String,
      required: true
    },

    size: {
      type: Number,
      required: true
    },

    url: {
      type: String,
      required: true
    }
  },
  {
    _id: false
  }
);

const verificationSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: [
        "true",
        "false",
        "unverified"
      ],
      default: null
    },

    summary: {
      type: String,
      default: ""
    },

    sources: {
      type: [
        {
          title: String,
          url: String,
          snippet: String
        }
      ],
      default: []
    },

    checkedAt: {
      type: Date,
      default: null
    }
  },
  {
    _id: false
  }
);

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    username: {
      type: String,
      required: true
    },

    content: {
      type: String,
      required: false,
      trim: true,
      default: ""
    },

    attachments: {
      type: [attachmentSchema],
      default: []
    },

    likes: {
      type: Number,
      default: 0
    },

    comments: {
      type: Number,
      default: 0
    },

    reposts: {
      type: Number,
      default: 0
    },

    verification: {
      type: verificationSchema,
      default: null
    },

    createdAt: {
      type: Date,
      default: Date.now
    }
  }
);

module.exports = mongoose.model(
  "Post",
  postSchema
);