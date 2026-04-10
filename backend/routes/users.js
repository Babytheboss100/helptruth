// routes/users.js
// Brukerprofiler og følge-system

const express = require("express");
const pool = require("../db/pool");
const auth = require("../middleware/auth");
const { createNotification } = require("./notifications");

const router = express.Router();

// ── HENT BRUKERPROFIL ─────────────────────────────────────────────────────
router.get("/:handle", auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id, u.name, u.handle, u.bio, u.avatar, u.avatar_color,
        u.profile_image, u.verified, u.followers_count, u.following_count,
        u.posts_count, u.created_at,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = u.id) AS is_following
      FROM users u
      WHERE u.handle = $1
    `, [req.params.handle.toLowerCase(), req.user.id]);

    if (result.rows.length === 0) return res.status(404).json({ error: "Bruker ikke funnet" });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Serverfeil" });
  }
});

// ── HENT BRUKERENS INNLEGG ────────────────────────────────────────────────
router.get("/:handle/posts", auth, async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const page  = parseInt(req.query.page)  || 1;
  const offset = (page - 1) * limit;

  try {
    const userResult = await pool.query(
      "SELECT id FROM users WHERE handle = $1",
      [req.params.handle.toLowerCase()]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: "Bruker ikke funnet" });
    const userId = userResult.rows[0].id;

    const result = await pool.query(`
      SELECT
        p.*,
        u.name AS user_name, u.handle AS user_handle,
        u.avatar AS user_avatar, u.avatar_color AS user_avatar_color,
        u.profile_image AS user_profile_image,
        u.verified AS user_verified,
        EXISTS(SELECT 1 FROM likes     WHERE user_id = $3 AND post_id = p.id) AS liked,
        EXISTS(SELECT 1 FROM reposts   WHERE user_id = $3 AND post_id = p.id) AS reposted,
        EXISTS(SELECT 1 FROM bookmarks WHERE user_id = $3 AND post_id = p.id) AS bookmarked,
        qp.id AS quote_id, qp.content AS quote_content, qp.image_url AS quote_image_url,
        qp.created_at AS quote_created_at,
        qu.name AS quote_user_name, qu.handle AS quote_user_handle,
        qu.avatar AS quote_user_avatar, qu.avatar_color AS quote_user_avatar_color,
        qu.profile_image AS quote_user_profile_image, qu.verified AS quote_user_verified,
        pl.id AS poll_id, pl.options AS poll_options, pl.votes AS poll_votes, pl.ends_at AS poll_ends_at,
        (SELECT option_index FROM poll_votes WHERE poll_id = pl.id AND user_id = $3) AS poll_user_vote
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN posts qp ON p.quote_post_id = qp.id
      LEFT JOIN users qu ON qp.user_id = qu.id
      LEFT JOIN polls pl ON pl.post_id = p.id
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $4
    `, [userId, limit, req.user.id, offset]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Serverfeil" });
  }
});

// ── FØLG / AVFØLG ─────────────────────────────────────────────────────────
router.post("/:handle/follow", auth, async (req, res) => {
  try {
    const targetResult = await pool.query(
      "SELECT id FROM users WHERE handle = $1",
      [req.params.handle.toLowerCase()]
    );
    if (targetResult.rows.length === 0) return res.status(404).json({ error: "Bruker ikke funnet" });

    const targetId = targetResult.rows[0].id;
    const myId = req.user.id;

    if (targetId === myId) return res.status(400).json({ error: "Kan ikke følge deg selv" });

    const inserted = await pool.query(
      "INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id",
      [myId, targetId]
    );

    if (inserted.rows.length > 0) {
      await pool.query("UPDATE users SET following_count = following_count + 1 WHERE id = $1", [myId]);
      await pool.query("UPDATE users SET followers_count = followers_count + 1 WHERE id = $1", [targetId]);

      // Varsel
      const io = req.app.get("io");
      await createNotification({ userId: targetId, fromUserId: myId, type: "follow", io });

      res.json({ following: true });
    } else {
      await pool.query("DELETE FROM follows WHERE follower_id = $1 AND following_id = $2", [myId, targetId]);
      await pool.query("UPDATE users SET following_count = GREATEST(0, following_count - 1) WHERE id = $1", [myId]);
      await pool.query("UPDATE users SET followers_count = GREATEST(0, followers_count - 1) WHERE id = $1", [targetId]);
      res.json({ following: false });
    }
  } catch (err) {
    res.status(500).json({ error: "Serverfeil" });
  }
});

// ── SØKEFORSLAG ───────────────────────────────────────────────────────────
router.get("/search/query", auth, async (req, res) => {
  const q = req.query.q;
  if (!q || q.length < 2) return res.json([]);

  try {
    const result = await pool.query(`
      SELECT id, name, handle, avatar, avatar_color, profile_image, verified, followers_count
      FROM users
      WHERE name ILIKE $1 OR handle ILIKE $1
      LIMIT 10
    `, [`%${q}%`]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Serverfeil" });
  }
});

// ── OPPDATER PROFIL ───────────────────────────────────────────────────────
router.put("/me/update", auth, async (req, res) => {
  const { name, bio } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Navn er påkrevd" });

  try {
    const result = await pool.query(
      `UPDATE users SET name = $1, bio = $2 WHERE id = $3
       RETURNING id, name, handle, bio, avatar, avatar_color, profile_image, verified`,
      [name.trim(), bio?.trim() || "", req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Serverfeil" });
  }
});

module.exports = router;
