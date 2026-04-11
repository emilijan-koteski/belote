package room

import (
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"

	"github.com/emilijan/belote/server/internal/apperr"
)

type GormRepository struct {
	db *gorm.DB
}

func NewGormRepository(db *gorm.DB) *GormRepository {
	return &GormRepository{db: db}
}

func (r *GormRepository) Create(room *Room) error {
	if err := r.db.Create(room).Error; err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			if strings.Contains(pgErr.ConstraintName, "idx_rooms_name_active") {
				return apperr.ErrRoomNameTaken
			}
			if strings.Contains(pgErr.ConstraintName, "idx_rooms_code") {
				return apperr.ErrRoomCodeTaken
			}
		}
		return fmt.Errorf("creating room: %w", err)
	}
	return nil
}

func (r *GormRepository) FindByStatus(status string) ([]Room, error) {
	var rooms []Room
	if err := r.db.Where("status = ?", status).Order("created_at DESC").Find(&rooms).Error; err != nil {
		return nil, fmt.Errorf("finding rooms by status: %w", err)
	}
	return rooms, nil
}

func (r *GormRepository) FindByID(id uint) (*Room, error) {
	var room Room
	if err := r.db.First(&room, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &room, nil
}
