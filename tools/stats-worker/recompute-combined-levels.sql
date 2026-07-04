-- One-off backfill: recompute combined_character_levels from the stored
-- per-character character_levels JSON.
--
-- Why: the leaderboard upsert previously wrote
--   combined_character_levels = MAX(existing, incoming)
-- so the ranking column only ever ratcheted up and kept each account's
-- pre-rebirth peak (e.g. 142) instead of the current combined level
-- (e.g. 3x level 45 = 135). character_levels itself was always overwritten
-- with the latest submission, so it is the accurate source to rebuild from.
--
-- Safe to run repeatedly (idempotent). Rows with no/invalid character_levels
-- JSON are left untouched.

UPDATE leaderboard
SET combined_character_levels = (
  SELECT COALESCE(SUM(CAST(json_each.value AS INTEGER)), 0)
  FROM json_each(leaderboard.character_levels)
)
WHERE character_levels IS NOT NULL
  AND json_valid(character_levels);
