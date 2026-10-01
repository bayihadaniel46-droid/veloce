const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

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

dotenv.config({ path: path.resolve(__dirname, ".env") });

connectDB();

const app = express();

app.use(cors());

app.use(express.json({ limit: "512kb" }));


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

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "veloce-api",
    integrations: {
      tavilyConfigured: Boolean(process.env.TAVILY_API_KEY?.trim()),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      marketDataConfigured: Boolean(process.env.TWELVE_DATA_API_KEY?.trim())
    }
  });
});

const frontendDist = path.resolve(__dirname, "../frontend/dist");
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
