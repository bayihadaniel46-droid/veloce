const PizTransaction = require("../models/PizTransaction");

const UNITS_PER_PIZ = 1_000_000;

const getMyPizTransactions = async (req, res) => {
  try {
    const userId = String(req.user.userId);
    const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit || "25", 10) || 25));
    const query = {
      status: { $in: ["completed", "failed"] },
      $or: [{ fromUser: userId }, { toUser: userId }]
    };
    const [transactions, total] = await Promise.all([
      PizTransaction.find(query)
        .populate("fromUser", "username")
        .populate("toUser", "username")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PizTransaction.countDocuments(query)
    ]);

    const entries = transactions.map((transaction) => {
      const outgoing = String(transaction.fromUser?._id || transaction.fromUser || "") === userId;
      const incoming = String(transaction.toUser?._id || transaction.toUser || "") === userId;
      const amountUnits = outgoing
        ? Number(transaction.amountUnits || 0)
        : Math.max(0, Number(transaction.amountUnits || 0) - Number(transaction.platformUnits || 0));
      const counterparty = outgoing ? transaction.toUser : transaction.fromUser;
      return {
        id: String(transaction._id),
        type: transaction.type,
        description: transaction.description || "Mouvement Piz",
        direction: outgoing ? "outgoing" : incoming ? "incoming" : "neutral",
        amount: amountUnits / UNITS_PER_PIZ,
        fee: Number(transaction.platformUnits || 0) / UNITS_PER_PIZ,
        status: transaction.status,
        counterparty: counterparty?.username || "",
        createdAt: transaction.createdAt
      };
    });

    return res.json({ entries, page, limit, total, hasMore: page * limit < total });
  } catch (error) {
    console.error("Historique Piz :", error.message);
    return res.status(500).json({ message: "Impossible de charger l’historique Piz." });
  }
};

module.exports = { getMyPizTransactions };
