const express = require("express");

const {
  searchUsers,
  getSuggestions,
  toggleFollow,
  getUserStats,
  recordActivityHeartbeat,
  getPublicUserProfile,
  linkPizAccount,
  unlockFullKeyboard
} = require("../controllers/userController");

const authMiddleware =
  require("../middleware/authMiddleware");

const router = express.Router();


router.get(
  "/search",
  authMiddleware,
  searchUsers
);


router.get(
  "/suggestions",
  authMiddleware,
  getSuggestions
);


router.get(
  "/stats",
  authMiddleware,
  getUserStats
);

router.post("/heartbeat", authMiddleware, recordActivityHeartbeat);

router.post("/piz-link", authMiddleware, linkPizAccount);
router.post("/full-keyboard", authMiddleware, unlockFullKeyboard);


router.get(
  "/:userId",
  authMiddleware,
  getPublicUserProfile
);

router.post(
  "/:userId/follow",
  authMiddleware,
  toggleFollow
);


module.exports = router;
