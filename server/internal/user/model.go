package user

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID                 uint           `gorm:"primaryKey" json:"id"`
	Email              string         `gorm:"uniqueIndex;not null" json:"email"`
	Username           string         `gorm:"uniqueIndex;not null" json:"username"`
	PasswordHash       string         `gorm:"not null" json:"-"`
	LanguagePreference string         `gorm:"default:en;not null" json:"languagePreference"`
	CreatedAt          time.Time      `json:"createdAt"`
	UpdatedAt          time.Time      `json:"updatedAt"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`
}
