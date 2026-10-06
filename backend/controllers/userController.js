const User = require("../models/User");
const Follow = require("../models/Follow");
const Notification = require("../models/Notification");
const Post = require("../models/Post");
const crypto = require("crypto");
const { getPizActivity, PIZ_REWARD_RATES, CLAN_CREATION_COST } = require("../services/pizEconomy");


/* ============================================================
   RECHERCHE UTILISATEURS
============================================================ */

const searchUsers = async (req, res) => {
  try {
    const q = req.query.q?.trim() || "";

    if (!q) {
      return res.json([]);
    }

    // Treat user input literally: regex metacharacters must not break search.
    const escapedQuery = q.slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const users = await User.find({
      $or: [
        {
          username: {
            $regex: escapedQuery,
            $options: "i"
          }
        },
        {
          email: {
            $regex: escapedQuery,
            $options: "i"
          }
        }
      ]
    })
      .select("-password")
      .limit(20);

    const currentUserId =
      req.user?.userId;

    let followingIds = [];

    if (currentUserId) {
      const follows = await Follow.find({
        follower: currentUserId
      }).select("following");

      followingIds = follows.map(
        (item) =>
          item.following.toString()
      );
    }

    const result = users.map((user) => ({
      id: user._id,
      username: user.username,
      avatar: user.avatar,
      bio: user.bio,
      isFollowing:
        followingIds.includes(
          user._id.toString()
        )
    }));

    res.json(result);

  } catch (error) {
    console.error(
      "Erreur recherche utilisateurs :",
      error
    );

    res.status(500).json({
      message:
        "Erreur lors de la recherche."
    });
  }
};


/* ============================================================
   SUGGESTIONS D'UTILISATEURS
============================================================ */

const getSuggestions = async (
  req,
  res
) => {
  try {
    const currentUserId =
      req.user.userId;

    const follows = await Follow.find({
      follower: currentUserId
    }).select("following");

    const excludedIds = [
      currentUserId,
      ...follows.map(
        (item) =>
          item.following
      )
    ];

    const users = await User.find({
      _id: {
        $nin: excludedIds
      }
    })
      .select("-password")
      .sort({
        createdAt: -1
      })
      .limit(5);

    res.json(
      users.map((user) => ({
        id: user._id,
        username: user.username,
        avatar: user.avatar,
        bio: user.bio
      }))
    );

  } catch (error) {
    console.error(
      "Erreur suggestions :",
      error
    );

    res.status(500).json({
      message:
        "Impossible de charger les suggestions."
    });
  }
};


/* ============================================================
   SUIVRE / NE PLUS SUIVRE
============================================================ */

const toggleFollow = async (
  req,
  res
) => {
  try {
    const follower =
      req.user.userId;

    const following =
      req.params.userId;

    if (
      follower.toString() ===
      following.toString()
    ) {
      return res.status(400).json({
        message:
          "Tu ne peux pas te suivre toi-même."
      });
    }

    const userToFollow =
      await User.findById(
        following
      );

    if (!userToFollow) {
      return res.status(404).json({
        message:
          "Utilisateur introuvable."
      });
    }

    const existingFollow =
      await Follow.findOne({
        follower,
        following
      });

    if (existingFollow) {
      await Follow.deleteOne({
        _id: existingFollow._id
      });

      return res.json({
        following: false
      });
    }

    await Follow.create({
      follower,
      following
    });

    const sender =
      await User.findById(
        follower
      );

    if (sender) {
      await Notification.create({
        recipient: following,
        sender: follower,
        type: "follow",
        message:
          `${sender.username} a commencé à te suivre.`
      });
    }

    res.json({
      following: true
    });

  } catch (error) {
    console.error(
      "Erreur follow :",
      error
    );

    res.status(500).json({
      message:
        "Erreur lors du suivi."
    });
  }
};


/* ============================================================
   STATISTIQUES UTILISATEUR
============================================================ */

