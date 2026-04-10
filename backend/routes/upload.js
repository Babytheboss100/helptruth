// routes/upload.js
// Bildeopplasting via Cloudinary

const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const auth = require("../middleware/auth");

const router = express.Router();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer: lagre i minnet (streames til Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB maks
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Bare bilder er tillatt"), false);
    }
  },
});

// POST /api/upload - Last opp bilde
router.post("/", auth, upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Ingen fil valgt" });
  }

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "helptruth",
          transformation: [
            { width: 1200, height: 1200, crop: "limit" },
            { quality: "auto", fetch_format: "auto" },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    res.json({ url: result.secure_url });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Kunne ikke laste opp bilde" });
  }
});

// POST /api/upload/avatar - Last opp profilbilde
router.post("/avatar", auth, upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Ingen fil valgt" });
  }

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "helptruth/avatars",
          transformation: [
            { width: 400, height: 400, crop: "fill", gravity: "face" },
            { quality: "auto", fetch_format: "auto" },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    // Oppdater brukerens profilbilde i databasen
    const pool = require("../db/pool");
    await pool.query(
      "UPDATE users SET profile_image = $1 WHERE id = $2",
      [result.secure_url, req.user.id]
    );

    res.json({ url: result.secure_url });
  } catch (err) {
    console.error("Avatar upload error:", err);
    res.status(500).json({ error: "Kunne ikke laste opp profilbilde" });
  }
});

module.exports = router;
