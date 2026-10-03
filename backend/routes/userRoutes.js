const express = require("express");

const {
  searchUsers,
  getSuggestions,
  toggleFollow,
  getUserStats,
  recordActivityHeartbeat,
  getPublicUserProfile,
  createPizLinkCode,
  exchangePizLinkCode
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

router.post("/piz-link/code", authMiddleware, createPizLinkCode);
router.post("/piz-link/exchange", exchangePizLinkCode);


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
