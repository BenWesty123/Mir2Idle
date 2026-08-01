-- Save-health telemetry: track local save size, localStorage write failures,
-- and boots from an unloadable save, to diagnose quota-related progress loss.
ALTER TABLE telemetry_sessions ADD COLUMN save_size INTEGER NOT NULL DEFAULT 0;
ALTER TABLE telemetry_sessions ADD COLUMN save_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE telemetry_sessions ADD COLUMN save_load_failed INTEGER NOT NULL DEFAULT 0;
