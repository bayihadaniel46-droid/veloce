const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { getIncomingCalls, startCall, getCall, updateCall, sendCallEvent } = require("../controllers/callController");

const router = express.Router();
router.use(authMiddleware);
router.get("/incoming", getIncomingCalls);
router.post("/", startCall);
router.get("/:callId", getCall);
router.post("/:callId/status", updateCall);
router.post("/:callId/events", sendCallEvent);

module.exports = router;
