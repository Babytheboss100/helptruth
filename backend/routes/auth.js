// routes/auth.js
// Registrering, innlogging og e-postverifisering

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const pool = require("../db/pool");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "hemmelig-nøkkel";

// Analytics helper
function logEvent(event, email, req) {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  const ua = req.headers["user-agent"] || "";
  pool.query("INSERT INTO analytics (event, email, ip, user_agent) VALUES ($1, $2, $3, $4)", [event, email, ip, ua])
    .catch(err => console.error("Analytics log error:", err.message));
}

// E-post transporter (Gmail SMTP)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ── REGISTRERING ──────────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  const { name, handle, email, password, invite_code } = req.body;

  if (!name || !handle || !email || !password) {
    return res.status(400).json({ error: "Alle felt er påkrevd" });
  }
  if (!invite_code) {
    return res.status(400).json({ error: "Invitasjonskode er påkrevd" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Passord må være minst 8 tegn" });
  }
  if (handle.length < 3 || !/^[a-zA-Z0-9_]+$/.test(handle)) {
    return res.status(400).json({ error: "Handle kan bare inneholde bokstaver, tall og _" });
  }

  try {
    // Sjekk invite-kode
    const inviteResult = await pool.query(
      "SELECT id, max_uses, uses_count FROM invite_codes WHERE code = $1 AND active = TRUE",
      [invite_code.trim().toUpperCase()]
    );
    if (inviteResult.rows.length === 0) {
      return res.status(400).json({ error: "Ugyldig invitasjonskode" });
    }
    const invite = inviteResult.rows[0];
    if (invite.uses_count >= invite.max_uses) {
      return res.status(400).json({ error: "Invitasjonskoden er brukt opp" });
    }

    const existing = await pool.query(
      "SELECT id FROM users WHERE handle = $1 OR email = $2",
      [handle.toLowerCase(), email.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Handle eller e-post er allerede i bruk" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const avatar = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    const colors = ["#1a6b4a", "#0e4f8a", "#7b2d8b", "#c0392b", "#d35400", "#2980b9"];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    // Generer verifiseringstoken
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const result = await pool.query(
      `INSERT INTO users (name, handle, email, password, avatar, avatar_color, email_verified, verification_token)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7)
       RETURNING id, name, handle, email, avatar, avatar_color, verified`,
      [name, handle.toLowerCase(), email.toLowerCase(), hashedPassword, avatar, avatarColor, verificationToken]
    );

    const user = result.rows[0];

    logEvent("register", email.toLowerCase(), req);

    // Oppdater invite-kode
    await pool.query(
      "UPDATE invite_codes SET uses_count = uses_count + 1, used_by = $1, used_at = NOW() WHERE id = $2",
      [user.id, invite.id]
    );

    // Send verifiserings-e-post
    const backendUrl = process.env.BACKEND_URL || "https://helptruth-backend.onrender.com";
    const verifyUrl = `${backendUrl}/api/auth/verify?token=${verificationToken}`;

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      transporter.sendMail({
        from: `"HelpTruth" <${process.env.EMAIL_USER}>`,
        to: email.toLowerCase(),
        subject: "Bekreft din HelpTruth-konto",
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px;background:#0f1923;color:#e2e8f0;border-radius:16px;">
            <h1 style="color:#3b82f6;font-size:28px;margin-bottom:16px;">HelpTruth</h1>
            <p>Hei ${name},</p>
            <p>Takk for at du registrerte deg! Klikk på knappen under for å bekrefte e-posten din:</p>
            <a href="${verifyUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:14px 32px;border-radius:28px;text-decoration:none;font-weight:700;margin:24px 0;">Bekreft e-post</a>
            <p style="color:#94a3b8;font-size:13px;margin-top:24px;">Hvis du ikke opprettet denne kontoen, kan du ignorere denne e-posten.</p>
          </div>
        `,
      }).catch(err => console.error("Email send error:", err.message));
    } else {
      console.log("EMAIL_USER/EMAIL_PASS ikke satt — hopper over verifiserings-e-post");
      console.log("Verifiseringslenke:", verifyUrl);
    }

    res.status(201).json({
      message: "Konto opprettet! Sjekk e-posten din for å bekrefte kontoen.",
      user,
    });

  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Serverfeil" });
  }
});

// ── VERIFISER E-POST ─────────────────────────────────────────────────────
router.get("/verify", async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send("Ugyldig lenke");
  }

  try {
    const result = await pool.query(
      "SELECT id FROM users WHERE verification_token = $1",
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Ugyldig eller utløpt verifiseringslenke");
    }

    await pool.query(
      "UPDATE users SET email_verified = TRUE, verification_token = NULL WHERE id = $1",
      [result.rows[0].id]
    );

    const frontendUrl = process.env.FRONTEND_URL || "https://app.helptruth.com";
    res.redirect(`${frontendUrl}?verified=true`);

  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).send("Serverfeil");
  }
});

// ── INNLOGGING ────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "E-post og passord er påkrevd" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      logEvent("login_fail", email.toLowerCase(), req);
      return res.status(401).json({ error: "Feil e-post eller passord" });
    }

    const user = result.rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      logEvent("login_fail", email.toLowerCase(), req);
      return res.status(401).json({ error: "Feil e-post eller passord" });
    }

    // Sjekk e-postverifisering
    // E-postverifisering deaktivert midlertidig
    // if (user.email_verified === false && user.verification_token !== null) {
    //   return res.status(403).json({ error: "Vennligst bekreft e-posten din først. Sjekk innboksen din." });
    // }

    const token = jwt.sign(
      { id: user.id, handle: user.handle },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Logg innlogging
    const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
    const ua = req.headers["user-agent"] || "";
    let device = "Desktop";
    if (/tablet|ipad/i.test(ua)) device = "Tablet";
    else if (/mobile|iphone|android.*mobile/i.test(ua)) device = "Mobile";

    pool.query(
      "INSERT INTO login_logs (user_id, ip_address, user_agent, device) VALUES ($1, $2, $3, $4)",
      [user.id, ip, ua, device]
    ).catch(err => console.error("Login log error:", err.message));

    logEvent("login_success", user.email, req);

    delete user.password;
    delete user.verification_token;

    res.json({ user, token });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Serverfeil" });
  }
});

// ── HENT INNLOGGET BRUKER ─────────────────────────────────────────────────
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
