CREATE TABLE IF NOT EXISTS cloud_saves (
  recovery_code TEXT PRIMARY KEY,
  save_version INTEGER NOT NULL,
  save_data TEXT NOT NULL,
  client_saved_at INTEGER NOT NULL DEFAULT 0,
  save_size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS cloud_saves_saved_at_idx
ON cloud_saves (saved_at DESC);
