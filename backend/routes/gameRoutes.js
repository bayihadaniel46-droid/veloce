const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { beginRun, claimGift } = require("../controllers/gameController");

const router = express.Router();

router.post("/runs", authMiddleware, beginRun);
router.post("/runs/:runId/gift", authMiddleware, claimGift);

module.exports = router;
