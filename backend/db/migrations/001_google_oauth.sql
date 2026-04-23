-- ============================================
-- Migration 001 — Google OAuth + login_events
-- Idempotent: safe to run multiple times
-- ============================================

-- ── USERS: Google OAuth fields ────────────────────────────────────────────
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub      TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider   VARCHAR(20) DEFAULT 'email';
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_profile  JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url      TEXT;

CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL;

-- ── LOGIN_EVENTS: full auth-event tracking ────────────────────────────────
-- Replaces login_logs (superset). Identical schema to StartMarket's
-- LoginEvent Prisma model so rows can be merged if we centralize later.
CREATE TABLE IF NOT EXISTS login_events (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             INT REFERENCES users(id) ON DELETE SET NULL,
  email               VARCHAR(255),
  provider            VARCHAR(20) NOT NULL,        -- 'google' | 'email'
  event_type          VARCHAR(20) NOT NULL,        -- 'login_success' | 'login_failure' | 'logout' | 'register'
  success             BOOLEAN     NOT NULL,
  failure_reason      TEXT,
  ip_address          VARCHAR(45),
  user_agent          TEXT,
  country             VARCHAR(2),                  -- ISO 3166-1 alpha-2
  tenant_id           VARCHAR(50),                 -- 'breedz' | 'helptruth'
  google_profile      JSONB,                       -- full Google profile on OAuth
  referer             TEXT,
  utm_source          VARCHAR(100),
  utm_medium          VARCHAR(100),
  utm_campaign        VARCHAR(100),
  device_fingerprint  VARCHAR(100),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_events_user_id    ON login_events(user_id);
CREATE INDEX IF NOT EXISTS idx_login_events_email      ON login_events(email);
CREATE INDEX IF NOT EXISTS idx_login_events_created    ON login_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_events_provider   ON login_events(provider);
CREATE INDEX IF NOT EXISTS idx_login_events_tenant     ON login_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_login_events_failures   ON login_events(created_at DESC) WHERE success = FALSE;
