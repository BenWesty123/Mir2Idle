-- Manual Social exclusion for cheating account (was alias "im a cunt").
UPDATE leaderboard
SET
  integrity_status = 'excluded',
  integrity_reason = '[{"code":"manual_exclusion","detail":"Manually removed from Social by an administrator (cheating)."}]',
  integrity_reviewed_at = CURRENT_TIMESTAMP
WHERE player_id = '9536897a-2246-4a10-9a92-194d0bb1bcfc';
