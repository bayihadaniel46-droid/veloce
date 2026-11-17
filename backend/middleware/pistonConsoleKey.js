const { createHash, timingSafeEqual } = require("crypto");

const verifyPistonConsoleKey = (req, res, next) => {
  const configured = String(process.env.PISTON_CONSOLE_API_KEY || "").trim();
  if (!configured) return res.status(503).json({ message: "Le connecteur Piston Console n’est pas configuré sur ce service." });
  const supplied = String(req.get("x-piston-console-key") || "");
  const expectedDigest = createHash("sha256").update(configured).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  if (!supplied || !timingSafeEqual(expectedDigest, suppliedDigest)) {
    return res.status(401).json({ message: "La clé d’accès Piston Console est invalide." });
  }
  return next();
};

module.exports = verifyPistonConsoleKey;
