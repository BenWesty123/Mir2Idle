-- Manual Social exclusion for alias "Mulio".
UPDATE leaderboard
SET
  integrity_status = 'excluded',
  integrity_reason = '[{"code":"manual_exclusion","detail":"Manually removed from Social by an administrator."}]',
  integrity_reviewed_at = CURRENT_TIMESTAMP
WHERE player_id = '612bd7e8-6bff-4370-b339-4986eddaba87';
