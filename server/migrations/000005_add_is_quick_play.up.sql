ALTER TABLE rooms ADD COLUMN is_quick_play BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_rooms_quick_play ON rooms(is_quick_play, status, player_count) WHERE deleted_at IS NULL AND is_quick_play = true AND status = 'waiting';
