-- Intentionally a no-op. test_runs.app_url is already added by
-- 0004_dapper_romulus, so re-adding it here failed with "duplicate column
-- name: app_url" on every database that had run 0004. Databases that already
-- applied the original version of this migration are unaffected: the migrator
-- never re-runs a migration older than the newest one it has recorded.
SELECT 1;
