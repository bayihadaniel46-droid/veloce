const User = require("../models/User");
const Post = require("../models/Post");
const Like = require("../models/Like");
const Comment = require("../models/comment");
const Message = require("../models/Message");
const Clan = require("../models/Clan");

// Small participation rewards; clan creation also pays 0.80 PIZ and awards
// 1 PIZ after it succeeds (net +0.20 PIZ for an eligible account).
const PIZ_REWARD_RATES = Object.freeze({
  activeHour: 0.005,
  post: 0.01,
  like: 0.0002,
  comment: 0.002,
  message: 0.0002,
  clan: 1,
  referral: 0.1
});
const CLAN_CREATION_COST = 0.8;

const getPizActivity = async (userId, activeSeconds) => {
  const [postsCount, likesCount, commentsCount, messagesCount, clansManagedCount, referralsCount, account] = await Promise.all([
    Post.countDocuments({ author: userId }),
    Like.countDocuments({ userId }),
    Comment.countDocuments({ userId }),
    Message.countDocuments({ sender: userId }),
    Clan.countDocuments({ owner: userId }),
    User.countDocuments({ referredBy: userId }),
    User.findById(userId).select("pizSpent")
  ]);
  const seconds = Number.isFinite(Number(activeSeconds)) ? Math.max(0, Number(activeSeconds)) : 0;
  const generatedPiz = Math.round((
    seconds / 3600 * PIZ_REWARD_RATES.activeHour +
    postsCount * PIZ_REWARD_RATES.post +
    likesCount * PIZ_REWARD_RATES.like +
    commentsCount * PIZ_REWARD_RATES.comment +
    messagesCount * PIZ_REWARD_RATES.message +
    clansManagedCount * PIZ_REWARD_RATES.clan +
    referralsCount * PIZ_REWARD_RATES.referral
  ) * 1000000) / 1000000;
  const pizSpent = Number(account?.pizSpent) || 0;
  const pizBalance = Math.round(Math.max(0, generatedPiz - pizSpent) * 1000000) / 1000000;
  return { postsCount, likesCount, commentsCount, messagesCount, clansManagedCount, referralsCount, pizBalance, generatedPiz, pizSpent };
};

module.exports = { PIZ_REWARD_RATES, CLAN_CREATION_COST, getPizActivity };
