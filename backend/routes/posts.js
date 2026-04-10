// routes/posts.js
// Alt som handler om innlegg: opprette, hente, like, reposte, slette, polls

const express = require("express");
const pool = require("../db/pool");
const auth = require("../middleware/auth");
const { createNotification } = require("./notifications");

const router = express.Router();

// ── HJELPER: post-kolonner med brukerinfo ─────────────────────────────────
function postSelect(requestingUserId) {
  return `
    SELECT
      p.*,
      u.name         AS user_name,
      u.handle       AS user_handle,
      u.avatar       AS user_avatar,
      u.avatar_color AS user_avatar_color,
      u.profile_image AS user_profile_image,
      u.verified     AS user_verified,
      ${requestingUserId
        ? `EXISTS(SELECT 1 FROM likes     WHERE user_id = ${requestingUserId} AND post_id = p.id) AS liked,
           EXISTS(SELECT 1 FROM reposts   WHERE user_id = ${requestingUserId} AND post_id = p.id) AS reposted,
           EXISTS(SELECT 1 FROM bookmarks WHERE user_id = ${requestingUserId} AND post_id = p.id) AS bookmarked`
        : "FALSE AS liked, FALSE AS reposted, FALSE AS bookmarked"
      },
      -- Sitatinnlegg-data
      qp.id          AS quote_id,
      qp.content     AS quote_content,
      qp.image_url   AS quote_image_url,
      qp.created_at  AS quote_created_at,
      qu.name        AS quote_user_name,
      qu.handle      AS quote_user_handle,
      qu.avatar      AS quote_user_avatar,
      qu.avatar_color AS quote_user_avatar_color,
      qu.profile_image AS quote_user_profile_image,
      qu.verified    AS quote_user_verified,
      -- Poll-data
      pl.id          AS poll_id,
      pl.options     AS poll_options,
      pl.votes       AS poll_votes,
      pl.ends_at     AS poll_ends_at,
      ${requestingUserId
        ? `(SELECT option_index FROM poll_votes WHERE poll_id = pl.id AND user_id = ${requestingUserId}) AS poll_user_vote`
        : "NULL AS poll_user_vote"
      }
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN posts qp ON p.quote_post_id = qp.id
    LEFT JOIN users qu ON qp.user_id = qu.id
    LEFT JOIN polls pl ON pl.post_id = p.id
  `;
}

// ── HENT FEED (alle innlegg, nyeste først) ────────────────────────────────
router.get("/", auth, async (req, res) => {
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(`
      ${postSelect(req.user.id)}
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const postIds = result.rows.map(p => p.id);
    if (postIds.length > 0) {
      pool.query(
        `UPDATE posts SET views_count = views_count + 1 WHERE id = ANY($1)`,
        [postIds]
      ).catch(() => {});
    }

    res.json(result.rows);
  } catch (err) {
    console.error("Feed error:", err);
    res.status(500).json({ error: "Serverfeil" });
  }
});

// ── HENT FEED FOR FULGTE BRUKERE ──────────────────────────────────────────
router.get("/following", auth, async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const page  = parseInt(req.query.page)  || 1;
  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(`
      ${postSelect(req.user.id)}
      WHERE p.user_id IN (
        SELECT following_id FROM follows WHERE follower_id = $3
      )
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset, req.user.id]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Serverfeil" });
  }
});

