const mongoose = require("mongoose");
const User = require("../models/User");
const Post = require("../models/Post");
const Comment = require("../models/comment");
const Like = require("../models/Like");
const Follow = require("../models/Follow");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const UserStatus = require("../models/UserStatus");
const CarrefourItem = require("../models/CarrefourItem");
const Clan = require("../models/Clan");
const ClanMessage = require("../models/ClanMessage");
const ClanVote = require("../models/ClanVote");
const ClanRating = require("../models/ClanRating");
const ClanKnowledgeDocument = require("../models/ClanKnowledgeDocument");
const ClanKnowledgePurchase = require("../models/ClanKnowledgePurchase");
const ClanAssistantKnowledge = require("../models/ClanAssistantKnowledge");
const CommunityMessage = require("../models/CommunityMessage");
const CommunityGuidePurchase = require("../models/CommunityGuidePurchase");
const AssistantResearch = require("../models/AssistantResearch");
const AssistantSubscription = require("../models/AssistantSubscription");
const AssistantDraft = require("../models/AssistantDraft");
const AssistantProfile = require("../models/AssistantProfile");
const CallSession = require("../models/CallSession");
const PushSubscription = require("../models/PushSubscription");
const PizTransaction = require("../models/PizTransaction");
const UserReport = require("../models/UserReport");
const ContentReport = require("../models/ContentReport");
const { PRIVATE_BUCKET_NAME } = require("../utils/messageAttachments");

const collectAttachmentIds = (documents = []) => documents.flatMap((document) =>
  (document.attachments || []).map((attachment) => attachment.fileId).filter(Boolean)
);

const removeGridFsFiles = async (bucketName, fileIds) => {
  const uniqueIds = [...new Map(fileIds.map((id) => [String(id), id])).values()];
  if (!uniqueIds.length || !mongoose.connection.db) return;
  const files = await mongoose.connection.db.collection(`${bucketName}.files`)
    .find({ _id: { $in: uniqueIds } }, { projection: { _id: 1 } }).toArray();
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName });
  await Promise.all(files.map((file) => bucket.delete(file._id)));
};

