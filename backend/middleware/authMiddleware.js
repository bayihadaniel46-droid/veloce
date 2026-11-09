const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { isVeloceAdmin } = require("../utils/adminAccess");

const authMiddleware = async (req, res, next) => {

  try {

    // Récupérer le header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Accès non autorisé."
      });
    }

    // Vérifier le format :
    // Authorization: Bearer TOKEN
    const parts = authHeader.split(" ");

    if (
      parts.length !== 2 ||
      parts[0] !== "Bearer"
    ) {
      return res.status(401).json({
        message: "Token invalide."
      });
    }

    const token = parts[1];

    // Vérifier le token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const account = await User.findById(decoded.userId).select("accountStatus suspensionReason suspendedAt suspendedUntil suspendedBy");
    if (!account) return res.status(401).json({ message: "Compte introuvable. Reconnecte-toi." });

    if (account.accountStatus === "suspended" && account.suspendedUntil && account.suspendedUntil <= new Date()) {
      await User.updateOne({ _id: account._id, accountStatus: "suspended" }, {
        $set: { accountStatus: "active", suspensionReason: "", suspendedAt: null, suspendedUntil: null, suspendedBy: null }
      });
      account.accountStatus = "active";
      account.suspensionReason = "";
      account.suspendedUntil = null;
    }

    const isSuspended = account.accountStatus === "suspended" && (!account.suspendedUntil || account.suspendedUntil > new Date());
    const path = req.originalUrl.split("?")[0];
    const allowedSuspensionRequest = (
      (req.method === "GET" && (path.endsWith("/auth/me") || path.endsWith("/users/account-appeals/me"))) ||
      (req.method === "POST" && path.endsWith("/users/account-appeals"))
    );
    if (isSuspended && !isVeloceAdmin(decoded.userId) && !allowedSuspensionRequest) {
      return res.status(403).json({
        code: "ACCOUNT_SUSPENDED",
        message: "Ce compte est temporairement suspendu.",
        account: {
          accountStatus: account.accountStatus,
          suspensionReason: account.suspensionReason,
          suspendedAt: account.suspendedAt,
          suspendedUntil: account.suspendedUntil
        }
      });
    }

    // Ajouter les informations de l'utilisateur
    req.user = decoded;
    req.account = account;

    next();

  } catch (error) {

    console.error(
      "Erreur authentification :",
      error.message
    );

    return res.status(401).json({
      message: "Session invalide ou expirée."
    });
  }
};

module.exports = authMiddleware;
