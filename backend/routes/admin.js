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

module.exports = router;
