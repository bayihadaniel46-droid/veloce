const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const requireCommunityRules = require("../middleware/requireCommunityRules");
const { getCarrefour, createStatus, createAnonymousPost, revealAnonymousAuthor } = require("../controllers/carrefourController");

const router = express.Router();
router.use(authMiddleware);
router.get("/", getCarrefour);
router.post("/status", requireCommunityRules, createStatus);
router.post("/anonymous", requireCommunityRules, createAnonymousPost);
router.post("/anonymous/:itemId/reveal", revealAnonymousAuthor);

module.exports = router;
