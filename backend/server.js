// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

// CORS: tillat alle origins
app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());

// ── Socket.io ──────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

// Autentiser Socket.io-tilkoblinger
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Ikke autorisert"));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "hemmelig-nøkkel");
    socket.userId = decoded.id;
    socket.userHandle = decoded.handle;
    next();
  } catch (err) {
    next(new Error("Ugyldig token"));
  }
});

io.on("connection", (socket) => {
  console.log(`Socket tilkoblet: ${socket.userHandle} (${socket.userId})`);

  // Brukeren joiner sin egen kanal for private events
  socket.join(`user:${socket.userId}`);

  socket.on("disconnect", () => {
    console.log(`Socket frakoblet: ${socket.userHandle}`);
  });
});

// Gjør io tilgjengelig for routes
app.set("io", io);

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use("/api/auth",          require("./routes/auth-google"));
app.use("/api/auth",          require("./routes/auth"));
app.use("/api/posts",         require("./routes/posts"));
app.use("/api/users",         require("./routes/users"));
app.use("/api/upload",        require("./routes/upload"));
app.use("/api/messages",      require("./routes/messages"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/search",        require("./routes/search"));
app.use("/api/admin",         require("./routes/admin"));

// Sidevisning-tracking (1x1 pixel)
const pool = require("./db/pool");
app.get("/api/t", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  const ua = req.headers["user-agent"] || "";
  const page = req.query.p || "/";
  const referrer = req.query.r || "";
  pool.query("INSERT INTO page_views (page, ip, user_agent, referrer) VALUES ($1, $2, $3, $4)", [page, ip, ua, referrer])
    .catch(err => console.error("PV error:", err.message));
  res.set("Cache-Control", "no-cache, no-store");
  res.set("Content-Type", "image/gif");
  res.send(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));
});

// Sidevisning-stats
app.get("/api/views", (req, res) => {
  pool.query(`
    SELECT
      (SELECT COUNT(*) FROM page_views) as total,
      (SELECT COUNT(*) FROM page_views WHERE created_at > NOW() - INTERVAL '1 day') as today,
      (SELECT COUNT(*) FROM page_views WHERE created_at > NOW() - INTERVAL '7 days') as week,
      (SELECT COUNT(DISTINCT ip) FROM page_views WHERE created_at > NOW() - INTERVAL '7 days') as unique_week
  `).then(r => res.json(r.rows[0])).catch(() => res.json({}));
});

// Helsesjekk
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "HelpTruth API v2", timestamp: new Date().toISOString() });
});

app.use((req, res) => res.status(404).json({ error: `Ikke funnet: ${req.method} ${req.path}` }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Intern serverfeil" });
});

server.listen(PORT, () => {
  console.log(`HelpTruth API v2 kjører på port ${PORT}`);
});
