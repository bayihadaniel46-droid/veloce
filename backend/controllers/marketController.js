const User = require("../models/User");
const PizTransaction = require("../models/PizTransaction");
const PizReserve = require("../models/PizReserve");
const { fromUnits, toUnits } = require("../services/pizEconomy");

const getMarketTrends = async (_req, res) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5, 1);
    sixMonthsAgo.setHours(0, 0, 0, 0);
    const [walletSummary, reserve, entries] = await Promise.all([
      User.aggregate([
        { $match: { pizWalletInitializedAt: { $ne: null } } },
        { $group: { _id: null, wallets: { $sum: 1 }, balances: { $sum: "$pizBalanceUnits" } } }
      ]),
      PizReserve.findOne({ key: "platform-admin" }).lean(),
      PizTransaction.find({ createdAt: { $gte: sixMonthsAgo }, status: "completed", type: { $ne: "opening-grant" } })
        .select("type amountUnits createdAt")
        .sort({ createdAt: 1 })
        .lean()
    ]);

    const months = new Map();
    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setMonth(date.getMonth() - offset, 1);
      const key = String(date.getFullYear()) + "-" + String(date.getMonth() + 1).padStart(2, "0");
      months.set(key, { month: key, amount: 0, transactions: 0, purchases: 0, purchaseVolumeUnits: 0 });
    }
    const byType = new Map();
    let totalUnits = 0;
    for (const entry of entries) {
      const date = new Date(entry.createdAt);
      const key = String(date.getFullYear()) + "-" + String(date.getMonth() + 1).padStart(2, "0");
      const month = months.get(key);
      if (month) {
        month.amount += Number(entry.amountUnits) || 0;
        month.transactions += 1;
        if (entry.type === "piz-purchase") {
          month.purchases += 1;
          month.purchaseVolumeUnits += Number(entry.amountUnits) || 0;
        }
      }
      const current = byType.get(entry.type) || { type: entry.type, amountUnits: 0, transactions: 0 };
      current.amountUnits += Number(entry.amountUnits) || 0;
      current.transactions += 1;
      byType.set(entry.type, current);
      totalUnits += Number(entry.amountUnits) || 0;
    }
    const currentMonth = [...months.values()].at(-1);
    const threshold = Number(process.env.PIZ_HIGH_VOLUME_PURCHASE_THRESHOLD || 0);
    const configuredRate = threshold > 0
      ? (currentMonth.purchases >= threshold ? 15 : 20)
      : null;

    return res.json({
      source: "Registre interne Piz de Veloce",
      updatedAt: new Date().toISOString(),
      wallets: walletSummary[0]?.wallets || 0,
      userBalances: fromUnits(walletSummary[0]?.balances || 0),
      administrationReserve: fromUnits(reserve?.balanceUnits || 0),
      movementVolumeSixMonths: fromUnits(totalUnits),
      monthly: [...months.values()].map((month) => ({ ...month, amount: fromUnits(month.amount), purchaseVolume: fromUnits(month.purchaseVolumeUnits), purchaseVolumeUnits: undefined })),
      activity: [...byType.values()].map((item) => ({ ...item, amount: fromUnits(item.amountUnits) })).sort((a, b) => b.amount - a.amount),
      reservePricing: {
        highVolumePizPer100Fcfa: 15,
        lowVolumePizPer100Fcfa: 20,
        highVolumePurchaseThreshold: threshold || null,
        currentPizPer100Fcfa: configuredRate,
        currentMonthPurchases: currentMonth.purchases,
        currentMonthPurchaseVolume: fromUnits(currentMonth.purchaseVolumeUnits)
      },
      notes: [
        "Les mouvements affichés sont ceux enregistrés dans Veloce.",
        "Les achats ou échanges réalisés dans l’application PIZ apparaîtront ici quand son API transmettra ces opérations à Veloce."
      ]
    });
  } catch (error) {
    console.error("Erreur tendances Piz :", error.message);
    return res.status(500).json({ message: "Impossible de charger les tendances Piz." });
  }
};

const recordPizPurchase = async (req, res) => {
  const serviceKey = String(process.env.PIZ_SERVICE_KEY || "");
  const providedKey = String(req.get("x-piz-service-key") || "");
  if (!serviceKey || providedKey !== serviceKey) return res.sendStatus(401);
  const eventId = String(req.body?.eventId || "").trim();
  const amount = Number(req.body?.amountPiz);
  if (!eventId || eventId.length > 160 || !Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
    return res.status(400).json({ message: "Identifiant d’événement ou montant Piz invalide." });
  }
  try {
    const transaction = await PizTransaction.create({
      operationId: "piz-external-purchase:" + eventId,
      type: "piz-purchase",
      fromUser: req.body?.buyerUserId || null,
      amountUnits: toUnits(amount),
      description: "Achat Piz enregistré par l’application PIZ",
      status: "completed",
      metadata: { currency: String(req.body?.currency || "FCFA").slice(0, 12), fiatAmount: Number(req.body?.fiatAmount) || null }
    });
    return res.status(201).json({ recorded: true, transactionId: transaction._id });
  } catch (error) {
    if (error.code === 11000) return res.json({ recorded: true, duplicate: true });
    console.error("Erreur enregistrement achat Piz externe :", error.message);
    return res.status(500).json({ message: "Impossible d’enregistrer cet achat Piz." });
  }
};

module.exports = { getMarketTrends, recordPizPurchase };
