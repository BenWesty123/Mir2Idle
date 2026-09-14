-- Restore Social rows auto-hidden for exceeding the old level-100 cap,
-- now that the cap is 150. Leaves manual exclusions and >150 cheaters hidden.
--
--   npx wrangler d1 execute lom-idle-v2-stats --file .\restore-level-cap-exclusions.sql --remote
--
UPDATE leaderboard
SET
  integrity_status = 'clear',
  integrity_reason = NULL,
  integrity_fingerprint = '',
  integrity_reviewed_at = CURRENT_TIMESTAMP
WHERE integrity_status = 'excluded'
  AND highest_level <= 150
  AND COALESCE(integrity_reason, '') LIKE '%"code":"invalid_level"%'
  AND COALESCE(integrity_reason, '') NOT LIKE '%"code":"manual_exclusion"%'
  AND NOT EXISTS (
    SELECT 1
    FROM json_each(character_levels)
    WHERE CAST(json_each.value AS INTEGER) > 150
  )
  AND NOT EXISTS (
    SELECT 1
    FROM json_each(character_stats)
    WHERE CAST(json_extract(json_each.value, '$.level') AS INTEGER) > 150
  );
