const mongoose = require("mongoose");

const likeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Un utilisateur ne peut liker une publication qu'une seule fois.
likeSchema.index(
  {
    userId: 1,
    postId: 1
  },
  {
    unique: true
  }
);

module.exports = mongoose.model(
  "Like",
  likeSchema
);