const deleteMyAccount = async (req, res) => {
  if (req.body?.confirmation !== "SUPPRIMER") {
    return res.status(400).json({ message: "Confirme la suppression en envoyant le mot SUPPRIMER." });
  }

  const userId = new mongoose.Types.ObjectId(req.user.userId);
  try {
    const user = await User.findById(userId).select("_id");
    if (!user) return res.status(404).json({ message: "Ce compte n’existe déjà plus." });

    const ownedClans = await Clan.find({ owner: userId });
    const cannotTransferTreasury = ownedClans.some((clan) => {
      const hasSuccessor = [...(clan.administrators || []), ...(clan.members || [])]
        .some((memberId) => String(memberId) !== String(userId));
      return !hasSuccessor && Number(clan.treasuryUnits || 0) > 0;
    });
    if (cannotTransferTreasury) {
      return res.status(409).json({ message: "Transfère d’abord la direction ou les fonds de ton dernier clan avant de supprimer ton compte." });
    }

    const [posts, privateMessages, clanMessages, authoredClanDocuments, userComments, userLikes] = await Promise.all([
      Post.find({ author: userId }).select("_id attachments"),
      Message.find({ $or: [{ sender: userId }, { recipient: userId }] }).select("attachments"),
      ClanMessage.find({ sender: userId }).select("_id attachments"),
      ClanKnowledgeDocument.find({ author: userId }).select("_id"),
      Comment.find({ userId }).select("postId"),
      Like.find({ userId }).select("postId")
    ]);
    const authoredPostIds = posts.map((post) => post._id);

    const emptyClanIds = [];
    for (const clan of ownedClans) {
      const successor = [...(clan.administrators || []), ...(clan.members || [])]
        .find((memberId) => String(memberId) !== String(userId));
      if (successor) {
        clan.owner = successor;
        clan.administrators = [...new Set([...(clan.administrators || []).map(String), String(successor)])]
          .filter((memberId) => memberId !== String(userId));
        await clan.save();
      } else {
        emptyClanIds.push(clan._id);
      }
    }

    if (emptyClanIds.length) {
      const clanDocuments = await ClanKnowledgeDocument.find({ clan: { $in: emptyClanIds } }).select("_id");
      const clanDocumentIds = [...new Set([...clanDocuments, ...authoredClanDocuments].map((document) => String(document._id)))];
      await Promise.all([
        ClanMessage.deleteMany({ clan: { $in: emptyClanIds } }),
        ClanVote.deleteMany({ clan: { $in: emptyClanIds } }),
        ClanRating.deleteMany({ clan: { $in: emptyClanIds } }),
        ClanKnowledgeDocument.deleteMany({ _id: { $in: clanDocumentIds } }),
        ClanKnowledgePurchase.deleteMany({ document: { $in: clanDocumentIds } }),
        ClanAssistantKnowledge.deleteMany({ clan: { $in: emptyClanIds } }),
        Clan.deleteMany({ _id: { $in: emptyClanIds } })
      ]);
    } else if (authoredClanDocuments.length) {
      const authoredDocumentIds = authoredClanDocuments.map((document) => document._id);
      await Promise.all([
        ClanKnowledgePurchase.deleteMany({ document: { $in: authoredDocumentIds } }),
        ClanKnowledgeDocument.deleteMany({ _id: { $in: authoredDocumentIds } })
      ]);
    }

    const commentCountsByPost = userComments.reduce((counts, comment) => {
      const postId = String(comment.postId);
      counts.set(postId, (counts.get(postId) || 0) + 1);
      return counts;
    }, new Map());
    const commentCountUpdates = [...commentCountsByPost].map(([postId, amount]) => ({
      updateOne: { filter: { _id: postId, comments: { $gte: amount } }, update: { $inc: { comments: -amount } } }
    }));
    if (commentCountUpdates.length) await Post.bulkWrite(commentCountUpdates);
    const likedPostIds = [...new Set(userLikes.map((like) => String(like.postId)))];
    if (likedPostIds.length) await Post.updateMany({ _id: { $in: likedPostIds }, likes: { $gt: 0 } }, { $inc: { likes: -1 } });

    await Promise.all([
      Post.deleteMany({ author: userId }),
      Comment.deleteMany({ postId: { $in: authoredPostIds } }),
      Like.deleteMany({ postId: { $in: authoredPostIds } }),
      Comment.deleteMany({ userId }),
      Like.deleteMany({ userId }),
      Follow.deleteMany({ $or: [{ follower: userId }, { following: userId }] }),
      Message.deleteMany({ $or: [{ sender: userId }, { recipient: userId }] }),
      Notification.deleteMany({ $or: [{ sender: userId }, { recipient: userId }] }),
      UserStatus.deleteMany({ author: userId }),
      CarrefourItem.deleteMany({ author: userId }),
      CarrefourItem.updateMany({ revealedBy: userId }, { $pull: { revealedBy: userId } }),
      ClanMessage.deleteMany({ sender: userId }),
      ClanMessage.updateMany({ replyTo: { $in: clanMessages.map((message) => message._id) } }, { $set: { replyTo: null } }),
      ClanMessage.updateMany({}, { $pull: { recipients: userId, openedBy: userId, revealedBy: userId } }),
      ClanVote.deleteMany({ $or: [{ proposer: userId }, { voter: userId }, { target: userId }] }),
      ClanVote.updateMany({}, { $pull: { eligibleVoters: userId, votedBy: userId } }),
      ClanVote.updateMany({}, { $set: { "ballots.$[ballot].voter": null } }, { arrayFilters: [{ "ballot.voter": userId }] }),
      ClanRating.deleteMany({ user: userId }),
      ClanKnowledgePurchase.deleteMany({ buyer: userId }),
      ClanAssistantKnowledge.deleteMany({ author: userId }),
      CommunityMessage.deleteMany({ sender: userId }),
      CommunityGuidePurchase.deleteMany({ user: userId }),
      AssistantResearch.deleteMany({ owner: userId }),
      AssistantSubscription.deleteMany({ owner: userId }),
      AssistantDraft.deleteMany({ owner: userId }),
      AssistantProfile.deleteMany({ owner: userId }),
      CallSession.deleteMany({ $or: [{ sender: userId }, { caller: userId }, { recipient: userId }] }),
      PushSubscription.deleteMany({ user: userId }),
      Clan.updateMany({}, {
        $pull: {
          members: userId,
          administrators: userId,
          moderators: userId,
          membershipRequests: { user: userId },
          rankAssignments: { user: userId }
        }
      }),
      Clan.updateMany({ "membershipRequests.reviewedBy": userId }, { $set: { "membershipRequests.$[request].reviewedBy": null } }, { arrayFilters: [{ "request.reviewedBy": userId }] }),
      User.updateMany({ referredBy: userId }, { $set: { referredBy: null } }),
      User.updateMany({ blockedUsers: userId }, { $pull: { blockedUsers: userId } }),
      PizTransaction.updateMany({ $or: [{ fromUser: userId }, { toUser: userId }] }, {
        $set: { fromUser: null, toUser: null },
        $pull: { hiddenForUsers: userId }
      }),
      UserReport.updateMany({ $or: [{ reporter: userId }, { reportedUser: userId }] }, {
        $set: { reporter: null, reportedUser: null, details: "" }
      }),
      ContentReport.updateMany({ $or: [{ reporter: userId }, { contentOwner: userId }] }, {
        $set: { reporter: null, contentOwner: null, details: "" }
      })
    ]);

    await Promise.all([
      removeGridFsFiles("veloceFiles", collectAttachmentIds(posts)),
      removeGridFsFiles(PRIVATE_BUCKET_NAME, [...collectAttachmentIds(privateMessages), ...collectAttachmentIds(clanMessages)])
    ]);

    await User.deleteOne({ _id: userId });
    return res.json({ deleted: true, message: "Le compte et les données personnelles associées ont été supprimés." });
  } catch (error) {
    console.error("Suppression du compte impossible :", error.message);
    return res.status(500).json({ message: "La suppression n’a pas pu être terminée. Réessaie ou contacte le support." });
  }
};

module.exports = { deleteMyAccount };
