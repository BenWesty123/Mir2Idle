-- Remove bugged EvertonHero save clones from Social.
-- Keep the real account (alias EvertonHero); delete the anonymous duplicates
-- that share the same stuck level/souls fingerprint.
DELETE FROM leaderboard
WHERE awakening_souls_held = 369
  AND highest_level = 55
  AND combined_character_levels = 151
  AND json_extract(character_levels, '$.Warrior') = 55
  AND json_extract(character_levels, '$.Wizard') = 48
  AND json_extract(character_levels, '$.Taoist') = 48
  AND player_id NOT IN (
    SELECT player_id FROM player_aliases WHERE alias_lower = 'evertonhero'
  );
