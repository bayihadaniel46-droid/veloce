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
const { getMyPizTransactions, hideMyPizReceipt } = require("../controllers/pizController");
const { listBlockedUsers } = require("../controllers/safetyController");
const messagingSafety = require("../controllers/messagingSafetyController");
const { deleteMyAccount } = require("../controllers/accountController");
const { submitContentReport, listContentReports, reviewContentReport } = require("../controllers/contentModerationController");
const { getCommunityRulesStatus, acceptCommunityRules } = require("../controllers/communityRulesController");
const { getMyAccountAppeals, submitAccountAppeal } = require("../controllers/accountAppealController");

const router = express.Router();

router.get("/account-appeals/me", authMiddleware, getMyAccountAppeals);
router.post("/account-appeals", authMiddleware, submitAccountAppeal);
router.delete("/me", authMiddleware, deleteMyAccount);
router.get("/community-rules", authMiddleware, getCommunityRulesStatus);
router.post("/community-rules/accept", authMiddleware, acceptCommunityRules);
router.post("/content-reports", authMiddleware, submitContentReport);
router.get("/moderation/content-reports", authMiddleware, listContentReports);
router.patch("/moderation/content-reports/:reportId", authMiddleware, reviewContentReport);

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

router.get("/piz-transactions", authMiddleware, getMyPizTransactions);
router.delete("/piz-transactions/:transactionId", authMiddleware, hideMyPizReceipt);
router.get("/blocked", authMiddleware, listBlockedUsers);
router.get("/temporary-access", authMiddleware, messagingSafety.getTemporaryInvitations);
router.post("/:userId/temporary-access", authMiddleware, messagingSafety.createTemporaryInvitation);
router.post("/temporary-access/:invitationId/respond", authMiddleware, messagingSafety.respondTemporaryInvitation);
router.post("/:userId/block", authMiddleware, messagingSafety.blockUser);
router.delete("/:userId/block", authMiddleware, messagingSafety.unblockUser);
router.post("/:userId/report", authMiddleware, messagingSafety.reportUser);
router.post("/:userId/warn", authMiddleware, messagingSafety.warnUser);

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
