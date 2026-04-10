// db/pool.js
// Railway gir automatisk DATABASE_URL - bruk den i produksjon
// Lokalt bruker vi individuelle variabler fra .env

const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host:     process.env.DB_HOST     || "localhost",
        port:     process.env.DB_PORT     || 5432,
        database: process.env.DB_NAME     || "helptruth",
        user:     process.env.DB_USER     || "postgres",
        password: process.env.DB_PASSWORD || "dittpassord",
      }
);

pool.connect((err, client, release) => {
  if (err) console.error("❌ Database feil:", err.message);
  else { console.log("✅ PostgreSQL tilkoblet!"); release(); }
});

module.exports = pool;
