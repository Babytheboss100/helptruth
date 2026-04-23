// routes/auth-google.js
// Google OAuth 2.0 — kick-off + callback
// Stateless: state-parameter er JWT (10 min TTL), ingen server-side session nødvendig.

const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const pool = require("../db/pool");
const { logLoginEvent } = require("../lib/login-event");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "hemmelig-nøkkel";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL ||
  "http://localhost:4000/api/auth/google/callback";

// Tenant → frontend-URL-oppslag.
// Prioritet: FRONTEND_URL_<TENANT> env-var > FRONTEND_URL env-var > innebygd default.
// Prod-defaults er trygge; localhost brukes bare hvis env-varen er eksplisitt satt.
const TENANT_FRONTEND_DEFAULTS = {
  breedz: "https://social.breedz.eu",
  helptruth: "https://app.helptruth.com",
};

function frontendUrlFor(tenant) {
  const key = (tenant || "breedz").toLowerCase();
  const envSpecific = process.env[`FRONTEND_URL_${key.toUpperCase()}`];
  if (envSpecific) return envSpecific;
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
  return TENANT_FRONTEND_DEFAULTS[key] || TENANT_FRONTEND_DEFAULTS.breedz;
}

function oauth() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET er ikke konfigurert");
  }
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL);
}

function redirectToFrontend(res, tenant, params) {
  const qs = new URLSearchParams(params);
  res.redirect(`${frontendUrlFor(tenant)}/?${qs}`);
}

// ── GET /api/auth/google ─────────────────────────────────────────────────
router.get("/google", (req, res) => {
  const {
    tenant = "breedz",
    mode = "login",
    invite_code = "",
    redirect = "",
    utm_source = "",
    utm_medium = "",
    utm_campaign = "",
  } = req.query;

  let state;
  try {
    state = jwt.sign(
      {
        tenant,
        mode,
        invite_code,
        redirect,
        utm: { source: utm_source, medium: utm_medium, campaign: utm_campaign },
        nonce: crypto.randomBytes(16).toString("hex"),
      },
      JWT_SECRET,
      { expiresIn: "10m" }
    );
  } catch (err) {
    console.error("state sign error:", err.message);
    return res.status(500).json({ error: "Kunne ikke starte Google-innlogging" });
  }

  let url;
  try {
    url = oauth().generateAuthUrl({
      access_type: "online",
      scope: ["openid", "email", "profile"],
      state,
      prompt: "select_account",
    });
  } catch (err) {
    console.error("Google auth URL error:", err.message);
    return res.status(500).json({ error: err.message });
  }

  res.redirect(url);
});

