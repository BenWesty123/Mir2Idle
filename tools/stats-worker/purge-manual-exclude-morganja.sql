-- Manual Social exclusion for alias "Morganja" (cheating).
-- Integrity flagged: Warrior gale-necklace 8 gems (cap 7).
-- Also: gold at INT32_MAX (2147483647), ~340k kills/hour over ~54h playtime.
UPDATE leaderboard
SET
  integrity_status = 'excluded',
  integrity_reason = '[{"code":"manual_exclusion","detail":"Manually removed from Social by an administrator (cheating: illegal gem upgrades, impossible gold/kill rates)."},{"code":"gem_count","characterClass":"Warrior","slotId":"necklace","itemId":"gale-necklace","detail":"8 gem upgrades exceeds the legal cap of 7."},{"code":"manual_exclusion","detail":"gold=2147483647 (INT32_MAX); ~18.5M kills in ~54h playtime."}]',
  integrity_reviewed_at = CURRENT_TIMESTAMP
WHERE player_id = '8e3dd67b-2360-4ff1-8a5a-b92f2496532d';
