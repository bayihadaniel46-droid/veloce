const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireVeloceAdmin } = require("../utils/adminAccess");
const { getAdminOverview } = require("../controllers/adminController");

const router = express.Router();

router.use(authMiddleware, requireVeloceAdmin);
router.get("/overview", getAdminOverview);

module.exports = router;
