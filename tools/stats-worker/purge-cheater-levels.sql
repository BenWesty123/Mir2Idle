-- Remove leaderboard rows with any character above the current legitimate level cap.
DELETE FROM leaderboard
WHERE highest_level > 100
   OR EXISTS (
     SELECT 1
     FROM json_each(character_levels)
     WHERE CAST(json_each.value AS INTEGER) > 100
   )
   OR EXISTS (
     SELECT 1
     FROM json_each(character_stats)
     WHERE CAST(json_extract(json_each.value, '$.level') AS INTEGER) > 100
   );
