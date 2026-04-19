package match

import "time"

// HandResult persists the scoring breakdown for a single completed hand of a match.
// Buffered in session memory during play, then flushed transactionally alongside
// the Match row via MatchRepository.CreateWithHands when the match ends.
//
// Distinct from game.HandResult (the in-memory broadcast struct): this type is
// DB-facing and carries MatchID + HandNumber, not the match-lifecycle fields.
type HandResult struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	MatchID         uint      `gorm:"not null;index;uniqueIndex:idx_hand_results_match_hand" json:"matchId"`
	HandNumber      int       `gorm:"not null;uniqueIndex:idx_hand_results_match_hand" json:"handNumber"`
	RedCardPoints   int       `gorm:"not null" json:"redCardPoints"`
	BlueCardPoints  int       `gorm:"not null" json:"blueCardPoints"`
	RedDeclPoints   int       `gorm:"not null" json:"redDeclPoints"`
	BlueDeclPoints  int       `gorm:"not null" json:"blueDeclPoints"`
	LastTrickTeam   int       `gorm:"not null" json:"lastTrickTeam"`
	LastTrickBonus  int       `gorm:"not null" json:"lastTrickBonus"`
	Capot           bool      `gorm:"not null" json:"capot"`
	CapotTeam       *int      `json:"capotTeam,omitempty"`
	CapotBonus      int       `gorm:"not null" json:"capotBonus"`
	FailedContract  bool      `gorm:"not null" json:"failedContract"`
	ContractingTeam int       `gorm:"not null" json:"contractingTeam"`
	RedHandTotal    int       `gorm:"not null" json:"redHandTotal"`
	BlueHandTotal   int       `gorm:"not null" json:"blueHandTotal"`
	CreatedAt       time.Time `json:"createdAt"`
}
