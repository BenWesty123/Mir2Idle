ALTER TABLE leaderboard ADD COLUMN awakening_souls_held INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leaderboard ADD COLUMN combined_character_levels INTEGER NOT NULL DEFAULT 0;

UPDATE leaderboard
SET combined_character_levels = (
  SELECT IFNULL(SUM(CAST(value AS INTEGER)), 0)
  FROM json_each(character_levels)
)
WHERE instr(player_id, ':') = 0;

CREATE INDEX IF NOT EXISTS leaderboard_account_rank_idx
ON leaderboard (combined_character_levels DESC, awakening_souls_held DESC, highest_level DESC);
