package match

// MatchRepository defines the persistence interface for match records.
type MatchRepository interface {
	Create(match *Match) error
}
