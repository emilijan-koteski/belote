package room

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/emilijan/belote/server/internal/apperr"
	"github.com/emilijan/belote/server/internal/auth"
)

var (
	validVariants   = map[string]bool{"bitola": true}
	validMatchModes = map[string]bool{"1001": true}
	validTimerStyles  = map[string]bool{"relaxed": true, "per-move": true}
	validStatuses     = map[string]bool{"waiting": true, "playing": true, "finished": true, "completed": true}
)

const (
	codeChars  = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	codeLength = 6
	maxRetries = 3
)

type CreateRoomRequest struct {
	Name                 string `json:"name"`
	Variant              string `json:"variant"`
	MatchMode            string `json:"matchMode"`
	TimerStyle           string `json:"timerStyle"`
	TimerDurationSeconds *int   `json:"timerDurationSeconds"`
}

type RoomHandler struct {
	repo RoomRepository
}

func NewRoomHandler(repo RoomRepository) *RoomHandler {
	return &RoomHandler{repo: repo}
}

func (h *RoomHandler) CreateRoom(c echo.Context) error {
	userID, err := auth.GetUserID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	var req CreateRoomRequest
	if err := c.Bind(&req); err != nil {
		return apperr.ErrBadRequest
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		return apperr.ErrRoomNameRequired
	}
	if len(name) > 100 {
		return apperr.ErrRoomNameTooLong
	}

	variant := req.Variant
	if variant == "" {
		variant = "bitola"
	}
	if !validVariants[variant] {
		return apperr.ErrInvalidVariant
	}

	matchMode := req.MatchMode
	if matchMode == "" {
		matchMode = "1001"
	}
	if !validMatchModes[matchMode] {
		return apperr.ErrInvalidMatchMode
	}

	timerStyle := req.TimerStyle
	if timerStyle == "" {
		timerStyle = "relaxed"
	}
	if !validTimerStyles[timerStyle] {
		return apperr.ErrInvalidTimerStyle
	}

	var timerDuration *int
	if timerStyle == "per-move" {
		if req.TimerDurationSeconds == nil {
			return apperr.ErrTimerDurationRequired
		}
		d := *req.TimerDurationSeconds
		if d < 10 || d > 120 {
			return apperr.ErrTimerDurationOutOfRange
		}
		timerDuration = req.TimerDurationSeconds
	}

	code, err := generateRoomCode()
	if err != nil {
		return fmt.Errorf("generating room code: %w", err)
	}

	room := &Room{
		Name:                 name,
		Code:                 code,
		OwnerID:              userID,
		Variant:              variant,
		MatchMode:            matchMode,
		TimerStyle:           timerStyle,
		TimerDurationSeconds: timerDuration,
		Status:               "waiting",
		PlayerCount:          1,
	}

	var createErr error
	for i := 0; i < maxRetries; i++ {
		createErr = h.repo.RunInTransaction(func(tx RoomRepository) error {
			if err := tx.Create(room); err != nil {
				return err
			}
			rp := &RoomPlayer{RoomID: room.ID, UserID: userID}
			if err := tx.AddPlayer(rp); err != nil {
				return fmt.Errorf("adding creator to room players: %w", err)
			}
			return nil
		})
		if createErr == nil {
			break
		}
		if errors.Is(createErr, apperr.ErrRoomCodeTaken) {
			newCode, codeErr := generateRoomCode()
			if codeErr != nil {
				return fmt.Errorf("generating room code: %w", codeErr)
			}
			room.Code = newCode
			continue
		}
		return createErr
	}
	if createErr != nil {
		return createErr
	}

	// TODO: broadcast via WS hub when available (Story 2.2)

	return c.JSON(http.StatusCreated, map[string]interface{}{"data": room})
}

func (h *RoomHandler) ListRooms(c echo.Context) error {
	status := c.QueryParam("status")
	if status == "" {
		status = "waiting"
	}

	if !validStatuses[status] {
		return apperr.ErrInvalidRoomStatus
	}

	rooms, err := h.repo.FindByStatus(status)
	if err != nil {
		return fmt.Errorf("listing rooms: %w", err)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"data": rooms})
}

type RoomDetailResponse struct {
	Room    *Room        `json:"room"`
	Players []RoomPlayer `json:"players"`
}

