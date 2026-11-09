const listFromEnv = (name) => String(process.env[name] || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const isVeloceAdmin = (userId) => listFromEnv("COMMUNITY_ADMIN_IDS").includes(String(userId));

const isVeloceModerator = (userId) => (
  isVeloceAdmin(userId) || listFromEnv("VELOCE_MODERATOR_IDS").includes(String(userId))
);

const requireVeloceAdmin = (req, res, next) => {
  if (!isVeloceAdmin(req.user?.userId)) {
    return res.status(403).json({ message: "Accès réservé à l’administration de Veloce." });
  }
  return next();
};

module.exports = { isVeloceAdmin, isVeloceModerator, requireVeloceAdmin };
