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

CREATE TABLE IF NOT EXISTS telemetry_sessions (
  session_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  first_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  foreground_ms INTEGER NOT NULL DEFAULT 0,
  background_ms INTEGER NOT NULL DEFAULT 0,
  combat_ms INTEGER NOT NULL DEFAULT 0,
  idle_ms INTEGER NOT NULL DEFAULT 0,
  total_ms INTEGER NOT NULL DEFAULT 0,
  heartbeats INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS telemetry_sessions_last_seen_idx
ON telemetry_sessions (last_seen DESC);

CREATE INDEX IF NOT EXISTS telemetry_sessions_player_idx
ON telemetry_sessions (player_id, last_seen DESC);

-- Server-authoritative token balances. Keyed to the player's recovery code
-- (the portable cloud-save account key). Balances are ONLY credited by the
-- Stripe webhook after a verified payment and decremented by spend endpoints.
CREATE TABLE IF NOT EXISTS token_accounts (
  recovery_code TEXT PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Append-only audit trail of every credit (purchase) and spend.
CREATE TABLE IF NOT EXISTS token_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recovery_code TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS token_ledger_account_idx
ON token_ledger (recovery_code, id DESC);

-- Idempotency guard: each Stripe event id is processed at most once so
-- webhook retries never double-credit.
CREATE TABLE IF NOT EXISTS stripe_events (
  event_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Server-authoritative record of one-off token unlocks the player owns
-- (e.g. a 3rd inventory page per character, a 3rd storage page). This is the
-- source of truth so unlocks survive save resets, rebirth, and device changes.
CREATE TABLE IF NOT EXISTS account_unlocks (
  recovery_code TEXT NOT NULL,
  unlock_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (recovery_code, unlock_key)
);

-- Server-authoritative record of re-buyable, time-limited subscriptions (e.g.
-- the Monthly Supporter perk). Unlike account_unlocks these are NOT permanent:
-- `expires_at` is an epoch-ms timestamp and buying again extends it. Keyed to the
-- portable recovery code so the perk survives save resets and device changes.
CREATE TABLE IF NOT EXISTS account_subscriptions (
  recovery_code TEXT NOT NULL,
  subscription_key TEXT NOT NULL,
  expires_at INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (recovery_code, subscription_key)
);

-- Player-chosen public display names (aliases) shown on the Social tab and the
-- town noticeboard in place of the derived `Player XXXXXXXX` label. Keyed to the
-- account `player_id`; the owning `recovery_code` is stored so only the account
-- that first claimed a name can change it. `alias_lower` enforces case-insensitive
-- uniqueness across all players.
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
