package match

import "time"

// Match represents a completed game match record persisted to the database.
type Match struct {
	ID            uint         `gorm:"primaryKey" json:"id"`
	RoomID        uint         `gorm:"not null;index" json:"roomId"`
	Player1ID     uint         `gorm:"not null;index" json:"player1Id"`
	Player2ID     uint         `gorm:"not null;index" json:"player2Id"`
	Player3ID     uint         `gorm:"not null;index" json:"player3Id"`
	Player4ID     uint         `gorm:"not null;index" json:"player4Id"`
	TeamRedScore  int          `gorm:"not null" json:"teamRedScore"`
	TeamBlueScore int          `gorm:"not null" json:"teamBlueScore"`
	WinnerTeam    int          `gorm:"not null" json:"winnerTeam"`
	Variant       string       `gorm:"size:20;not null" json:"variant"`
	MatchMode     string       `gorm:"size:10;not null" json:"matchMode"`
	StartedAt     time.Time    `gorm:"not null" json:"startedAt"`
	CompletedAt   time.Time    `gorm:"not null" json:"completedAt"`
	Status        string       `gorm:"size:20;not null;default:completed" json:"status"`
	AbandonedBy   *uint        `gorm:"index" json:"abandonedBy,omitempty"`
	CreatedAt     time.Time    `json:"createdAt"`
	Hands         []HandResult `gorm:"foreignKey:MatchID;constraint:OnDelete:CASCADE" json:"-"`
}
