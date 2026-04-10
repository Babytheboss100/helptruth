// routes/auth.js
// Registrering og innlogging

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "hemmelig-nøkkel";

// ── REGISTRERING ──────────────────────────────────────────────────────────
// POST /api/auth/register
// Body: { name, handle, email, password }
router.post("/register", async (req, res) => {
  const { name, handle, email, password } = req.body;

  // Validering
  if (!name || !handle || !email || !password) {
    return res.status(400).json({ error: "Alle felt er påkrevd" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Passord må være minst 8 tegn" });
  }
  if (handle.length < 3 || !/^[a-zA-Z0-9_]+$/.test(handle)) {
    return res.status(400).json({ error: "Handle kan bare inneholde bokstaver, tall og _" });
  }

  try {
    // Sjekk om handle eller email allerede er tatt
    const existing = await pool.query(
      "SELECT id FROM users WHERE handle = $1 OR email = $2",
      [handle.toLowerCase(), email.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Handle eller e-post er allerede i bruk" });
    }

    // Krypter passordet (aldri lagre passord i klartekst!)
    // bcrypt lager en "hash" som er umulig å reversere
    const hashedPassword = await bcrypt.hash(password, 10);

    // Lag initialer fra navn (eks: "Heljar Vindvik" → "HV")
    const avatar = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

    // Tilfeldig farge fra et utvalg
    const colors = ["#1a6b4a", "#0e4f8a", "#7b2d8b", "#c0392b", "#d35400", "#2980b9"];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    // Lagre i databasen
    const result = await pool.query(
      `INSERT INTO users (name, handle, email, password, avatar, avatar_color)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, handle, email, avatar, avatar_color, verified`,
      [name, handle.toLowerCase(), email.toLowerCase(), hashedPassword, avatar, avatarColor]
    );

    const user = result.rows[0];

    // Lag JWT token (gyldig i 7 dager)
    const token = jwt.sign(
      { id: user.id, handle: user.handle },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({ user, token });

  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Serverfeil" });
  }
});

// ── INNLOGGING ────────────────────────────────────────────────────────────
// POST /api/auth/login
// Body: { email, password }
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "E-post og passord er påkrevd" });
  }

  try {
    // Finn brukeren
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Feil e-post eller passord" });
    }

    const user = result.rows[0];

    // Sammenlign passord med lagret hash
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Feil e-post eller passord" });
    }

    // Lag ny token
    const token = jwt.sign(
      { id: user.id, handle: user.handle },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Ikke send passordet tilbake!
    delete user.password;

    res.json({ user, token });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Serverfeil" });
  }
});

// ── HENT INNLOGGET BRUKER ─────────────────────────────────────────────────
// GET /api/auth/me  (krever token)
const auth = require("../middleware/auth");

router.get("/me", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, handle, email, bio, avatar, avatar_color, profile_image, verified, followers_count, following_count, posts_count FROM users WHERE id = $1",
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Bruker ikke funnet" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Serverfeil" });
  }
});

module.exports = router;
