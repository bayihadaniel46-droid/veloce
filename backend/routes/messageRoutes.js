const express = require("express");

const {
  getConversations,
  getUnreadCount,
  getMessages,
  sendMessage,
  deleteMessage
} =
  require("../controllers/messageController");

const authMiddleware =
  require("../middleware/authMiddleware");

const router = express.Router();


router.get(
  "/",
  authMiddleware,
  getConversations
);


router.get(
  "/unread-count",
  authMiddleware,
  getUnreadCount
);

router.get(
  "/:userId",
  authMiddleware,
  getMessages
);

router.delete(
  "/:messageId",
  authMiddleware,
  deleteMessage
);


router.post(
  "/:userId",
  authMiddleware,
  sendMessage
);


module.exports = router;
