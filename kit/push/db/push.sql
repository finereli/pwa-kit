-- pwa-kit: push/db/push.sql v2
-- One row per device that turned push on. Rows the push service reports as
-- gone (404/410) are deleted by fanOut.
CREATE TABLE push_subs (
  endpoint   TEXT PRIMARY KEY,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
