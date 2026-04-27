DROP INDEX IF EXISTS idx_matches_surrendered_by;
ALTER TABLE matches DROP COLUMN IF EXISTS surrendered_by;
