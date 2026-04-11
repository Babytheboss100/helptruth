// routes/admin.js
// Admin-endepunkter — kun for verifiserte brukere

const express = require("express");
const pool = require("../db/pool");
const auth = require("../middleware/auth");

const router = express.Router();

// GET /api/admin/logs — vis alle login-logger
router.get("/logs", auth, async (req, res) => {
  try {
    // Sjekk at bruker er verifisert
    const userResult = await pool.query("SELECT verified FROM users WHERE id = $1", [req.user.id]);
    if (userResult.rows.length === 0 || !userResult.rows[0].verified) {
      return res.status(403).json({ error: "Kun for verifiserte brukere" });
    }

    const result = await pool.query(`
      SELECT
        l.id,
        u.name,
        u.handle,
        l.ip_address,
        l.device,
        l.user_agent,
        l.country,
        l.created_at
      FROM login_logs l
      JOIN users u ON u.id = l.user_id
      ORDER BY l.created_at DESC
      LIMIT 200
    `);

    res.json({ logs: result.rows, total: result.rows.length });
  } catch (err) {
    console.error("Admin logs error:", err);
    res.status(500).json({ error: "Serverfeil" });
  }
});

// Hjelpefunksjon for admin-sjekk
async function requireVerified(req, res) {
  const r = await pool.query("SELECT verified FROM users WHERE id = $1", [req.user.id]);
  if (r.rows.length === 0 || !r.rows[0].verified) {
    res.status(403).json({ error: "Kun for verifiserte brukere" });
    return false;
  }
  return true;
}

// GET /api/admin/invites — vis alle invite-koder
router.get("/invites", auth, async (req, res) => {
  try {
    if (!(await requireVerified(req, res))) return;

    const result = await pool.query(`
      SELECT
        i.id, i.code, i.max_uses, i.uses_count, i.active, i.created_at,
        c.name AS created_by_name, c.handle AS created_by_handle,
        u.name AS used_by_name, u.handle AS used_by_handle, i.used_at
      FROM invite_codes i
      LEFT JOIN users c ON c.id = i.created_by
      LEFT JOIN users u ON u.id = i.used_by
      ORDER BY i.created_at DESC
    `);

    res.json({ invites: result.rows });
  } catch (err) {
    console.error("Admin invites error:", err);
    res.status(500).json({ error: "Serverfeil" });
  }
});

// POST /api/admin/invites — lag ny invite-kode
router.post("/invites", auth, async (req, res) => {
  try {
    if (!(await requireVerified(req, res))) return;

    const { code, max_uses } = req.body;
    const inviteCode = (code || Math.random().toString(36).substring(2, 10)).toUpperCase();
    const uses = max_uses || 1;

    const result = await pool.query(
      "INSERT INTO invite_codes (code, created_by, max_uses) VALUES ($1, $2, $3) RETURNING *",
      [inviteCode, req.user.id, uses]
    );

    res.status(201).json({ invite: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Denne koden finnes allerede" });
    }
    console.error("Create invite error:", err);
    res.status(500).json({ error: "Serverfeil" });
  }
});

module.exports = router;
