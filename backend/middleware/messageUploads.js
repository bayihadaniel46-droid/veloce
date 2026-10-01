const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 4, fileSize: 8 * 1024 * 1024 }
});

const parseMessageFiles = (req, res, next) => upload.array("files", 4)(req, res, (error) => {
  if (!error) return next();
  const message = error.code === "LIMIT_FILE_SIZE"
    ? "Chaque fichier doit faire 8 Mo maximum."
    : error.code === "LIMIT_FILE_COUNT"
      ? "Tu peux joindre jusqu’à 4 fichiers par message."
      : "Impossible de traiter les fichiers joints.";
  return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ message });
});

module.exports = { parseMessageFiles };
