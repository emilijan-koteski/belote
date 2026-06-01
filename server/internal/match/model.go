package match

import "time"

// PlayerSeatInfo holds the player info needed for live-match initialization.
// Defined here (not in room) to avoid an import cycle: match←→room via auth←user.
type PlayerSeatInfo struct {
	UserID   uint
	Username string
	Seat     int
}

// Match represents a completed game match record persisted to the database.
type Match struct {
	ID            uint         `gorm:"primaryKey" json:"id"`
	RoomID        uint         `gorm:"not null;index" json:"roomId"`
	Player1ID     uint         `gorm:"not null;index" json:"player1Id"`
	Player2ID     uint         `gorm:"not null;index" json:"player2Id"`
	Player3ID     uint         `gorm:"not null;index" json:"player3Id"`
	Player4ID     uint         `gorm:"not null;index" json:"player4Id"`
	TeamAScore    int          `gorm:"column:team_a_score;not null" json:"teamAScore"`
	TeamBScore    int          `gorm:"column:team_b_score;not null" json:"teamBScore"`
	WinnerTeam    int          `gorm:"not null" json:"winnerTeam"`
	Variant       string       `gorm:"size:20;not null" json:"variant"`
	MatchMode     string       `gorm:"size:10;not null" json:"matchMode"`
	StartedAt     time.Time    `gorm:"not null" json:"startedAt"`
	CompletedAt   time.Time    `gorm:"not null" json:"completedAt"`
	Status        string       `gorm:"size:20;not null;default:completed" json:"status"`
	AbandonedBy   *uint        `gorm:"index" json:"abandonedBy,omitempty"`
	SurrenderedBy *uint        `gorm:"index" json:"surrenderedBy,omitempty"`
	CreatedAt     time.Time    `json:"createdAt"`
	Hands         []HandResult `gorm:"foreignKey:MatchID;constraint:OnDelete:CASCADE" json:"-"`
}
