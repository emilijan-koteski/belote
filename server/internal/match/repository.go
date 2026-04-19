package match

// MatchRepository defines the persistence interface for match records.
type MatchRepository interface {
	// Create inserts a Match row without any per-hand detail. Retained for
	// callers that either do not have hand data or are intentionally writing
	// only the aggregate record (tests, legacy paths).
	Create(match *Match) error

	// CreateWithHands inserts a Match and its buffered HandResult rows inside
	// a single transaction. If any insert fails, the transaction rolls back
	// so there are never orphaned hand rows or a match without its hands.
	// Pass nil or an empty slice when no hand data is available (e.g. a
	// match abandoned before the first hand was scored).
	CreateWithHands(match *Match, hands []HandResult) error

	// GetMatchesForUser returns a page of completed / abandoned matches in
	// which the given userID appears in any of player1..player4 seats,
	// ordered newest-first (completed_at DESC, id DESC). Hand results are
	// preloaded and ordered by hand_number ASC. total is the count of all
	// matching rows, regardless of limit/offset.
	GetMatchesForUser(userID uint, limit, offset int) (items []Match, total int64, err error)

	// GetStatsForUser counts matches where userID appears in any of
	// player1..player4 seats. wins = completed AND winnerTeam matches the
	// viewer's team (seats 0/2 → Red team index 0; seats 1/3 → Blue team
	// index 1, mirroring game.TeamForSeat). losses = completed AND mismatched.
	// abandoned = any abandoned match regardless of winnerTeam. Executed in a
	// single round-trip via PostgreSQL FILTER aggregation so wins + losses +
	// abandoned is a consistent snapshot of participation count.
	GetStatsForUser(userID uint) (wins, losses, abandoned int, err error)
}
