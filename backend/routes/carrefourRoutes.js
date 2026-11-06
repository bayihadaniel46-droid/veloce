const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { getCarrefour, createStatus, createAnonymousPost, revealAnonymousAuthor } = require("../controllers/carrefourController");

const router = express.Router();
router.use(authMiddleware);
router.get("/", getCarrefour);
router.post("/status", createStatus);
router.post("/anonymous", createAnonymousPost);
router.post("/anonymous/:itemId/reveal", revealAnonymousAuthor);

module.exports = router;
