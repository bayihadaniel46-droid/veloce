const jwt = require("jsonwebtoken");
const User = require("../models/User");

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

    // Ajouter les informations de l'utilisateur
    req.user = decoded;

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