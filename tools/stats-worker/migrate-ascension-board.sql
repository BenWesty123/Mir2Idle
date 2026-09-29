-- Ascended Social board. Run this against D1 before deploying the Worker
-- that reads and writes these columns.
ALTER TABLE leaderboard ADD COLUMN ascension_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leaderboard ADD COLUMN ascension_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leaderboard ADD COLUMN current_highest_level INTEGER NOT NULL DEFAULT 1;
ALTER TABLE leaderboard ADD COLUMN current_journey_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leaderboard ADD COLUMN best_journey_ms INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS leaderboard_ascension_idx
ON leaderboard (ascension_count DESC, best_journey_ms ASC, current_highest_level DESC);
