const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireVeloceAdmin } = require("../utils/adminAccess");
const { getAdminOverview, listMembers, listPosts, listClans, listPizTransactions } = require("../controllers/adminController");

const router = express.Router();

router.use(authMiddleware, requireVeloceAdmin);
router.get("/overview", getAdminOverview);
router.get("/members", listMembers);
router.get("/posts", listPosts);
router.get("/clans", listClans);
router.get("/piz-transactions", listPizTransactions);

module.exports = router;
