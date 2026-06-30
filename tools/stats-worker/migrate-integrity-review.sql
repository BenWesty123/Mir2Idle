ALTER TABLE leaderboard ADD COLUMN integrity_status TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE leaderboard ADD COLUMN integrity_reason TEXT;
ALTER TABLE leaderboard ADD COLUMN integrity_fingerprint TEXT;
ALTER TABLE leaderboard ADD COLUMN integrity_approved_fingerprint TEXT;
ALTER TABLE leaderboard ADD COLUMN integrity_rules_version TEXT;
ALTER TABLE leaderboard ADD COLUMN integrity_flagged_at TEXT;
ALTER TABLE leaderboard ADD COLUMN integrity_reviewed_at TEXT;

CREATE INDEX IF NOT EXISTS leaderboard_integrity_idx
ON leaderboard (integrity_status, integrity_flagged_at DESC);
