const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { listClans, createClan, addClanMembers, listClanMessages, openClanMessage, sendClanMessage } = require("../controllers/clanController");

const router = express.Router();
router.use(authMiddleware);
router.get("/", listClans);
router.post("/", createClan);
router.post("/:clanId/members", addClanMembers);
router.get("/:clanId/messages", listClanMessages);
router.post("/:clanId/messages", sendClanMessage);
router.post("/:clanId/messages/:messageId/open", openClanMessage);

module.exports = router;
