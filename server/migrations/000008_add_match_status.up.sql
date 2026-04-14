ALTER TABLE matches ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'completed';
ALTER TABLE matches ADD COLUMN abandoned_by INTEGER REFERENCES users(id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_abandoned_by ON matches(abandoned_by);
