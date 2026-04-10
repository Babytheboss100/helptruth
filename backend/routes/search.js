// routes/search.js
// Fulltekstsøk for innlegg og brukere

const express = require("express");
const pool = require("../db/pool");
const auth = require("../middleware/auth");

const router = express.Router();

// GET /api/search?q=...&type=all|posts|users
router.get("/", auth, async (req, res) => {
  const q = req.query.q;
  const type = req.query.type || "all";
  const limit = parseInt(req.query.limit) || 20;

  if (!q || q.length < 2) {
    return res.json({ posts: [], users: [] });
  }

  try {
    const results = { posts: [], users: [] };

    // Søk i innlegg
    if (type === "all" || type === "posts") {
      const postsResult = await pool.query(`
        SELECT
          p.*,
          u.name AS user_name, u.handle AS user_handle,
          u.avatar AS user_avatar, u.avatar_color AS user_avatar_color,
          u.profile_image AS user_profile_image,
          u.verified AS user_verified,
          EXISTS(SELECT 1 FROM likes WHERE user_id = $3 AND post_id = p.id) AS liked,
          EXISTS(SELECT 1 FROM reposts WHERE user_id = $3 AND post_id = p.id) AS reposted,
          EXISTS(SELECT 1 FROM bookmarks WHERE user_id = $3 AND post_id = p.id) AS bookmarked
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.content ILIKE $1
        ORDER BY p.created_at DESC
        LIMIT $2
      `, [`%${q}%`, limit, req.user.id]);

      results.posts = postsResult.rows;
    }

    // Søk i brukere
    if (type === "all" || type === "users") {
      const usersResult = await pool.query(`
        SELECT
          id, name, handle, bio, avatar, avatar_color, profile_image,
          verified, followers_count, following_count, posts_count,
          EXISTS(SELECT 1 FROM follows WHERE follower_id = $3 AND following_id = users.id) AS is_following
        FROM users
        WHERE name ILIKE $1 OR handle ILIKE $1 OR bio ILIKE $1
        LIMIT $2
      `, [`%${q}%`, limit, req.user.id]);

      results.users = usersResult.rows;
    }

    res.json(results);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Serverfeil" });
  }
});

// GET /api/search/hashtag/:tag - Søk etter hashtag
router.get("/hashtag/:tag", auth, async (req, res) => {
  const tag = req.params.tag;
  const limit = parseInt(req.query.limit) || 20;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(`
      SELECT
        p.*,
        u.name AS user_name, u.handle AS user_handle,
        u.avatar AS user_avatar, u.avatar_color AS user_avatar_color,
        u.profile_image AS user_profile_image,
        u.verified AS user_verified,
        EXISTS(SELECT 1 FROM likes WHERE user_id = $4 AND post_id = p.id) AS liked,
        EXISTS(SELECT 1 FROM reposts WHERE user_id = $4 AND post_id = p.id) AS reposted,
        EXISTS(SELECT 1 FROM bookmarks WHERE user_id = $4 AND post_id = p.id) AS bookmarked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.content ILIKE $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `, [`%#${tag}%`, limit, offset, req.user.id]);

    res.json(result.rows);
  } catch (err) {
    console.error("Hashtag search error:", err);
    res.status(500).json({ error: "Serverfeil" });
  }
});

module.exports = router;
