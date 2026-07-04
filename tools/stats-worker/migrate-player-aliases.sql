CREATE TABLE IF NOT EXISTS player_aliases (
  player_id TEXT PRIMARY KEY,
  recovery_code TEXT NOT NULL,
  alias TEXT NOT NULL,
  alias_lower TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS player_aliases_alias_lower_idx
ON player_aliases (alias_lower);
