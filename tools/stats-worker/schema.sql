CREATE TABLE IF NOT EXISTS leaderboard (
  player_id TEXT PRIMARY KEY,
  highest_level INTEGER NOT NULL DEFAULT 1,
  experience INTEGER NOT NULL DEFAULT 0,
  kills INTEGER NOT NULL DEFAULT 0,
  zone_kills INTEGER NOT NULL DEFAULT 0,
  boss_kills TEXT NOT NULL DEFAULT '{}',
  gold INTEGER NOT NULL DEFAULT 0,
  playtime_ms INTEGER NOT NULL DEFAULT 0,
  active_zone_id TEXT,
  save_version INTEGER NOT NULL DEFAULT 1,
  rebirth_count INTEGER NOT NULL DEFAULT 0,
  rebirth_points_gained INTEGER NOT NULL DEFAULT 0,
  rebirth_points_spent INTEGER NOT NULL DEFAULT 0,
  character_levels TEXT NOT NULL DEFAULT '{}',
  character_stats TEXT NOT NULL DEFAULT '[]',
  awakening_souls_held INTEGER NOT NULL DEFAULT 0,
  combined_character_levels INTEGER NOT NULL DEFAULT 0,
  last_reason TEXT,
  integrity_status TEXT NOT NULL DEFAULT 'legacy',
  integrity_reason TEXT,
  integrity_fingerprint TEXT,
  integrity_approved_fingerprint TEXT,
  integrity_rules_version TEXT,
  integrity_flagged_at TEXT,
  integrity_reviewed_at TEXT,
  first_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS leaderboard_rank_idx
ON leaderboard (combined_character_levels DESC, awakening_souls_held DESC, highest_level DESC);

CREATE INDEX IF NOT EXISTS leaderboard_integrity_idx
ON leaderboard (integrity_status, integrity_flagged_at DESC);

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
