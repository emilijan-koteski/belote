CREATE TABLE hand_results (
    id SERIAL PRIMARY KEY,
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    hand_number INTEGER NOT NULL,
    red_card_points INTEGER NOT NULL,
    blue_card_points INTEGER NOT NULL,
    red_decl_points INTEGER NOT NULL,
    blue_decl_points INTEGER NOT NULL,
    last_trick_team SMALLINT NOT NULL,
    last_trick_bonus INTEGER NOT NULL,
    capot BOOLEAN NOT NULL,
    capot_team SMALLINT,
    capot_bonus INTEGER NOT NULL,
    failed_contract BOOLEAN NOT NULL,
    contracting_team SMALLINT NOT NULL,
    red_hand_total INTEGER NOT NULL,
    blue_hand_total INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (match_id, hand_number)
);

CREATE INDEX idx_hand_results_match_id ON hand_results(match_id);
