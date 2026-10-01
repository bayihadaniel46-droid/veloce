const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { getMarketTrends } = require("../controllers/marketController");

const router = express.Router();
router.get("/trends", authMiddleware, getMarketTrends);
module.exports = router;
