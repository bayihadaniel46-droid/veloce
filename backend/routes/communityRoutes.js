const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { listCommunityMessages, sendCommunityMessage, publishCommunityUpdate } = require("../controllers/communityController");

const router = express.Router();
router.use(authMiddleware);
router.get("/messages", listCommunityMessages);
router.post("/messages", sendCommunityMessage);
router.post("/updates", publishCommunityUpdate);

module.exports = router;
