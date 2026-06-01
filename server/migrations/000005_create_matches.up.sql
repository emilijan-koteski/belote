CREATE TABLE matches (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(id),
    player1_id INTEGER NOT NULL REFERENCES users(id),
    player2_id INTEGER NOT NULL REFERENCES users(id),
    player3_id INTEGER NOT NULL REFERENCES users(id),
    player4_id INTEGER NOT NULL REFERENCES users(id),
    team_a_score INTEGER NOT NULL DEFAULT 0,
    team_b_score INTEGER NOT NULL DEFAULT 0,
    winner_team INTEGER NOT NULL,
    variant VARCHAR(20) NOT NULL,
    match_mode VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    abandoned_by INTEGER REFERENCES users(id),
    surrendered_by INTEGER REFERENCES users(id),
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_matches_room_id ON matches(room_id);
CREATE INDEX idx_matches_player1_id ON matches(player1_id);
CREATE INDEX idx_matches_player2_id ON matches(player2_id);
CREATE INDEX idx_matches_player3_id ON matches(player3_id);
CREATE INDEX idx_matches_player4_id ON matches(player4_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_abandoned_by ON matches(abandoned_by);
CREATE INDEX idx_matches_surrendered_by ON matches(surrendered_by);
