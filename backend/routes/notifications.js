// routes/notifications.js
// Varsler fra database

const express = require("express");
const pool = require("../db/pool");
const auth = require("../middleware/auth");

const router = express.Router();

// GET /api/notifications - Hent brukerens varsler
router.get("/", auth, async (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(`
      SELECT
        n.*,
        u.name AS from_name,
        u.handle AS from_handle,
        u.avatar AS from_avatar,
        u.avatar_color AS from_avatar_color,
        u.profile_image AS from_profile_image,
        u.verified AS from_verified,
        p.content AS post_content
      FROM notifications n
      JOIN users u ON u.id = n.from_user_id
      LEFT JOIN posts p ON p.id = n.post_id
      ORDER BY n.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json(result.rows);
  } catch (err) {
    console.error("Notifications error:", err);
    res.status(500).json({ error: "Serverfeil" });
  }
});

// GET /api/notifications/unread/count - Antall uleste varsler
router.get("/unread/count", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = FALSE",
      [req.user.id]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: "Serverfeil" });
  }
});

// PUT /api/notifications/read-all - Marker alle som lest
router.put("/read-all", auth, async (req, res) => {
  try {
    await pool.query(
      "UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE",
      [req.user.id]
    );
    res.json({ message: "Alle varsler markert som lest" });
  } catch (err) {
    res.status(500).json({ error: "Serverfeil" });
  }
});

// PUT /api/notifications/:id/read - Marker én som lest
router.put("/:id/read", auth, async (req, res) => {
  try {
    await pool.query(
      "UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    res.json({ message: "Varsel markert som lest" });
  } catch (err) {
    res.status(500).json({ error: "Serverfeil" });
  }
});

// Hjelpefunksjon: opprett varsel (brukes av andre routes)
async function createNotification({ userId, fromUserId, type, postId = null, io = null }) {
  // Ikke send varsel til deg selv
  if (userId === fromUserId) return;

  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, from_user_id, type, post_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, fromUserId, type, postId]
    );

    // Hent avsender-info for real-time push
    if (io) {
      const sender = await pool.query(
        "SELECT name, handle, avatar, avatar_color, profile_image, verified FROM users WHERE id = $1",
        [fromUserId]
      );
      const notification = {
        ...result.rows[0],
        from_name: sender.rows[0].name,
        from_handle: sender.rows[0].handle,
        from_avatar: sender.rows[0].avatar,
        from_avatar_color: sender.rows[0].avatar_color,
        from_profile_image: sender.rows[0].profile_image,
        from_verified: sender.rows[0].verified,
      };
      io.to(`user:${userId}`).emit("new_notification", notification);
    }
  } catch (err) {
    console.error("Create notification error:", err);
  }
}

module.exports = router;
module.exports.createNotification = createNotification;
