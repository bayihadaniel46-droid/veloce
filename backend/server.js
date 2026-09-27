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

dotenv.config({ path: path.resolve(__dirname, ".env") });

connectDB();

const app = express();

app.use(cors());

app.use(express.json());


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

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "veloce-api" });
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
