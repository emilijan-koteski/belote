ALTER TABLE matches ADD COLUMN IF NOT EXISTS surrendered_by INTEGER REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_matches_surrendered_by ON matches(surrendered_by);
