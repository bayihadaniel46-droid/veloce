const express = require("express");
const { getConsoleStatus, sendCommunityAnnouncement } = require("../controllers/pistonConsoleController");
const verifyPistonConsoleKey = require("../middleware/pistonConsoleKey");

const router = express.Router();
router.use(verifyPistonConsoleKey);
router.get("/status", getConsoleStatus);
router.post("/announcements", sendCommunityAnnouncement);

module.exports = router;
