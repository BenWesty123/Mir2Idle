-- Manual Social exclusion for alias "BackInSaigon" (cheating).
-- Warrior 122 / Wizard 60 / Taoist 60, 993 Awakening Souls, ~115M gold,
-- ~67k kills in ~6.9h playtime. No separate alias named "Back" exists.
UPDATE leaderboard
SET
  integrity_status = 'excluded',
  integrity_reason = '[{"code":"manual_exclusion","detail":"Manually removed from Social by an administrator (cheating: impossible souls/gold/kill rates)."}]',
  integrity_reviewed_at = CURRENT_TIMESTAMP
WHERE player_id = 'd2706dac-f8c7-4450-abe0-5ba43194b3a2';
