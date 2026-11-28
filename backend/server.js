const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const { Readable } = require("stream");

const connectDB =
  require("./config/db");

const postRoutes =
  require("./routes/postRoutes");

const authRoutes =
  require("./routes/authRoutes");

const userRoutes =
  require("./routes/userRoutes");

const notificationRoutes =
  require("./routes/notificationRoutes");

const messageRoutes =
  require("./routes/messageRoutes");

const assistantRoutes =
  require("./routes/assistantRoutes");

const clanRoutes = require("./routes/clanRoutes");
const marketRoutes = require("./routes/marketRoutes");
const callRoutes = require("./routes/callRoutes");
const communityRoutes = require("./routes/communityRoutes");
const pushRoutes = require("./routes/pushRoutes");
const carrefourRoutes = require("./routes/carrefourRoutes");
const gameRoutes = require("./routes/gameRoutes");
const adminRoutes = require("./routes/adminRoutes");
const pistonConsoleRoutes = require("./routes/pistonConsoleRoutes");
const { settleExpiredVotes } = require("./controllers/clanVoteController");
const { ensureAllPizWallets } = require("./services/pizEconomy");

dotenv.config({ path: path.resolve(__dirname, ".env") });

connectDB()
  .then(() => ensureAllPizWallets())
  .catch((error) => console.error("Initialisation des portefeuilles Piz impossible :", error.message));

const app = express();

app.use(cors());

app.use(express.json({ limit: "3mb" }));

const marketApiOrigin = String(process.env.MARKETPLACE_API_URL || (process.env.NODE_ENV === "production" ? "https://forgemarket.onrender.com" : "http://localhost:4300")).replace(/\/+$/, "");
const forgeMarketProxy = (upstreamPrefix, routePrefix) => async (req, res) => {
  try {
    const suffix = req.originalUrl.slice(routePrefix.length);
    const target = new URL(`${upstreamPrefix}${suffix}`, `${marketApiOrigin}/`);
    const headers = new Headers();
    for (const name of ["accept", "accept-language", "content-type", "cookie", "if-none-match", "range", "user-agent"]) {
      const value = req.get(name);
      if (value) headers.set(name, value);
    }
    const hasBody = !["GET", "HEAD"].includes(req.method);
    const isJson = Boolean(req.is("application/json"));
    const body = !hasBody ? undefined : isJson ? JSON.stringify(req.body || {}) : req;
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      ...(body === req ? { duplex: "half" } : {}),
      redirect: "manual",
      signal: AbortSignal.timeout(120000)
    });
    res.status(upstream.status);
    for (const name of ["cache-control", "content-disposition", "content-range", "content-type", "etag", "last-modified", "accept-ranges", "location"]) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    const cookies = upstream.headers.getSetCookie?.() || [];
    if (cookies.length) res.setHeader("Set-Cookie", cookies.map((cookie) => {
      const withoutDomain = cookie.replace(/;\s*Domain=[^;]+/i, "");
      return /;\s*Path=/i.test(withoutDomain)
        ? withoutDomain.replace(/;\s*Path=[^;]+/i, "; Path=/api/forge-market")
        : `${withoutDomain}; Path=/api/forge-market`;
    }));
    const contentType = upstream.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = await upstream.json().catch(() => ({}));
      const publicOrigin = `${String(req.get("x-forwarded-proto") || req.protocol).split(",")[0]}://${String(req.get("x-forwarded-host") || req.get("host") || "localhost").split(",")[0]}`;
      const rewrite = (value) => {
        if (Array.isArray(value)) return value.map(rewrite);
        if (value && typeof value === "object") {
          const next = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewrite(item)]));
          if (typeof next.redirectUrl === "string") {
            try {
              const redirect = new URL(next.redirectUrl);
              if (redirect.searchParams.has("marketplace_return")) {
                const callback = new URL("/forge-market/", publicOrigin);
                callback.searchParams.set("piz_callback", "1");
                redirect.searchParams.set("marketplace_return", callback.toString());
                next.redirectUrl = redirect.toString();
              }
            } catch { /* Conserve la réponse si l’URL renvoyée est mal formée. */ }
          }
          return next;
        }
        if (typeof value === "string" && value.startsWith("/uploads/")) return `/api/forge-market/uploads${value.slice("/uploads".length)}`;
        if (typeof value === "string" && value.startsWith("/api/")) return `/api/forge-market${value.slice(4)}`;
        return value;
      };
      return res.json(rewrite(payload));
    }
    if (!upstream.body) return res.end();
    return Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    console.error("ForgeMarket proxy unavailable:", error.message);
    if (!res.headersSent) return res.status(502).json({ message: "La boutique Marketplace ne répond pas pour le moment. Réessaie dans un instant." });
    return res.end();
  }
};

app.use("/api/forge-market/uploads", forgeMarketProxy("/uploads", "/api/forge-market/uploads"));
app.use("/api/forge-market/download", forgeMarketProxy("/api/download", "/api/forge-market/download"));
app.use("/api/forge-market", forgeMarketProxy("/api", "/api/forge-market"));


/* ============================================================
   ROUTES
============================================================ */

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/posts",
  postRoutes
);

app.use(
  "/api/users",
  userRoutes
);

app.use(
  "/api/notifications",
  notificationRoutes
);

app.use(
  "/api/messages",
  messageRoutes
);

app.use(
  "/api/assistant",
  assistantRoutes
);

app.use("/api/clans", clanRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/carrefour", carrefourRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/console", pistonConsoleRoutes);
app.use("/api/projects", require("./routes/projectRoutes"));

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "veloce-api",
    integrations: {
      tavilyConfigured: Boolean(process.env.TAVILY_API_KEY?.trim()),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      pizMarketConfigured: Boolean(process.env.PIZ_SERVICE_KEY?.trim())
    }
  });
});

const frontendDist = path.resolve(__dirname, "../frontend/dist");
const forgeMarketDist = path.join(frontendDist, "forge-market");
app.use("/forge-market", express.static(forgeMarketDist, { fallthrough: true, index: "index.html", maxAge: "1h" }), (_req, res, next) => {
  return res.sendFile(path.join(forgeMarketDist, "index.html"), (error) => { if (error) next(error); });
});
app.use(express.static(frontendDist));

// React routes should load the app shell, while unknown API paths remain API 404s.
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
  return res.sendFile(path.join(frontendDist, "index.html"), (error) => {
    if (error) next(error);
  });
});


const PORT =
  process.env.PORT || 4000;

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Serveur lancé sur http://localhost:${PORT}`
    );
  }
);

const voteSettlementTimer = setInterval(() => {
  settleExpiredVotes().catch((error) => console.error("Erreur clôture votes expirés :", error));
}, 60 * 1000);
voteSettlementTimer.unref();