const getUserStats = async (
  req,
  res
) => {
  try {
    const userId =
      req.user.userId;

    const user = await User.findById(userId).select("username referralCode activeSeconds createdAt pizAccountId");

    if (!user) {
      return res.status(404).json({
        message:
          "Utilisateur introuvable."
      });
    }

    if (!user.referralCode) {
      user.referralCode = `PIZ-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
      await user.save();
    }
    const [activity, followersCount, followingCount] = await Promise.all([
      getPizActivity(userId, Math.max(0, user.activeSeconds || 0)),
      Follow.countDocuments({ following: userId }),
      Follow.countDocuments({ follower: userId })
    ]);
    const activeSeconds = Math.max(0, user.activeSeconds || 0);
    const { postsCount, likesCount, commentsCount, messagesCount, clansManagedCount, referralsCount, pizBalance } = activity;

    res.json({
      postsCount,
      likesCount,
      commentsCount,
      messagesCount,
      clansManagedCount,
      referralsCount,
      activeSeconds,
      referralCode: user.referralCode,
      pizBalance,
      pizAccountId: user.pizAccountId ? String(user.pizAccountId) : "",
      pizRates: PIZ_REWARD_RATES,
      clanCreationCost: CLAN_CREATION_COST,
      followersCount,
      followingCount
    });

  } catch (error) {
    console.error(
      "Erreur statistiques :",
      error
    );

    res.status(500).json({
      message:
        "Erreur statistiques."
    });
  }
};

const recordActivityHeartbeat = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("lastActivityPing");
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable." });
    const now = new Date();
    const previous = user.lastActivityPing;
    const elapsed = previous ? Math.floor((now.getTime() - previous.getTime()) / 1000) : 0;
    const credited = elapsed > 0 && elapsed <= 90 ? elapsed : 0;
    const filter = previous
      ? { _id: user._id, lastActivityPing: previous }
      : { _id: user._id, lastActivityPing: { $exists: false } };
    await User.updateOne(filter, { $inc: { activeSeconds: credited }, $set: { lastActivityPing: now } });
    return res.json({ success: true });
  } catch (error) {
    console.error("Erreur suivi temps actif :", error);
    return res.status(500).json({ message: "Impossible d’enregistrer l’activité." });
  }
};

const linkPizAccount = async (req, res) => {
  try {
    const pizUserId = String(req.body?.pizUserId || "").trim();
    const pizPassword = String(req.body?.pizPassword || "");
    if (!/^[a-f0-9]{24}$/i.test(pizUserId) || !pizPassword) return res.status(400).json({ message: "Saisis l’ID personnel et le mot de passe de ton compte PIZ." });
    const user = await User.findById(req.user?.userId).select("_id username activeSeconds pizAccountId");
    if (!user) return res.status(404).json({ message: "Compte Veloce introuvable." });
    const apiUrl = String(process.env.PIZ_API_URL || "").replace(/\/$/, "");
    if (!apiUrl || !process.env.PIZ_SERVICE_KEY) return res.status(503).json({ message: "La connexion au service PIZ n’est pas configurée." });
    const proofResponse = await fetch(`${apiUrl}/api/wallet/internal/veloce/link-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-piz-service-key": process.env.PIZ_SERVICE_KEY },
      body: JSON.stringify({ pizUserId, password: pizPassword })
    });
    const proof = await proofResponse.json().catch(() => ({}));
    if (!proofResponse.ok) return res.status(proofResponse.status).json({ message: proof.message || "Vérification du compte PIZ refusée." });
    const activity = await getPizActivity(user._id, user.activeSeconds);
    const response = await fetch(`${apiUrl}/api/wallet/internal/veloce/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-piz-service-key": process.env.PIZ_SERVICE_KEY },
      body: JSON.stringify({ pizUserId, veloceUserId: String(user._id), legacyUserId: String(user._id), username: user.username, totalPiz: Number(activity.pizBalance) })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status).json({ message: result.message || "PIZ n’a pas accepté la synchronisation." });
    user.pizAccountId = pizUserId;
    await user.save();
    return res.json({ connected: true, pizUserId, synchronizedPiz: result.synchronizedPiz, balance: result.balance });
  } catch (error) {
    console.error("Erreur liaison compte PIZ :", error.message);
    return res.status(500).json({ message: "Impossible de synchroniser les actifs avec PIZ." });
  }
};


const getPublicUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select("username avatar bio createdAt");
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable." });

    const [followersCount, followingCount, postsCount, relation] = await Promise.all([
      Follow.countDocuments({ following: user._id }),
      Follow.countDocuments({ follower: user._id }),
      Post.countDocuments({ author: user._id }),
      Follow.exists({ follower: req.user.userId, following: user._id })
    ]);

    return res.json({
      user,
      stats: { followersCount, followingCount, postsCount },
      isFollowing: Boolean(relation)
    });
  } catch (error) {
    console.error("Erreur profil public :", error);
    return res.status(500).json({ message: "Impossible de charger ce profil." });
  }
};

module.exports = {
  searchUsers,
  getSuggestions,
  toggleFollow,
  getUserStats,
  recordActivityHeartbeat,
  getPublicUserProfile,
  linkPizAccount
};
