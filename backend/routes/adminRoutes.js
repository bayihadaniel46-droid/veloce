const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireVeloceAdmin } = require("../utils/adminAccess");
const {
  getAdminOverview,
  listMembers,
  listPosts,
  listClans,
  listPizTransactions,
  suspendMember,
  restoreMember,
  listAccountAppeals,
  reviewAccountAppeal,
  listAdminAuditLog
} = require("../controllers/adminController");

const router = express.Router();

router.use(authMiddleware, requireVeloceAdmin);
router.get("/overview", getAdminOverview);
router.get("/members", listMembers);
router.get("/posts", listPosts);
router.get("/clans", listClans);
router.get("/piz-transactions", listPizTransactions);
router.post("/members/:userId/suspension", suspendMember);
router.post("/members/:userId/restore", restoreMember);
router.get("/appeals", listAccountAppeals);
router.patch("/appeals/:appealId", reviewAccountAppeal);
router.get("/audit-log", listAdminAuditLog);

module.exports = router;
