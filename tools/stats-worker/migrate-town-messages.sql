CREATE TABLE IF NOT EXISTS town_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  character_class TEXT NOT NULL,
  character_level INTEGER NOT NULL DEFAULT 1,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL DEFAULT (datetime('now', '+14 days')),
  status TEXT NOT NULL DEFAULT 'visible'
);

CREATE INDEX IF NOT EXISTS town_messages_visible_idx
ON town_messages (status, expires_at, id DESC);

CREATE INDEX IF NOT EXISTS town_messages_player_time_idx
ON town_messages (player_id, created_at DESC);
