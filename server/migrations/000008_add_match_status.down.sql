DROP INDEX IF EXISTS idx_matches_abandoned_by;
DROP INDEX IF EXISTS idx_matches_status;
ALTER TABLE matches DROP COLUMN IF EXISTS abandoned_by;
ALTER TABLE matches DROP COLUMN IF EXISTS status;
