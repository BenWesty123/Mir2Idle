ALTER TABLE leaderboard ADD COLUMN rebirth_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leaderboard ADD COLUMN rebirth_points_gained INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leaderboard ADD COLUMN rebirth_points_spent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leaderboard ADD COLUMN character_levels TEXT NOT NULL DEFAULT '{}';
ALTER TABLE leaderboard ADD COLUMN character_stats TEXT NOT NULL DEFAULT '[]';
