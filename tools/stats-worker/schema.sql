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
  last_reason TEXT,
  first_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS leaderboard_rank_idx
ON leaderboard (highest_level DESC, experience DESC, kills DESC);
