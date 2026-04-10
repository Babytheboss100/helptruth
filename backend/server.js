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
app.use("/api/auth",          require("./routes/auth"));
app.use("/api/posts",         require("./routes/posts"));
app.use("/api/users",         require("./routes/users"));
app.use("/api/upload",        require("./routes/upload"));
app.use("/api/messages",      require("./routes/messages"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/search",        require("./routes/search"));
app.use("/api/admin",         require("./routes/admin"));

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
