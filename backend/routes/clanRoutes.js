const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { listClans, createClan, addClanMembers, listClanMessages, openClanMessage, sendClanMessage } = require("../controllers/clanController");
const { listVotes, createVote, castVote } = require("../controllers/clanVoteController");
const { parseMessageFiles } = require("../middleware/messageUploads");

const router = express.Router();
router.use(authMiddleware);
router.get("/", listClans);
router.post("/", createClan);
router.post("/:clanId/members", addClanMembers);
router.get("/:clanId/votes", listVotes);
router.post("/:clanId/votes", createVote);
router.post("/:clanId/votes/:voteId/cast", castVote);
router.get("/:clanId/messages", listClanMessages);
router.post("/:clanId/messages", parseMessageFiles, sendClanMessage);
router.post("/:clanId/messages/:messageId/open", openClanMessage);

module.exports = router;
