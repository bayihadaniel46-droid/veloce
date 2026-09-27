const express = require("express");
const multer = require("multer");

const router = express.Router();

const {
  getPosts,
  createPost,
  getFile,
  likePost,
  explorePosts,
  getTrends,
  getComments,
  createComment,
  verifyPost,
  getUserPosts
} = require("../controllers/postController");

const authMiddleware =
  require("../middleware/authMiddleware");


// ========================================
// MULTER
// ========================================

const upload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      files: 10,

      fileSize:
        20 * 1024 * 1024
    }
  });


// ========================================
// PUBLICATIONS
// ========================================

router.get(
  "/",
  authMiddleware,
  getPosts
);


// ========================================
// EXPLORER
// ========================================

router.get(
  "/explore",
  explorePosts
);


// ========================================
// TENDANCES
// ========================================

router.get(
  "/trends",
  getTrends
);


// ========================================
// FICHIERS
// ========================================

router.get(
  "/files/:id",
  getFile
);


// ========================================
// CRÉER UNE PUBLICATION
// ========================================

router.post(
  "/",
  authMiddleware,
  upload.array(
    "files",
    10
  ),
  createPost
);


// ========================================
// LIKE
// ========================================

router.post(
  "/:id/like",
  authMiddleware,
  likePost
);

// ========================================
// PUBLICATIONS D'UN UTILISATEUR
// ========================================

router.get(
  "/user/:userId",
  getUserPosts
);

// ========================================
// COMMENTAIRES
// ========================================

router.get(
  "/:id/comments",
  getComments
);


router.post(
  "/:id/comments",
  authMiddleware,
  createComment
);


// ========================================
// FACT-CHECKING
// ========================================

router.post(
  "/:id/verify",
  authMiddleware,
  verifyPost
);


module.exports = router;
