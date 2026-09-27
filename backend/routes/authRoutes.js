const express = require("express");

const {
  register,
  login,
  getMe,
  updateProfile
} = require("../controllers/authController");

const authMiddleware =
  require("../middleware/authMiddleware");

const router =
  express.Router();


// ============================================================
// INSCRIPTION
// ============================================================

router.post(
  "/register",
  register
);


// ============================================================
// CONNEXION
// ============================================================

router.post(
  "/login",
  login
);


// ============================================================
// UTILISATEUR CONNECTÉ
// ============================================================

router.get(
  "/me",
  authMiddleware,
  getMe
);


// ============================================================
// MODIFIER LE PROFIL
// ============================================================

router.put(
  "/profile",
  authMiddleware,
  updateProfile
);


module.exports = router;