func (h *RoomHandler) GetRoom(c echo.Context) error {
	roomID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		return apperr.ErrRoomNotFound
	}

	room, err := h.repo.FindByID(uint(roomID))
	if err != nil {
		return fmt.Errorf("finding room: %w", err)
	}
	if room == nil {
		return apperr.ErrRoomNotFound
	}

	players, err := h.repo.FindPlayersByRoomID(uint(roomID))
	if err != nil {
		return fmt.Errorf("finding room players: %w", err)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": RoomDetailResponse{
			Room:    room,
			Players: players,
		},
	})
}

func (h *RoomHandler) JoinRoom(c echo.Context) error {
	userID, err := auth.GetUserID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	roomID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		return apperr.ErrRoomNotFound
	}

	room, err := h.repo.FindByID(uint(roomID))
	if err != nil {
		return fmt.Errorf("finding room: %w", err)
	}
	if room == nil {
		return apperr.ErrRoomNotFound
	}

	if room.Status != "waiting" {
		return apperr.ErrRoomNotFound
	}

	if room.PlayerCount >= 4 {
		return apperr.ErrRoomFull
	}

	existingRoom, err := h.repo.FindPlayerRoom(userID)
	if err != nil {
		return fmt.Errorf("checking existing room: %w", err)
	}
	if existingRoom != nil {
		return apperr.ErrAlreadyInRoom
	}

	var updatedRoom *Room
	if err := h.repo.RunInTransaction(func(tx RoomRepository) error {
		rp := &RoomPlayer{RoomID: uint(roomID), UserID: userID}
		if err := tx.AddPlayer(rp); err != nil {
			return err
		}
		if err := tx.IncrementPlayerCount(uint(roomID)); err != nil {
			return fmt.Errorf("incrementing player count: %w", err)
		}
		r, err := tx.FindByID(uint(roomID))
		if err != nil {
			return fmt.Errorf("re-fetching room after join: %w", err)
		}
		updatedRoom = r
		return nil
	}); err != nil {
		if errors.Is(err, apperr.ErrAlreadyInRoom) || errors.Is(err, apperr.ErrRoomNotFound) {
			return err
		}
		return fmt.Errorf("joining room: %w", err)
	}

	// TODO: broadcast system:player_joined to room participants (WS hub not yet wired)

	return c.JSON(http.StatusOK, map[string]interface{}{"data": updatedRoom})
}

func (h *RoomHandler) LeaveRoom(c echo.Context) error {
	userID, err := auth.GetUserID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	roomID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		return apperr.ErrRoomNotFound
	}

	room, err := h.repo.FindByID(uint(roomID))
	if err != nil {
		return fmt.Errorf("finding room: %w", err)
	}
	if room == nil {
		return apperr.ErrRoomNotFound
	}

	if err := h.repo.RunInTransaction(func(tx RoomRepository) error {
		if err := tx.RemovePlayer(uint(roomID), userID); err != nil {
			return err
		}
		if err := tx.DecrementPlayerCount(uint(roomID)); err != nil {
			return fmt.Errorf("decrementing player count: %w", err)
		}
		if room.OwnerID == userID {
			// Re-fetch room inside tx to get current state after decrement
			freshRoom, err := tx.FindByID(uint(roomID))
			if err != nil {
				return fmt.Errorf("re-fetching room: %w", err)
			}
			players, err := tx.FindPlayersByRoomID(uint(roomID))
			if err != nil {
				return fmt.Errorf("finding remaining players: %w", err)
			}
			if len(players) > 0 {
				freshRoom.OwnerID = players[0].UserID
				if err := tx.Update(freshRoom); err != nil {
					return fmt.Errorf("transferring room ownership: %w", err)
				}
			} else {
				freshRoom.Status = "completed"
				if err := tx.Update(freshRoom); err != nil {
					return fmt.Errorf("closing empty room: %w", err)
				}
			}
		}
		return nil
	}); err != nil {
		if errors.Is(err, apperr.ErrNotInRoom) || errors.Is(err, apperr.ErrRoomNotFound) {
			return err
		}
		return fmt.Errorf("leaving room: %w", err)
	}

	// TODO: broadcast system:player_left to room participants (WS hub not yet wired)

	return c.JSON(http.StatusOK, map[string]interface{}{"data": map[string]string{"message": "left room"}})
}

func generateRoomCode() (string, error) {
	result := make([]byte, codeLength)
	max := big.NewInt(int64(len(codeChars)))
	for i := 0; i < codeLength; i++ {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", fmt.Errorf("generating random number: %w", err)
		}
		result[i] = codeChars[n.Int64()]
	}
	return string(result), nil
}
