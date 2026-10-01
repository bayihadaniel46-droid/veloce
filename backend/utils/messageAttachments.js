const mongoose = require("mongoose");

const PRIVATE_BUCKET_NAME = "velocePrivateMessages";
const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: PRIVATE_BUCKET_NAME });

const uploadMessageFiles = async (files, userId) => {
  const saved = [];
  const store = bucket();
  try {
    for (const file of files || []) {
      const originalName = String(file.originalname || "fichier").replace(/[\r\n\0]/g, "").slice(0, 180) || "fichier";
      const stream = store.openUploadStream(originalName, {
        contentType: file.mimetype || "application/octet-stream",
        metadata: { uploadedBy: String(userId), purpose: "private-message" }
      });
      await new Promise((resolve, reject) => {
        stream.once("finish", resolve);
        stream.once("error", reject);
        stream.end(file.buffer);
      });
      saved.push({
        fileId: stream.id,
        originalName,
        filename: originalName,
        mimetype: file.mimetype || "application/octet-stream",
        size: file.size,
        url: `/api/messages/files/${stream.id}`
      });
    }
    return saved;
  } catch (error) {
    await Promise.allSettled(saved.map((file) => store.delete(file.fileId)));
    throw error;
  }
};

const deleteMessageFiles = async (files) => {
  const store = bucket();
  await Promise.allSettled((files || []).map((file) => store.delete(file.fileId)));
};

module.exports = { uploadMessageFiles, deleteMessageFiles, PRIVATE_BUCKET_NAME };
