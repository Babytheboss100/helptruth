// routes/admin.js
// Admin-endepunkter — kun for verifiserte brukere

const express = require("express");
const pool = require("../db/pool");
const auth = require("../middleware/auth");

const router = express.Router();

// GET /api/admin/stats — analytics dashboard data
router.get("/stats", auth, async (req, res) => {
  try {
    if (!(await requireVerified(req, res))) return;

    const [
      totalUsers,
      loginsToday, loginsWeek, loginsMonth,
      failsToday,
      regsToday, regsWeek, regsMonth,
      dailySignups,
      recentLogins
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users"),
      pool.query("SELECT COUNT(*) FROM analytics WHERE event='login_success' AND created_at > NOW() - INTERVAL '1 day'"),
      pool.query("SELECT COUNT(*) FROM analytics WHERE event='login_success' AND created_at > NOW() - INTERVAL '7 days'"),
      pool.query("SELECT COUNT(*) FROM analytics WHERE event='login_success' AND created_at > NOW() - INTERVAL '30 days'"),
      pool.query("SELECT COUNT(*) FROM analytics WHERE event='login_fail' AND created_at > NOW() - INTERVAL '1 day'"),
      pool.query("SELECT COUNT(*) FROM analytics WHERE event='register' AND created_at > NOW() - INTERVAL '1 day'"),
      pool.query("SELECT COUNT(*) FROM analytics WHERE event='register' AND created_at > NOW() - INTERVAL '7 days'"),
      pool.query("SELECT COUNT(*) FROM analytics WHERE event='register' AND created_at > NOW() - INTERVAL '30 days'"),
      pool.query("SELECT DATE(created_at) as day, COUNT(*) as count FROM analytics WHERE event='register' AND created_at > NOW() - INTERVAL '30 days' GROUP BY DATE(created_at) ORDER BY day"),
      pool.query("SELECT a.event, a.email, a.ip, a.created_at FROM analytics a ORDER BY a.created_at DESC LIMIT 50"),
    ]);

    res.json({
      totalUsers: parseInt(totalUsers.rows[0].count),
      loginsToday: parseInt(loginsToday.rows[0].count),
      loginsWeek: parseInt(loginsWeek.rows[0].count),
      loginsMonth: parseInt(loginsMonth.rows[0].count),
      failsToday: parseInt(failsToday.rows[0].count),
      regsToday: parseInt(regsToday.rows[0].count),
      regsWeek: parseInt(regsWeek.rows[0].count),
      regsMonth: parseInt(regsMonth.rows[0].count),
      dailySignups: dailySignups.rows,
      recentLogins: recentLogins.rows,
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ error: "Serverfeil" });
  }
});

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
