DROP INDEX IF EXISTS idx_rooms_quick_play;
ALTER TABLE rooms DROP COLUMN IF EXISTS is_quick_play;
