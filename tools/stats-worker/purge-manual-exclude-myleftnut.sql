-- Manual Social exclusion for alias "my left nut".
UPDATE leaderboard
SET
  integrity_status = 'excluded',
  integrity_reason = '[{"code":"manual_exclusion","detail":"Manually removed from Social by an administrator."}]',
  integrity_reviewed_at = CURRENT_TIMESTAMP
WHERE player_id = 'b6183a24-c6ca-4538-9141-06e153e767f8';
