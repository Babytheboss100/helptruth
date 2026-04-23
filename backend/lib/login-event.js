// lib/login-event.js
// Skriver rader til login_events-tabellen.
// Kolonner holdes identiske med StartMarkets LoginEvent-model slik at
// data kan merges hvis vi sentraliserer auth senere.

const pool = require("../db/pool");

function parseReq(req) {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
    .split(",")[0]
    .trim();
  const ua = req.headers["user-agent"] || "";
  // Cloudflare-header hvis tilstede; ellers null (kan erstattes med geoip-lite senere)
  const country = req.headers["cf-ipcountry"] || null;
  const referer = req.headers.referer || req.headers.referrer || null;
  return { ip, ua, country, referer };
}

async function logLoginEvent({
  req,
  user_id = null,
  email = null,
  provider,                 // 'google' | 'email'
  event_type,               // 'login_success' | 'login_failure' | 'logout' | 'register'
  success,
  failure_reason = null,
  tenant_id = null,
  google_profile = null,
  utm = {},
  device_fingerprint = null,
}) {
  const { ip, ua, country, referer } = parseReq(req);
  try {
    await pool.query(
      `INSERT INTO login_events (
         user_id, email, provider, event_type, success, failure_reason,
         ip_address, user_agent, country, tenant_id, google_profile, referer,
         utm_source, utm_medium, utm_campaign, device_fingerprint
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        user_id,
        email ? email.toLowerCase() : null,
        provider,
        event_type,
        success,
        failure_reason,
        ip || null,
        ua,
        country,
        tenant_id,
        google_profile,
        referer,
        utm?.source || null,
        utm?.medium || null,
        utm?.campaign || null,
        device_fingerprint,
      ]
    );
  } catch (err) {
    console.error("login_events insert error:", err.message);
  }
}

module.exports = { logLoginEvent, parseReq };