// ── GET /api/auth/google/callback ────────────────────────────────────────
router.get("/google/callback", async (req, res) => {
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    await logLoginEvent({
      req,
      provider: "google",
      event_type: "login_failure",
      success: false,
      failure_reason: `oauth_error:${oauthError}`,
    });
    return redirectToFrontend(res, null, { google_error: "oauth_denied" });
  }

  if (!code || !state) {
    return redirectToFrontend(res, null, { google_error: "missing_params" });
  }

  // Verify state
  let statePayload;
  try {
    statePayload = jwt.verify(state, JWT_SECRET);
  } catch {
    await logLoginEvent({
      req,
      provider: "google",
      event_type: "login_failure",
      success: false,
      failure_reason: "invalid_state",
    });
    return redirectToFrontend(res, null, { google_error: "invalid_state" });
  }

  const { tenant, mode, invite_code, redirect: redirectTarget, utm } = statePayload;

  // Exchange code → tokens → verified ID-token payload
  let profile;
  try {
    const client = oauth();
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });
    profile = ticket.getPayload();
  } catch (err) {
    console.error("Google token exchange error:", err.message);
    await logLoginEvent({
      req,
      provider: "google",
      event_type: "login_failure",
      success: false,
      failure_reason: "token_exchange_failed",
      tenant_id: tenant,
    });
    return redirectToFrontend(res, tenant, { google_error: "token_exchange_failed" });
  }

  const { sub: googleSub, email, name, picture, email_verified } = profile;
  if (!email || !email_verified) {
    await logLoginEvent({
      req,
      provider: "google",
      event_type: "login_failure",
      success: false,
      failure_reason: "email_not_verified",
      tenant_id: tenant,
      email,
      google_profile: profile,
    });
    return redirectToFrontend(res, tenant, { google_error: "email_not_verified" });
  }

  const normalizedEmail = email.toLowerCase();

  // findOrCreateOAuthUser
  let user = null;
  let linkedExisting = false;

  // 1) Match på google_sub
  const bySub = await pool.query("SELECT * FROM users WHERE google_sub = $1", [googleSub]);
  if (bySub.rows.length) {
    user = bySub.rows[0];
    await pool.query(
      `UPDATE users
       SET google_profile = $1,
           avatar_url = COALESCE($2, avatar_url)
       WHERE id = $3`,
      [profile, picture || null, user.id]
    );
  } else {
    // 2) Match på email → auto-link
    const byEmail = await pool.query("SELECT * FROM users WHERE email = $1", [normalizedEmail]);
    if (byEmail.rows.length) {
      user = byEmail.rows[0];
      await pool.query(
        `UPDATE users
         SET google_sub = $1,
             google_profile = $2,
             avatar_url = COALESCE($3, avatar_url),
             email_verified = TRUE
         WHERE id = $4`,
        [googleSub, profile, picture || null, user.id]
      );
      linkedExisting = true;
    } else {
      // 3) Ny bruker — krever invite-kode (mode=register + invite_code)
      if (mode !== "register" || !invite_code) {
        await logLoginEvent({
          req,
          provider: "google",
          event_type: "login_failure",
          success: false,
          failure_reason: "no_account_no_invite",
          tenant_id: tenant,
          email: normalizedEmail,
          google_profile: profile,
          utm,
        });
        return redirectToFrontend(res, tenant, {
          google_error: "need_invite",
          google_email: normalizedEmail,
          google_name: name || "",
        });
      }

      // Verifiser invite-koden
      const inviteResult = await pool.query(
        "SELECT id, max_uses, uses_count FROM invite_codes WHERE code = $1 AND active = TRUE",
        [invite_code.trim().toUpperCase()]
      );
      if (
        !inviteResult.rows.length ||
        inviteResult.rows[0].uses_count >= inviteResult.rows[0].max_uses
      ) {
        await logLoginEvent({
          req,
          provider: "google",
          event_type: "login_failure",
          success: false,
          failure_reason: "invalid_invite",
          tenant_id: tenant,
          email: normalizedEmail,
          google_profile: profile,
          utm,
        });
        return redirectToFrontend(res, tenant, { google_error: "invalid_invite" });
      }
      const invite = inviteResult.rows[0];

      // Generer unik handle fra email local-part
      const baseHandle =
        (normalizedEmail.split("@")[0] || "user")
          .replace(/[^a-z0-9_]/g, "")
          .slice(0, 40) || "user";
      let handle = baseHandle;
      for (let suffix = 0; suffix <= 999; suffix += 1) {
        const existing = await pool.query("SELECT id FROM users WHERE handle = $1", [handle]);
        if (!existing.rows.length) break;
        handle = `${baseHandle}${suffix + 1}`;
        if (suffix === 999) {
          handle = `${baseHandle}${crypto.randomBytes(3).toString("hex")}`;
        }
      }

      const displayName = name || normalizedEmail.split("@")[0];
      const avatarInitials =
        displayName
          .split(" ")
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 2) || "??";
      const colors = ["#1a6b4a", "#0e4f8a", "#7b2d8b", "#c0392b", "#d35400", "#2980b9"];
      const avatarColor = colors[Math.floor(Math.random() * colors.length)];

      const created = await pool.query(
        `INSERT INTO users
         (name, handle, email, password, avatar, avatar_color, avatar_url,
          email_verified, google_sub, auth_provider, google_profile)
         VALUES ($1, $2, $3, NULL, $4, $5, $6, TRUE, $7, 'google', $8)
         RETURNING *`,
        [
          displayName,
          handle,
          normalizedEmail,
          avatarInitials,
          avatarColor,
          picture || null,
          googleSub,
          profile,
        ]
      );
      user = created.rows[0];

      await pool.query(
        `UPDATE invite_codes
         SET uses_count = uses_count + 1, used_by = $1, used_at = NOW()
         WHERE id = $2`,
        [user.id, invite.id]
      );

      await logLoginEvent({
        req,
        user_id: user.id,
        email: user.email,
        provider: "google",
        event_type: "register",
        success: true,
        tenant_id: tenant,
        google_profile: profile,
        utm,
      });
    }
  }

  // Utsted JWT
  const token = jwt.sign(
    { id: user.id, handle: user.handle },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  await logLoginEvent({
    req,
    user_id: user.id,
    email: user.email,
    provider: "google",
    event_type: "login_success",
    success: true,
    tenant_id: tenant,
    google_profile: profile,
    utm,
  });

  // Redirect til frontend med token (query-param; frontend plukker opp og skriver til localStorage).
  const redirectParams = { token, provider: "google" };
  if (linkedExisting) redirectParams.linked = "1";
  if (redirectTarget) redirectParams.redirect = redirectTarget;
  redirectToFrontend(res, tenant, redirectParams);
});

module.exports = router;
