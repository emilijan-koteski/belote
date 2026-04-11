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
	Variant              string         `gorm:"size:20;not null;default:bitola" json:"variant"`
	MatchMode            string         `gorm:"size:10;not null;default:1001" json:"matchMode"`
	TimerStyle           string         `gorm:"size:20;not null;default:relaxed" json:"timerStyle"`
	TimerDurationSeconds *int           `json:"timerDurationSeconds"`
	Status               string         `gorm:"size:20;not null;default:waiting;index" json:"status"`
	PlayerCount          int            `gorm:"not null;default:1" json:"playerCount"`
	CreatedAt            time.Time      `json:"createdAt"`
	UpdatedAt            time.Time      `json:"updatedAt"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"-"`
}
