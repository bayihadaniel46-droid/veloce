const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Post = require("../models/Post");
const AssistantProfile = require("../models/AssistantProfile");

// ============================================================
// CRÉER UN TOKEN JWT
// ============================================================

const createToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
};


// ============================================================
// FORMAT UTILISATEUR
// ============================================================

const formatUser = (user) => {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    avatar: user.avatar || "",
    bio: user.bio || "",
    createdAt: user.createdAt
  };
};


// ============================================================
// INSCRIPTION
// ============================================================

const register = async (req, res) => {
  try {

    const {
      username,
      email,
      password
    } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "Tous les champs sont obligatoires."
      });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanUsername.length < 3) {
      return res.status(400).json({
        message:
          "Le nom d'utilisateur doit contenir au moins 3 caractères."
      });
    }

    if (cleanUsername.length > 30) {
      return res.status(400).json({
        message:
          "Le nom d'utilisateur ne peut pas dépasser 30 caractères."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message:
          "Le mot de passe doit contenir au moins 6 caractères."
      });
    }

    const existingUser = await User.findOne({
      $or: [
        {
          username: cleanUsername
        },
        {
          email: cleanEmail
        }
      ]
    });

    if (existingUser) {

      if (
        existingUser.username.toLowerCase() ===
        cleanUsername.toLowerCase()
      ) {
        return res.status(409).json({
          message:
            "Ce nom d'utilisateur est déjà utilisé."
        });
      }

      return res.status(409).json({
        message:
          "Cette adresse email est déjà utilisée."
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      12
    );

    const user = await User.create({
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword
    });

    // Crée l’espace IA privé avec le nouveau compte.
    await AssistantProfile.create({ owner: user._id });

    const token = createToken(
      user._id.toString()
    );

    return res.status(201).json({
      message:
        "Compte créé avec succès.",

      token,

      user:
        formatUser(user)
    });

  } catch (error) {

    console.error(
      "Erreur inscription :",
      error
    );

    return res.status(500).json({
      message:
        "Erreur lors de la création du compte."
    });
  }
};


// ============================================================
// CONNEXION
// ============================================================

const login = async (req, res) => {
  try {

    const {
      email,
      password
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message:
          "Email et mot de passe obligatoires."
      });
    }

    const cleanEmail =
      email.trim().toLowerCase();

    const user =
      await User.findOne({
        email: cleanEmail
      });

    if (!user) {
      return res.status(401).json({
        message:
          "Email ou mot de passe incorrect."
      });
    }

    const passwordCorrect =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!passwordCorrect) {
      return res.status(401).json({
        message:
          "Email ou mot de passe incorrect."
      });
    }

    const token =
      createToken(
        user._id.toString()
      );

    return res.json({
      message:
        "Connexion réussie.",

      token,

      user:
        formatUser(user)
    });

  } catch (error) {

    console.error(
      "Erreur connexion :",
      error
    );

    return res.status(500).json({
      message:
        "Erreur lors de la connexion."
    });
  }
};


// ============================================================
// UTILISATEUR CONNECTÉ
// ============================================================

const getMe = async (req, res) => {
  try {

    const user =
      await User
        .findById(req.user.userId)
        .select("-password");

    if (!user) {
      return res.status(404).json({
        message:
          "Utilisateur introuvable."
      });
    }

    return res.json({
      user:
        formatUser(user)
    });

  } catch (error) {

    console.error(
      "Erreur récupération utilisateur :",
      error
    );

    return res.status(500).json({
      message:
        "Erreur serveur."
    });
  }
};


// ============================================================
// MODIFIER LE PROFIL
// ============================================================

const updateProfile = async (req, res) => {
  try {

    const {
      username,
      bio,
      avatar
    } = req.body;

    const user =
      await User.findById(
        req.user.userId
      );

    if (!user) {
      return res.status(404).json({
        message:
          "Utilisateur introuvable."
      });
    }

    const previousUsername = user.username;


    // ========================================================
    // USERNAME
    // ========================================================

    if (
      typeof username === "string"
    ) {

      const cleanUsername =
        username.trim();

      if (
        cleanUsername.length < 3
      ) {
        return res.status(400).json({
          message:
            "Le nom d'utilisateur doit contenir au moins 3 caractères."
        });
      }

      if (
        cleanUsername.length > 30
      ) {
        return res.status(400).json({
          message:
            "Le nom d'utilisateur ne peut pas dépasser 30 caractères."
        });
      }

      const usernameExists =
        await User.findOne({
          username: cleanUsername,
          _id: {
            $ne: user._id
          }
        });

      if (usernameExists) {
        return res.status(409).json({
          message:
            "Ce nom d'utilisateur est déjà utilisé."
        });
      }

      user.username =
        cleanUsername;
    }


    // ========================================================
    // BIO
    // ========================================================

    if (
      typeof bio === "string"
    ) {

      const cleanBio =
        bio.trim();

      if (
        cleanBio.length > 160
      ) {
        return res.status(400).json({
          message:
            "La biographie ne peut pas dépasser 160 caractères."
        });
      }

      user.bio =
        cleanBio;
    }


    // ========================================================
    // AVATAR
    // ========================================================

    if (
      typeof avatar === "string"
    ) {
      const cleanAvatar = avatar.trim();
      if (cleanAvatar.length > 200000) {
        return res.status(400).json({ message: "La photo est trop volumineuse. Choisis une image plus légère." });
      }
      if (
        cleanAvatar &&
        !/^(https?:\/\/|\/|data:image\/(png|jpeg|gif|webp);base64,)/i.test(cleanAvatar)
      ) {
        return res.status(400).json({ message: "La photo doit utiliser une adresse HTTP ou HTTPS valide." });
      }
      user.avatar = cleanAvatar;
    }


    await user.save();

    if (previousUsername !== user.username) {
      await Post.updateMany(
        { author: user._id },
        { $set: { username: user.username } }
      );
    }

    return res.json({
      message:
        "Profil mis à jour avec succès.",

      user:
        formatUser(user)
    });

  } catch (error) {

    console.error(
      "Erreur modification profil :",
      error
    );

    if (
      error.code === 11000
    ) {
      return res.status(409).json({
        message:
          "Ce nom d'utilisateur est déjà utilisé."
      });
    }

    return res.status(500).json({
      message:
        "Erreur lors de la modification du profil."
    });
  }
};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  register,
  login,
  getMe,
  updateProfile
};
