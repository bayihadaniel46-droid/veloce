const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { listCommunityMessages, sendCommunityMessage, publishCommunityUpdate, listCommunityGuides, unlockCommunityGuide } = require("../controllers/communityController");

const router = express.Router();
router.use(authMiddleware);
router.get("/guides", listCommunityGuides);
router.post("/guides/:guideId/unlock", unlockCommunityGuide);
router.get("/messages", listCommunityMessages);
router.post("/messages", sendCommunityMessage);
router.post("/updates", publishCommunityUpdate);

module.exports = router;
