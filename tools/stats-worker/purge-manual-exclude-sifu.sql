-- Manual Social exclusion for alias "Sifu".
UPDATE leaderboard
SET
  integrity_status = 'excluded',
  integrity_reason = '[{"code":"manual_exclusion","detail":"Manually removed from Social by an administrator."}]',
  integrity_reviewed_at = CURRENT_TIMESTAMP
WHERE player_id = '1036cc44-a68d-460a-b8bb-66c4620ff9bb';
