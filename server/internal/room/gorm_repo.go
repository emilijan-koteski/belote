package room

import (
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

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

func (r *GormRepository) Update(room *Room) error {
	if err := r.db.Save(room).Error; err != nil {
		return fmt.Errorf("updating room: %w", err)
	}
	return nil
}

func (r *GormRepository) AddPlayer(roomPlayer *RoomPlayer) error {
	if err := r.db.Create(roomPlayer).Error; err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			if strings.Contains(pgErr.ConstraintName, "idx_room_players_room_user") {
				return apperr.ErrAlreadyInRoom
			}
		}
		return fmt.Errorf("adding player to room: %w", err)
	}
	return nil
}

func (r *GormRepository) RemovePlayer(roomID uint, userID uint) error {
	result := r.db.Where("room_id = ? AND user_id = ?", roomID, userID).Delete(&RoomPlayer{})
	if result.Error != nil {
		return fmt.Errorf("removing player from room: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperr.ErrNotInRoom
	}
	return nil
}

func (r *GormRepository) FindPlayersByRoomID(roomID uint) ([]RoomPlayer, error) {
	var players []RoomPlayer
	err := r.db.Table("room_players").
		Select("room_players.*, users.username").
		Joins("JOIN users ON users.id = room_players.user_id").
		Where("room_players.room_id = ?", roomID).
		Order("room_players.created_at ASC").
		Scan(&players).Error
	if err != nil {
		return nil, fmt.Errorf("finding players for room %d: %w", roomID, err)
	}
	if players == nil {
		players = []RoomPlayer{}
	}
	return players, nil
}

func (r *GormRepository) FindPlayerRoom(userID uint) (*RoomPlayer, error) {
	var player RoomPlayer
	err := r.db.Table("room_players").
		Joins("JOIN rooms ON rooms.id = room_players.room_id").
		Where("room_players.user_id = ? AND rooms.status IN (?, ?) AND rooms.deleted_at IS NULL", userID, "waiting", "playing").
		First(&player).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("finding player room for user %d: %w", userID, err)
	}
	return &player, nil
}

func (r *GormRepository) UpdatePlayerSeat(roomID uint, userID uint, seat int, team string) error {
	result := r.db.Model(&RoomPlayer{}).
		Where("room_id = ? AND user_id = ?", roomID, userID).
		Updates(map[string]interface{}{"seat": seat, "team": team})
	if result.Error != nil {
		return fmt.Errorf("updating player seat: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperr.ErrNotInRoom
	}
	return nil
}

func (r *GormRepository) ClearPlayerSeat(roomID uint, userID uint) error {
	result := r.db.Model(&RoomPlayer{}).
		Where("room_id = ? AND user_id = ?", roomID, userID).
		Updates(map[string]interface{}{"seat": nil, "team": nil})
	if result.Error != nil {
		return fmt.Errorf("clearing player seat: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperr.ErrNotInRoom
	}
	return nil
}

func (r *GormRepository) FindPlayerBySeat(roomID uint, seat int) (*RoomPlayer, error) {
	var player RoomPlayer
	err := r.db.Table("room_players").
		Select("room_players.*, users.username").
		Joins("JOIN users ON users.id = room_players.user_id").
		Where("room_players.room_id = ? AND room_players.seat = ?", roomID, seat).
		Scan(&player).Error
	if err != nil {
		return nil, fmt.Errorf("finding player by seat: %w", err)
	}
	if player.ID == 0 {
		return nil, nil
	}
	return &player, nil
}

func (r *GormRepository) FindQuickPlayRoom() (*Room, error) {
	var room Room
	err := r.db.Clauses(clause.Locking{Strength: "UPDATE", Options: "SKIP LOCKED"}).
		Where("is_quick_play = ? AND status = ? AND player_count < 4", true, "waiting").
		Order("created_at ASC").
		First(&room).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("finding quick play room: %w", err)
	}
	return &room, nil
}

func (r *GormRepository) RunInTransaction(fn func(RoomRepository) error) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		txRepo := &GormRepository{db: tx}
		return fn(txRepo)
	})
}

func (r *GormRepository) IncrementPlayerCount(roomID uint) error {
	result := r.db.Model(&Room{}).Where("id = ?", roomID).Update("player_count", gorm.Expr("player_count + 1"))
	if result.Error != nil {
		return fmt.Errorf("incrementing player count: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperr.ErrRoomNotFound
	}
	return nil
}

func (r *GormRepository) DecrementPlayerCount(roomID uint) error {
	result := r.db.Model(&Room{}).Where("id = ? AND player_count > 0", roomID).Update("player_count", gorm.Expr("player_count - 1"))
	if result.Error != nil {
		return fmt.Errorf("decrementing player count: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperr.ErrRoomNotFound
	}
	return nil
}
