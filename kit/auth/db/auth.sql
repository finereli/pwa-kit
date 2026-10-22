-- pwa-kit: auth/db/auth.sql v7
-- Users and sessions for the Google sign-in flow (functions/api/auth.ts).
-- `is_admin` gates admin apps (REQUIRE_ADMIN in functions/api/_config.ts);
-- flip it by hand: UPDATE users SET is_admin = 1 WHERE email = '…';
CREATE TABLE IF NOT EXISTS users (
  google_id   TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  name        TEXT,
  picture     TEXT,
  is_admin    INTEGER NOT NULL DEFAULT 0,
  first_seen  TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  google_id  TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_google_id ON sessions(google_id);