// ── HENT ETT INNLEGG (tråd-visning) ──────────────────────────────────────
router.get("/:id", auth, async (req, res) => {
  try {
    const result = await pool.query(`
      ${postSelect(req.user.id)}
      WHERE p.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) return res.status(404).json({ error: "Innlegg ikke funnet" });

    // Oppdater visninger
    pool.query("UPDATE posts SET views_count = views_count + 1 WHERE id = $1", [req.params.id]).catch(() => {});

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Serverfeil" });
  }
});

// ── LAG NYTT INNLEGG ──────────────────────────────────────────────────────
// Body: { content, image_url?, quote_post_id?, poll?: { options: string[], duration_hours: number } }
router.post("/", auth, async (req, res) => {
  const { content, image_url, quote_post_id, poll } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: "Innhold er påkrevd" });
  }
  if (content.length > 280) {
    return res.status(400).json({ error: "Maks 280 tegn" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO posts (user_id, content, image_url, quote_post_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [req.user.id, content.trim(), image_url || null, quote_post_id || null]
    );

    const postId = result.rows[0].id;

    // Oppdater posts_count
    await pool.query(
      "UPDATE users SET posts_count = posts_count + 1 WHERE id = $1",
      [req.user.id]
    );

    // Opprett poll hvis angitt
    if (poll && poll.options && poll.options.length >= 2) {
      const durationHours = poll.duration_hours || 24;
      const endsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
      const initialVotes = {};
      poll.options.forEach((_, i) => { initialVotes[i] = 0; });

      await pool.query(
        `INSERT INTO polls (post_id, options, votes, ends_at)
         VALUES ($1, $2, $3, $4)`,
        [postId, JSON.stringify(poll.options), JSON.stringify(initialVotes), endsAt]
      );
    }

    // Sitatinnlegg: oppdater quotes_count og send varsel
    if (quote_post_id) {
      await pool.query(
        "UPDATE posts SET quotes_count = COALESCE(quotes_count, 0) + 1 WHERE id = $1",
        [quote_post_id]
      );
      const origPost = await pool.query("SELECT user_id FROM posts WHERE id = $1", [quote_post_id]);
      if (origPost.rows.length > 0) {
        const io = req.app.get("io");
        await createNotification({
          userId: origPost.rows[0].user_id,
          fromUserId: req.user.id,
          type: "quote",
          postId: postId,
          io,
        });
      }
    }

    // Hent innlegget med all info
    const postResult = await pool.query(`
      ${postSelect(req.user.id)}
      WHERE p.id = $1
    `, [postId]);

    const post = postResult.rows[0];

    // Emit via Socket.io
    const io = req.app.get("io");
    if (io) {
      io.emit("new_post", post);
    }

    res.status(201).json(post);
  } catch (err) {
    console.error("Post create error:", err);
    res.status(500).json({ error: "Serverfeil" });
  }
});

// ── SLETT INNLEGG ─────────────────────────────────────────────────────────
router.delete("/:id", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT user_id FROM posts WHERE id = $1",
      [req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: "Innlegg ikke funnet" });
    if (result.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: "Ikke tillatt" });
    }

    await pool.query("DELETE FROM posts WHERE id = $1", [req.params.id]);
    await pool.query("UPDATE users SET posts_count = GREATEST(0, posts_count - 1) WHERE id = $1", [req.user.id]);

    res.json({ message: "Innlegg slettet" });
  } catch (err) {
    res.status(500).json({ error: "Serverfeil" });
  }
});

// ── LIKE / UN-LIKE ────────────────────────────────────────────────────────
router.post("/:id/like", auth, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;

  try {
    const inserted = await pool.query(
      "INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id",
      [userId, postId]
    );

    if (inserted.rows.length > 0) {
      await pool.query("UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1", [postId]);

      // Varsel + Socket.io
      const post = await pool.query("SELECT user_id FROM posts WHERE id = $1", [postId]);
      if (post.rows.length > 0) {
        const io = req.app.get("io");
        await createNotification({ userId: post.rows[0].user_id, fromUserId: userId, type: "like", postId: parseInt(postId), io });
        if (io) io.emit("post_liked", { postId: parseInt(postId), userId, liked: true });
      }

      res.json({ liked: true });
    } else {
      await pool.query("DELETE FROM likes WHERE user_id = $1 AND post_id = $2", [userId, postId]);
      await pool.query("UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1", [postId]);
      const io = req.app.get("io");
      if (io) io.emit("post_liked", { postId: parseInt(postId), userId, liked: false });
      res.json({ liked: false });
    }
  } catch (err) {
    res.status(500).json({ error: "Serverfeil" });
  }
});

// ── REPOST / UN-REPOST ────────────────────────────────────────────────────
router.post("/:id/repost", auth, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;

  try {
    const inserted = await pool.query(
      "INSERT INTO reposts (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id",
      [userId, postId]
    );

    if (inserted.rows.length > 0) {
      await pool.query("UPDATE posts SET reposts_count = reposts_count + 1 WHERE id = $1", [postId]);

      const post = await pool.query("SELECT user_id FROM posts WHERE id = $1", [postId]);
      if (post.rows.length > 0) {
        const io = req.app.get("io");
        await createNotification({ userId: post.rows[0].user_id, fromUserId: userId, type: "repost", postId: parseInt(postId), io });
        if (io) io.emit("post_reposted", { postId: parseInt(postId), userId, reposted: true });
      }

      res.json({ reposted: true });
    } else {
      await pool.query("DELETE FROM reposts WHERE user_id = $1 AND post_id = $2", [userId, postId]);
      await pool.query("UPDATE posts SET reposts_count = GREATEST(0, reposts_count - 1) WHERE id = $1", [postId]);
      const io = req.app.get("io");
      if (io) io.emit("post_reposted", { postId: parseInt(postId), userId, reposted: false });
      res.json({ reposted: false });
    }
  } catch (err) {
    res.status(500).json({ error: "Serverfeil" });
  }
});

// ── BOKMERK ───────────────────────────────────────────────────────────────
router.post("/:id/bookmark", auth, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;

  try {
    const inserted = await pool.query(
      "INSERT INTO bookmarks (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id",
      [userId, postId]
    );

    if (inserted.rows.length > 0) {
      res.json({ bookmarked: true });
    } else {
      await pool.query("DELETE FROM bookmarks WHERE user_id = $1 AND post_id = $2", [userId, postId]);
      res.json({ bookmarked: false });
    }
  } catch (err) {
    res.status(500).json({ error: "Serverfeil" });
  }
});

// ── HENT BOKMERKER ────────────────────────────────────────────────────────
router.get("/bookmarks/all", auth, async (req, res) => {
  try {
    const result = await pool.query(`
      ${postSelect(req.user.id)}
      JOIN bookmarks b ON b.post_id = p.id AND b.user_id = $1
      ORDER BY b.created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Serverfeil" });
  }
});

// ── SVAR PÅ INNLEGG ───────────────────────────────────────────────────────
router.post("/:id/reply", auth, async (req, res) => {
  const { content, image_url } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "Innhold er påkrevd" });
  if (content.length > 280) return res.status(400).json({ error: "Maks 280 tegn" });

  try {
    const reply = await pool.query(
      "INSERT INTO replies (user_id, post_id, content, image_url) VALUES ($1, $2, $3, $4) RETURNING *",
      [req.user.id, req.params.id, content.trim(), image_url || null]
    );
    await pool.query(
      "UPDATE posts SET replies_count = replies_count + 1 WHERE id = $1",
      [req.params.id]
    );

    // Varsel
    const post = await pool.query("SELECT user_id FROM posts WHERE id = $1", [req.params.id]);
    if (post.rows.length > 0) {
      const io = req.app.get("io");
      await createNotification({ userId: post.rows[0].user_id, fromUserId: req.user.id, type: "reply", postId: parseInt(req.params.id), io });
    }

    // Hent reply med brukerinfo
    const replyWithUser = await pool.query(`
      SELECT r.*, u.name AS user_name, u.handle AS user_handle,
             u.avatar AS user_avatar, u.avatar_color AS user_avatar_color,
             u.profile_image AS user_profile_image, u.verified AS user_verified
      FROM replies r JOIN users u ON r.user_id = u.id
      WHERE r.id = $1
    `, [reply.rows[0].id]);

    res.status(201).json(replyWithUser.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Serverfeil" });
  }
});

