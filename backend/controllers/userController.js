const User = require("../models/User");
const Follow = require("../models/Follow");
const Notification = require("../models/Notification");
const Post = require("../models/Post");
const Like = require("../models/Like");
const Comment = require("../models/comment");
const Message = require("../models/Message");
const Clan = require("../models/Clan");
const crypto = require("crypto");


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

    const user = await User.findById(userId).select("username referralCode activeSeconds createdAt");

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
    const [postsCount, likesCount, commentsCount, messagesCount, clansManagedCount, referralsCount, followersCount, followingCount] = await Promise.all([
      Post.countDocuments({ author: userId }),
      Like.countDocuments({ userId }),
      Comment.countDocuments({ userId }),
      Message.countDocuments({ sender: userId }),
      Clan.countDocuments({ owner: userId }),
      User.countDocuments({ referredBy: userId }),
      Follow.countDocuments({ following: userId }),
      Follow.countDocuments({ follower: userId })
    ]);
    const activeSeconds = Math.max(0, user.activeSeconds || 0);
    const pizBalance = Math.round((activeSeconds / 3600 * 0.5 + postsCount * 2 + likesCount * 0.1 + commentsCount * 0.5 + messagesCount * 0.1 + clansManagedCount * 10 + referralsCount * 25) * 100) / 100;

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
  getPublicUserProfile
};
