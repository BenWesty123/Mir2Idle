-- Manual Social exclusion for alias "Aluv" (old account before rename).
UPDATE leaderboard
SET
  integrity_status = 'excluded',
  integrity_reason = '[{"code":"manual_exclusion","detail":"Manually removed from Social by an administrator (old account before rename)."}]',
  integrity_reviewed_at = CURRENT_TIMESTAMP
WHERE player_id = 'cc5a74f0-e6e5-49c2-8c14-bee8a732ff6f';
