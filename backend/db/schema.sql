-- ============================================
-- HelpTruth - Database Schema v2
-- Kjør denne i PostgreSQL for å sette opp DB
-- ============================================

-- Slett eksisterende tabeller (for utvikling)
DROP TABLE IF EXISTS poll_votes CASCADE;
DROP TABLE IF EXISTS polls CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS bookmarks CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS follows CASCADE;
DROP TABLE IF EXISTS likes CASCADE;
DROP TABLE IF EXISTS reposts CASCADE;
DROP TABLE IF EXISTS replies CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ── USERS ──────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL,
  handle      VARCHAR(50)  UNIQUE NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  bio         TEXT         DEFAULT '',
  avatar      VARCHAR(5)   NOT NULL,
  avatar_color VARCHAR(10) DEFAULT '#1a6b4a',
  profile_image TEXT       DEFAULT NULL,          -- Cloudinary URL
  verified    BOOLEAN      DEFAULT FALSE,
  followers_count  INT DEFAULT 0,
  following_count  INT DEFAULT 0,
  posts_count      INT DEFAULT 0,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ── POSTS ──────────────────────────────────────────────────────────────────
CREATE TABLE posts (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) <= 280),
  image_url   TEXT         DEFAULT NULL,           -- Bilde knyttet til innlegg
  quote_post_id INT        REFERENCES posts(id) ON DELETE SET NULL, -- Sitatinnlegg
  likes_count    INT DEFAULT 0,
  reposts_count  INT DEFAULT 0,
  replies_count  INT DEFAULT 0,
  views_count    INT DEFAULT 0,
  quotes_count   INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── LIKES ──────────────────────────────────────────────────────────────────
CREATE TABLE likes (
  id       SERIAL PRIMARY KEY,
  user_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id  INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- ── REPOSTS ────────────────────────────────────────────────────────────────
CREATE TABLE reposts (
  id       SERIAL PRIMARY KEY,
  user_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id  INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- ── REPLIES ────────────────────────────────────────────────────────────────
CREATE TABLE replies (
  id        SERIAL PRIMARY KEY,
  user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id   INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  content   TEXT NOT NULL CHECK (char_length(content) <= 280),
  image_url TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── FOLLOWS ────────────────────────────────────────────────────────────────
CREATE TABLE follows (
  id           SERIAL PRIMARY KEY,
  follower_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);

-- ── BOOKMARKS ──────────────────────────────────────────────────────────────
CREATE TABLE bookmarks (
  id       SERIAL PRIMARY KEY,
  user_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id  INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- ── NOTIFICATIONS ──────────────────────────────────────────────────────────
CREATE TABLE notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_user_id INT REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(20) NOT NULL,  -- 'like', 'repost', 'reply', 'follow', 'quote'
  post_id     INT REFERENCES posts(id) ON DELETE CASCADE,
  read        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── MESSAGES (Direktemeldinger) ────────────────────────────────────────────
CREATE TABLE messages (
  id          SERIAL PRIMARY KEY,
  sender_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) <= 1000),
  read        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── POLLS (Avstemninger) ───────────────────────────────────────────────────
CREATE TABLE polls (
  id       SERIAL PRIMARY KEY,
  post_id  INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  options  JSONB NOT NULL,         -- ["Alternativ 1", "Alternativ 2", ...]
  votes    JSONB DEFAULT '{}',     -- {"0": 12, "1": 8, ...}
  ends_at  TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE poll_votes (
  id       SERIAL PRIMARY KEY,
  poll_id  INT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_index INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);

-- ── INDEKSER ───────────────────────────────────────────────────────────────
CREATE INDEX idx_posts_user_id       ON posts(user_id);
CREATE INDEX idx_posts_created_at    ON posts(created_at DESC);
CREATE INDEX idx_posts_quote         ON posts(quote_post_id) WHERE quote_post_id IS NOT NULL;
CREATE INDEX idx_likes_post_id       ON likes(post_id);
CREATE INDEX idx_follows_follower    ON follows(follower_id);
CREATE INDEX idx_follows_following   ON follows(following_id);
CREATE INDEX idx_notif_user_id       ON notifications(user_id);
CREATE INDEX idx_notif_unread        ON notifications(user_id) WHERE read = FALSE;
CREATE INDEX idx_messages_conv       ON messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX idx_messages_unread     ON messages(receiver_id) WHERE read = FALSE;
CREATE INDEX idx_polls_post          ON polls(post_id);
CREATE INDEX idx_posts_content_trgm  ON posts USING gin (content gin_trgm_ops);

-- ── TESTDATA ───────────────────────────────────────────────────────────────
INSERT INTO users (name, handle, email, password, bio, avatar, avatar_color, verified) VALUES
  ('Heljar Vindvik', 'heljar', 'heljar@startfunder.no',
   '$2a$10$rOzuU3VhFQmOzGRVtlUxZO7n9SfKwqVqLmXpIe8vRJzWkRbQdOKJu',
   'Founder @StartFunder | Fintech | Blockchain | ECSP-lisens',
   'HV', '#1a6b4a', TRUE),

  ('StartFunder', 'startfunder', 'kontakt@startfunder.no',
   '$2a$10$rOzuU3VhFQmOzGRVtlUxZO7n9SfKwqVqLmXpIe8vRJzWkRbQdOKJu',
   'Norges første crowdlending-plattform med blockchain. ECSP-lisensiert.',
   'SF', '#0e4f8a', TRUE),

  ('Crypto Norge', 'cryptonorge', 'post@cryptonorge.no',
   '$2a$10$rOzuU3VhFQmOzGRVtlUxZO7n9SfKwqVqLmXpIe8vRJzWkRbQdOKJu',
   'Norsk kryptovaluta-samfunn',
   'CN', '#7b2d8b', FALSE);

INSERT INTO posts (user_id, content, likes_count, reposts_count, views_count) VALUES
  (1, 'StartFunder er nå live! Norges første crowdlending-plattform med blockchain-integrasjon via StartCoin (STRT). Fremtiden for eiendomsinvestering er her.', 42, 18, 1240),
  (2, 'DeFi møter norsk eiendomsmarked. Med ECSP-lisens fra Litauen åpner vi nå for europeiske investorer. Meld deg på ventelisten! #Crowdlending #NorskFintech', 89, 41, 3400),
  (3, 'Interessant å se at norske fintech-aktører begynner å ta blockchain på alvor. @startfunder er et godt eksempel på regulert tokenisering. #Tokenisering', 156, 67, 8900);
