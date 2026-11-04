const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { getPublicKey, saveSubscription, removeSubscription } = require("../controllers/pushController");

const router = express.Router();

router.get("/vapid-public-key", getPublicKey);
router.post("/subscriptions", authMiddleware, saveSubscription);
router.delete("/subscriptions", authMiddleware, removeSubscription);

module.exports = router;
