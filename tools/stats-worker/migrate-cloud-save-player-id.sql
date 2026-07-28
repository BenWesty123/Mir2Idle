-- Bind each recovery code to a canonical Social / leaderboard player_id so
-- cloud restore can re-adopt the same identity on a new device.
ALTER TABLE cloud_saves ADD COLUMN player_id TEXT;
