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

func (h *RoomHandler) GetRoomByCode(c echo.Context) error {
	code := strings.ToUpper(strings.TrimSpace(c.Param("code")))
	if len(code) != codeLength {
		return apperr.ErrRoomNotFound
	}

	room, err := h.repo.FindByCode(code)
	if err != nil {
		return fmt.Errorf("finding room by code: %w", err)
	}
	if room == nil || room.Status != "waiting" {
		return apperr.ErrRoomNotFound
	}

	players, err := h.repo.FindPlayersByRoomID(room.ID)
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

type SelectSeatRequest struct {
	Seat *int `json:"seat"`
}

type PlayersResponse struct {
	Players []RoomPlayer `json:"players"`
}

func teamForSeat(seat int) string {
	if seat%2 == 0 {
		return "red"
	}
	return "blue"
}

func (h *RoomHandler) SelectSeat(c echo.Context) error {
	userID, err := auth.GetUserID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	roomID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		return apperr.ErrRoomNotFound
	}

	var req SelectSeatRequest
	if err := c.Bind(&req); err != nil {
		return apperr.ErrBadRequest
	}

	if req.Seat == nil {
		return apperr.ErrInvalidSeat
	}
	seat := *req.Seat
	if seat < 0 || seat > 3 {
		return apperr.ErrInvalidSeat
	}

	team := teamForSeat(seat)

	if err := h.repo.RunInTransaction(func(tx RoomRepository) error {
		// Re-check room status inside transaction to prevent TOCTOU
		room, err := tx.FindByID(uint(roomID))
		if err != nil {
			return fmt.Errorf("finding room: %w", err)
		}
		if room == nil {
			return apperr.ErrRoomNotFound
		}
		if room.Status != "waiting" {
			return apperr.ErrGameNotStartable
		}

		// Check if seat is already taken
		existing, err := tx.FindPlayerBySeat(uint(roomID), seat)
		if err != nil {
			return fmt.Errorf("checking seat occupancy: %w", err)
		}
		if existing != nil {
			if existing.UserID == userID {
				// Player already in this seat — no-op
				return nil
			}
			return apperr.ErrSeatTaken
		}

		// Check if player is in this room and has an existing seat to clear
		player, err := tx.FindPlayerRoom(userID)
		if err != nil {
			return fmt.Errorf("finding player room: %w", err)
		}
		if player == nil || player.RoomID != uint(roomID) {
			return apperr.ErrNotInRoom
		}

		if player.Seat != nil {
			if err := tx.ClearPlayerSeat(uint(roomID), userID); err != nil {
				return fmt.Errorf("clearing previous seat: %w", err)
			}
		}

		if err := tx.UpdatePlayerSeat(uint(roomID), userID, seat, team); err != nil {
			return fmt.Errorf("updating player seat: %w", err)
		}

		return nil
	}); err != nil {
		if errors.Is(err, apperr.ErrSeatTaken) || errors.Is(err, apperr.ErrNotInRoom) ||
			errors.Is(err, apperr.ErrRoomNotFound) || errors.Is(err, apperr.ErrGameNotStartable) {
			return err
		}
		return fmt.Errorf("selecting seat: %w", err)
	}

	// TODO: broadcast system:seat_updated to room participants (WS hub not yet wired)

	players, err := h.repo.FindPlayersByRoomID(uint(roomID))
	if err != nil {
		return fmt.Errorf("fetching players after seat update: %w", err)
	}

	// Check if Quick Play room should auto-start
	room, err := h.repo.FindByID(uint(roomID))
	if err != nil {
		return fmt.Errorf("fetching room for auto-start check: %w", err)
	}

	gameStarted := false
	if room != nil && room.IsQuickPlay && room.Status == "waiting" {
		seatedCount := 0
		for _, p := range players {
			if p.Seat != nil {
				seatedCount++
			}
		}
		if seatedCount == 4 {
			room.Status = "playing"
			if err := h.repo.Update(room); err != nil {
				return fmt.Errorf("auto-starting quick play room: %w", err)
			}
			gameStarted = true
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": map[string]interface{}{
			"players":     players,
			"gameStarted": gameStarted,
		},
	})
}

