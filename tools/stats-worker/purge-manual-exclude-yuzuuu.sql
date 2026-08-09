-- Manual Social exclusion for alias "Yuzuuu" (cheating).
-- Integrity already flagged: Warrior gale-necklace 12 gems (cap 7) + magicResist 7 (cap 6);
-- Warrior pledge-ring 8 gems (cap 7).
UPDATE leaderboard
SET
  integrity_status = 'excluded',
  integrity_reason = '[{"code":"manual_exclusion","detail":"Manually removed from Social by an administrator (cheating: illegal gem upgrades on Warrior necklace/ring)."},{"code":"gem_count","characterClass":"Warrior","slotId":"necklace","itemId":"gale-necklace","detail":"12 gem upgrades exceeds the legal cap of 7."},{"code":"gem_stat_cap","characterClass":"Warrior","slotId":"necklace","itemId":"gale-necklace","detail":"magicResist bonus 7 exceeds 6."},{"code":"gem_count","characterClass":"Warrior","slotId":"ringR","itemId":"pledge-ring","detail":"8 gem upgrades exceeds the legal cap of 7."}]',
  integrity_reviewed_at = CURRENT_TIMESTAMP
WHERE player_id = 'f5c8371a-5dea-4dc0-89ae-4783c8ebb03e';