// ── HENT SVAR ─────────────────────────────────────────────────────────────
router.get("/:id/replies", auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, u.name AS user_name, u.handle AS user_handle,
             u.avatar AS user_avatar, u.avatar_color AS user_avatar_color,
             u.profile_image AS user_profile_image, u.verified AS user_verified
      FROM replies r
      JOIN users u ON r.user_id = u.id
      WHERE r.post_id = $1
      ORDER BY r.created_at ASC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Serverfeil" });
  }
});

// ── STEM I POLL ───────────────────────────────────────────────────────────
router.post("/:id/vote", auth, async (req, res) => {
  const { option_index } = req.body;
  const postId = req.params.id;

  try {
    // Finn poll
    const pollResult = await pool.query(
      "SELECT * FROM polls WHERE post_id = $1", [postId]
    );
    if (pollResult.rows.length === 0) return res.status(404).json({ error: "Avstemning ikke funnet" });

    const poll = pollResult.rows[0];
    const options = typeof poll.options === "string" ? JSON.parse(poll.options) : poll.options;

    if (new Date(poll.ends_at) < new Date()) {
      return res.status(400).json({ error: "Avstemningen er avsluttet" });
    }
    if (option_index < 0 || option_index >= options.length) {
      return res.status(400).json({ error: "Ugyldig alternativ" });
    }

    // Prøv å stemme
    const inserted = await pool.query(
      "INSERT INTO poll_votes (poll_id, user_id, option_index) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id",
      [poll.id, req.user.id, option_index]
    );

    if (inserted.rows.length === 0) {
      return res.status(400).json({ error: "Du har allerede stemt" });
    }

    // Oppdater stemmetelling
    const votes = typeof poll.votes === "string" ? JSON.parse(poll.votes) : poll.votes;
    votes[option_index] = (votes[option_index] || 0) + 1;

    await pool.query(
      "UPDATE polls SET votes = $1 WHERE id = $2",
      [JSON.stringify(votes), poll.id]
    );

    res.json({ votes, user_vote: option_index });
  } catch (err) {
    console.error("Vote error:", err);
    res.status(500).json({ error: "Serverfeil" });
  }
});

module.exports = router;