func (h *RoomHandler) StartGame(c echo.Context) error {
	userID, err := auth.GetUserID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	roomID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		return apperr.ErrRoomNotFound
	}

	var updatedRoom *Room
	if err := h.repo.RunInTransaction(func(tx RoomRepository) error {
		room, err := tx.FindByID(uint(roomID))
		if err != nil {
			return fmt.Errorf("finding room: %w", err)
		}
		if room == nil {
			return apperr.ErrRoomNotFound
		}

		if room.Status != "waiting" {
			return apperr.ErrGameNotStartable
		}

		if room.IsQuickPlay {
			return apperr.ErrGameNotStartable
		}

		if room.OwnerID != userID {
			return apperr.ErrNotRoomOwner
		}

		players, err := tx.FindPlayersByRoomID(uint(roomID))
		if err != nil {
			return fmt.Errorf("finding room players: %w", err)
		}

		seatedCount := 0
		for _, p := range players {
			if p.Seat != nil {
				seatedCount++
			}
		}
		if seatedCount < 4 {
			return apperr.ErrNotAllSeated
		}

		room.Status = "playing"
		if err := tx.Update(room); err != nil {
			return fmt.Errorf("starting game: %w", err)
		}

		updatedRoom = room
		return nil
	}); err != nil {
		if errors.Is(err, apperr.ErrRoomNotFound) || errors.Is(err, apperr.ErrGameNotStartable) ||
			errors.Is(err, apperr.ErrNotRoomOwner) || errors.Is(err, apperr.ErrNotAllSeated) {
			return err
		}
		return fmt.Errorf("starting game: %w", err)
	}

	// TODO: broadcast system:game_started to room participants + system:room_updated to lobby (WS hub not yet wired)

	return c.JSON(http.StatusOK, map[string]interface{}{"data": updatedRoom})
}

func (h *RoomHandler) QuickPlay(c echo.Context) error {
	userID, err := auth.GetUserID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	existingRoom, err := h.repo.FindPlayerRoom(userID)
	if err != nil {
		return fmt.Errorf("checking existing room: %w", err)
	}
	if existingRoom != nil {
		return apperr.ErrAlreadyInRoom
	}

	var resultRoom *Room
	var createErr error
	for i := 0; i < maxRetries; i++ {
		createErr = h.repo.RunInTransaction(func(tx RoomRepository) error {
			available, err := tx.FindQuickPlayRoom()
			if err != nil {
				return fmt.Errorf("finding quick play room: %w", err)
			}

			if available != nil {
				rp := &RoomPlayer{RoomID: available.ID, UserID: userID}
				if err := tx.AddPlayer(rp); err != nil {
					return err
				}
				if err := tx.IncrementPlayerCount(available.ID); err != nil {
					return fmt.Errorf("incrementing player count: %w", err)
				}
				r, err := tx.FindByID(available.ID)
				if err != nil {
					return fmt.Errorf("re-fetching room after join: %w", err)
				}
				resultRoom = r
				return nil
			}

			code, err := generateRoomCode()
			if err != nil {
				return fmt.Errorf("generating room code: %w", err)
			}

			newRoom := &Room{
				Name:        "Quick Play " + code,
				Code:        code,
				OwnerID:     userID,
				Variant:     "bitola",
				MatchMode:   "1001",
				TimerStyle:  "relaxed",
				IsQuickPlay: true,
				Status:      "waiting",
				PlayerCount: 1,
			}
			if err := tx.Create(newRoom); err != nil {
				return err
			}
			rp := &RoomPlayer{RoomID: newRoom.ID, UserID: userID}
			if err := tx.AddPlayer(rp); err != nil {
				return fmt.Errorf("adding creator to room players: %w", err)
			}
			resultRoom = newRoom
			return nil
		})
		if createErr == nil {
			break
		}
		if errors.Is(createErr, apperr.ErrRoomCodeTaken) || errors.Is(createErr, apperr.ErrRoomNameTaken) {
			continue
		}
		if errors.Is(createErr, apperr.ErrAlreadyInRoom) {
			return createErr
		}
		return createErr
	}
	if createErr != nil {
		return createErr
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"data": resultRoom})
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
