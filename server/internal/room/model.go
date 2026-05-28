package room

import (
	"time"

	"gorm.io/gorm"
)

type Room struct {
	ID                   uint           `gorm:"primaryKey" json:"id"`
	Name                 string         `gorm:"size:100;not null" json:"name"`
	Code                 string         `gorm:"size:6;uniqueIndex;not null" json:"code"`
	OwnerID              uint           `gorm:"not null;index" json:"ownerId"`
	// OwnerUsername is populated at the handler layer via a JOIN to `users`
	// before serialization. Not persisted on rooms (no migration), avoids the
	// extra write-path responsibility a denormalized column would create.
	OwnerUsername        string         `gorm:"-" json:"ownerUsername"`
	// Players is populated by the list-rooms handler so the lobby grid can
	// render seat chips inline without an extra round-trip per card. Marked
	// `omitempty` so the GET /rooms/:id detail endpoint, which returns players
	// via its own envelope, doesn't accidentally double-serialize them.
	Players              []RoomPlayer   `gorm:"-" json:"players,omitempty"`
	Variant              string         `gorm:"size:20;not null;default:bitola" json:"variant"`
	MatchMode            string         `gorm:"size:10;not null;default:1001" json:"matchMode"`
	TimerStyle           string         `gorm:"size:20;not null;default:relaxed" json:"timerStyle"`
	TimerDurationSeconds *int           `json:"timerDurationSeconds"`
	ReconnectWindowSec   *int           `json:"reconnectWindowSec"`
	Status               string         `gorm:"size:20;not null;default:waiting;index" json:"status"`
	PlayerCount          int            `gorm:"not null;default:1" json:"playerCount"`
	IsQuickPlay          bool           `gorm:"not null;default:false" json:"isQuickPlay"`
	CreatedAt            time.Time      `json:"createdAt"`
	UpdatedAt            time.Time      `json:"updatedAt"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"-"`
}

type RoomPlayer struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	RoomID    uint      `gorm:"not null;index" json:"roomId"`
	UserID    uint      `gorm:"not null;index" json:"userId"`
	Username  string    `gorm:"-" json:"username"`
	Seat      *int      `json:"seat"`
	Team      *string   `gorm:"size:10" json:"team"`
	CreatedAt time.Time `json:"createdAt"`
}
