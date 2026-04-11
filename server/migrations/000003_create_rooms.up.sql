CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(6) NOT NULL,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    variant VARCHAR(20) NOT NULL DEFAULT 'bitola',
    match_mode VARCHAR(10) NOT NULL DEFAULT '1001',
    timer_style VARCHAR(20) NOT NULL DEFAULT 'relaxed',
    timer_duration_seconds INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting',
    player_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_rooms_code ON rooms(code);
CREATE INDEX idx_rooms_owner_id ON rooms(owner_id);
CREATE INDEX idx_rooms_status ON rooms(status) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_rooms_name_active ON rooms(name) WHERE deleted_at IS NULL AND status != 'completed';
