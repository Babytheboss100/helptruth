// routes/messages.js
// Direktemeldinger

const express = require("express");
const pool = require("../db/pool");
const auth = require("../middleware/auth");

const router = express.Router();

// GET /api/messages/conversations - Hent alle samtaler
router.get("/conversations", auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (other_user_id)
        CASE
          WHEN m.sender_id = $1 THEN m.receiver_id
          ELSE m.sender_id
        END AS other_user_id,
        u.name AS other_name,
        u.handle AS other_handle,
        u.avatar AS other_avatar,
        u.avatar_color AS other_avatar_color,
        u.profile_image AS other_profile_image,
        u.verified AS other_verified,
        m.content AS last_message,
        m.created_at AS last_message_at,
        m.sender_id AS last_sender_id,
        (SELECT COUNT(*) FROM messages
         WHERE receiver_id = $1 AND sender_id = u.id AND read = FALSE
        ) AS unread_count
      FROM messages m
      JOIN users u ON u.id = CASE
        WHEN m.sender_id = $1 THEN m.receiver_id
        ELSE m.sender_id
      END
      WHERE m.sender_id = $1 OR m.receiver_id = $1
      ORDER BY other_user_id, m.created_at DESC
    `, [req.user.id]);

    // Sorter etter siste melding
    result.rows.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));

    res.json(result.rows);
  } catch (err) {
    console.error("Conversations error:", err);
    res.status(500).json({ error: "Serverfeil" });
  }
});

// GET /api/messages/:userId - Hent meldinger med en bruker
router.get("/:userId", auth, async (req, res) => {
  const otherUserId = parseInt(req.params.userId);
  const limit = parseInt(req.query.limit) || 50;
  const before = req.query.before; // cursor-basert paginering

  try {
    let query = `
      SELECT m.*,
        u.name AS sender_name, u.handle AS sender_handle,
        u.avatar AS sender_avatar, u.avatar_color AS sender_avatar_color,
        u.profile_image AS sender_profile_image
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE (m.sender_id = $1 AND m.receiver_id = $2)
         OR (m.sender_id = $2 AND m.receiver_id = $1)
    `;
    const params = [req.user.id, otherUserId];

    if (before) {
      query += ` AND m.created_at < $3 ORDER BY m.created_at DESC LIMIT $4`;
      params.push(before, limit);
    } else {
      query += ` ORDER BY m.created_at DESC LIMIT $3`;
      params.push(limit);
    }

    const result = await pool.query(query, params);

    // Marker meldinger som lest
    await pool.query(
      `UPDATE messages SET read = TRUE
       WHERE receiver_id = $1 AND sender_id = $2 AND read = FALSE`,
      [req.user.id, otherUserId]
    );

    res.json(result.rows.reverse()); // Eldste først
  } catch (err) {
    console.error("Messages error:", err);
    res.status(500).json({ error: "Serverfeil" });
  }
});

// POST /api/messages - Send melding
router.post("/", auth, async (req, res) => {
  const { receiver_id, content } = req.body;

  if (!content?.trim()) {
    return res.status(400).json({ error: "Melding kan ikke være tom" });
  }
  if (content.length > 1000) {
    return res.status(400).json({ error: "Maks 1000 tegn" });
  }
  if (receiver_id === req.user.id) {
    return res.status(400).json({ error: "Kan ikke sende melding til deg selv" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.id, receiver_id, content.trim()]
    );

    // Hent avsender-info
    const sender = await pool.query(
      "SELECT name, handle, avatar, avatar_color, profile_image FROM users WHERE id = $1",
      [req.user.id]
    );

    const message = {
      ...result.rows[0],
      sender_name: sender.rows[0].name,
      sender_handle: sender.rows[0].handle,
      sender_avatar: sender.rows[0].avatar,
      sender_avatar_color: sender.rows[0].avatar_color,
      sender_profile_image: sender.rows[0].profile_image,
    };

    // Emit via Socket.io hvis tilgjengelig
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${receiver_id}`).emit("new_message", message);
    }

    res.status(201).json(message);
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ error: "Serverfeil" });
  }
});

// GET /api/messages/unread/count - Antall uleste meldinger
router.get("/unread/count", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT COUNT(*) FROM messages WHERE receiver_id = $1 AND read = FALSE",
      [req.user.id]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: "Serverfeil" });
  }
});

module.exports = router;
