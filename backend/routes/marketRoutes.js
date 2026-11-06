const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { getMarketTrends, recordPizPurchase } = require("../controllers/marketController");

const router = express.Router();
router.get("/trends", authMiddleware, getMarketTrends);
router.post("/piz-events/purchase", recordPizPurchase);
module.exports = router;
