package room

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/emilijan/belote/server/internal/apperr"
	"github.com/emilijan/belote/server/internal/auth"
	"github.com/emilijan/belote/server/internal/ws"
)

var (
	validVariants    = map[string]bool{"bitola": true}
	validMatchModes  = map[string]bool{"1001": true}
	validTimerStyles = map[string]bool{"relaxed": true, "per-move": true}
	validStatuses    = map[string]bool{"waiting": true, "playing": true, "finished": true, "completed": true}
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
	ReconnectWindowSec   *int   `json:"reconnectWindowSec"`
}

// GameStarter is the interface the room handler uses to start a game session.
type GameStarter interface {
	StartGame(roomID uint, variant string, matchMode string, players [4]PlayerSeatInfo, timerStyle string, timerDurationSec int, ownerID uint, reconnectWindowSec int) error
}

// PlayerSeatInfo holds the player info needed for game session initialization.
type PlayerSeatInfo struct {
	UserID   uint
	Username string
	Seat     int
}

// RoomStatusAdapter implements session.RoomStatusUpdater using the room repository.
type RoomStatusAdapter struct {
	Repo RoomRepository
}

// UpdateRoomStatus updates a room's status in the database.
func (a *RoomStatusAdapter) UpdateRoomStatus(roomID uint, status string) error {
	return a.Repo.UpdateStatus(roomID, status)
}

// Broadcaster abstracts WebSocket broadcast capabilities for testability.
type Broadcaster interface {
	BroadcastToUsers(userIDs []uint, msg []byte)
	BroadcastAll(msg []byte)
}

type RoomHandler struct {
	repo        RoomRepository
	gameStarter GameStarter
	hub         Broadcaster
}

func NewRoomHandler(repo RoomRepository, gameStarter GameStarter, hub Broadcaster) *RoomHandler {
	return &RoomHandler{repo: repo, gameStarter: gameStarter, hub: hub}
}

// broadcastToRoom sends a WebSocket message to all players in a room.
// Broadcast is best-effort — errors are logged but never fail the HTTP response.
func (h *RoomHandler) broadcastToRoom(roomID uint, msgType string, payload interface{}) {
	if h.hub == nil {
		return
	}
	players, err := h.repo.FindPlayersByRoomID(roomID)
	if err != nil {
		slog.Error("broadcast: failed to find room players", "roomID", roomID, "error", err)
		return
	}
	userIDs := make([]uint, 0, len(players))
	for _, p := range players {
		userIDs = append(userIDs, p.UserID)
	}
	h.broadcastToUsers(userIDs, msgType, payload)
}

// broadcastToUsers sends a WebSocket message to a specific set of users.
func (h *RoomHandler) broadcastToUsers(userIDs []uint, msgType string, payload interface{}) {
	if h.hub == nil {
		return
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		slog.Error("broadcast: failed to marshal payload", "type", msgType, "error", err)
		return
	}
	msg, err := json.Marshal(ws.WSMessage{Type: msgType, Payload: payloadBytes})
	if err != nil {
		slog.Error("broadcast: failed to marshal message", "type", msgType, "error", err)
		return
	}
	h.hub.BroadcastToUsers(userIDs, msg)
}

// broadcastToAll sends a WebSocket message to all connected clients (lobby-wide).
func (h *RoomHandler) broadcastToAll(msgType string, payload interface{}) {
	if h.hub == nil {
		return
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		slog.Error("broadcast: failed to marshal payload", "type", msgType, "error", err)
		return
	}
	msg, err := json.Marshal(ws.WSMessage{Type: msgType, Payload: payloadBytes})
	if err != nil {
		slog.Error("broadcast: failed to marshal message", "type", msgType, "error", err)
		return
	}
	h.hub.BroadcastAll(msg)
}

// broadcastRoomUpdated sends a system:room_updated event to all connected clients.
func (h *RoomHandler) broadcastRoomUpdated(r *Room) {
	h.broadcastToAll(ws.SystemRoomUpdated, map[string]interface{}{
		"id":                   r.ID,
		"name":                 r.Name,
		"code":                 r.Code,
		"ownerId":              r.OwnerID,
		"variant":              r.Variant,
		"matchMode":            r.MatchMode,
		"timerStyle":           r.TimerStyle,
		"timerDurationSeconds": r.TimerDurationSeconds,
		"playerCount":          r.PlayerCount,
		"status":               r.Status,
		"isQuickPlay":          r.IsQuickPlay,
	})
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

	var reconnectWindow *int
	if req.ReconnectWindowSec != nil {
		rw := *req.ReconnectWindowSec
		if rw < 30 || rw > 300 {
			return apperr.ErrReconnectWindowOutOfRange
		}
		reconnectWindow = req.ReconnectWindowSec
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
		ReconnectWindowSec:   reconnectWindow,
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

	// Broadcast system:room_created to all connected clients (lobby-wide)
	h.broadcastToAll(ws.SystemRoomCreated, map[string]interface{}{
		"id":                   room.ID,
		"name":                 room.Name,
		"code":                 room.Code,
		"ownerId":              room.OwnerID,
		"variant":              room.Variant,
		"matchMode":            room.MatchMode,
		"timerStyle":           room.TimerStyle,
		"timerDurationSeconds": room.TimerDurationSeconds,
		"playerCount":          room.PlayerCount,
		"status":               room.Status,
		"isQuickPlay":          room.IsQuickPlay,
	})

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

	// Broadcast system:player_joined to room participants
	players, broadcastErr := h.repo.FindPlayersByRoomID(uint(roomID))
	if broadcastErr == nil {
		var username string
		for _, p := range players {
			if p.UserID == userID {
				username = p.Username
				break
			}
		}
		userIDs := make([]uint, 0, len(players))
		for _, p := range players {
			userIDs = append(userIDs, p.UserID)
		}
		h.broadcastToUsers(userIDs, ws.SystemPlayerJoined, map[string]interface{}{
			"roomId":      roomID,
			"userId":      userID,
			"username":    username,
			"playerCount": updatedRoom.PlayerCount,
		})
	}

	// Broadcast system:room_updated to lobby browse page
	h.broadcastRoomUpdated(updatedRoom)

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

	// Capture the leaving player's username before the transaction removes them
	var leavingUsername string
	prePlayers, _ := h.repo.FindPlayersByRoomID(uint(roomID))
	for _, p := range prePlayers {
		if p.UserID == userID {
			leavingUsername = p.Username
			break
		}
	}

	var newOwnerID *uint
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
				newOwnerID = &players[0].UserID
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

	// Broadcast system:player_left to remaining room participants (not the leaving player)
	remainingPlayers, broadcastErr := h.repo.FindPlayersByRoomID(uint(roomID))
	if broadcastErr == nil && len(remainingPlayers) > 0 {
		// Re-fetch room after transaction to get accurate playerCount
		postRoom, postErr := h.repo.FindByID(uint(roomID))
		actualPlayerCount := len(remainingPlayers)
		if postErr == nil && postRoom != nil {
			actualPlayerCount = postRoom.PlayerCount
		}
		userIDs := make([]uint, 0, len(remainingPlayers))
		for _, p := range remainingPlayers {
			userIDs = append(userIDs, p.UserID)
		}
		payload := map[string]interface{}{
			"roomId":      roomID,
			"userId":      userID,
			"username":    leavingUsername,
			"playerCount": actualPlayerCount,
		}
		if newOwnerID != nil {
			payload["newOwnerId"] = *newOwnerID
		}
		h.broadcastToUsers(userIDs, ws.SystemPlayerLeft, payload)

		// Broadcast system:room_updated to lobby browse page
		if postErr == nil && postRoom != nil {
			h.broadcastRoomUpdated(postRoom)
		}
	}

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

	var previousSeat *int
	seatChanged := false
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

		// Capture previous seat before clearing
		if player.Seat != nil {
			prev := *player.Seat
			previousSeat = &prev
			if err := tx.ClearPlayerSeat(uint(roomID), userID); err != nil {
				return fmt.Errorf("clearing previous seat: %w", err)
			}
		}

		if err := tx.UpdatePlayerSeat(uint(roomID), userID, seat, team); err != nil {
			return fmt.Errorf("updating player seat: %w", err)
		}

		seatChanged = true
		return nil
	}); err != nil {
		if errors.Is(err, apperr.ErrSeatTaken) || errors.Is(err, apperr.ErrNotInRoom) ||
			errors.Is(err, apperr.ErrRoomNotFound) || errors.Is(err, apperr.ErrGameNotStartable) {
			return err
		}
		return fmt.Errorf("selecting seat: %w", err)
	}

	players, err := h.repo.FindPlayersByRoomID(uint(roomID))
	if err != nil {
		return fmt.Errorf("fetching players after seat update: %w", err)
	}

	// Broadcast system:seat_updated to room participants
	if seatChanged {
		var username string
		for _, p := range players {
			if p.UserID == userID {
				username = p.Username
				break
			}
		}
		seatPayload := map[string]interface{}{
			"roomId":       roomID,
			"userId":       userID,
			"username":     username,
			"seat":         seat,
			"team":         team,
			"previousSeat": previousSeat,
		}
		h.broadcastToRoom(uint(roomID), ws.SystemSeatUpdated, seatPayload)
	}

	// Check if Quick Play room should auto-start (wrapped in transaction to prevent double-start)
	gameStarted := false
	var autoStartRoom *Room
	if err := h.repo.RunInTransaction(func(tx RoomRepository) error {
		r, err := tx.FindByID(uint(roomID))
		if err != nil {
			return fmt.Errorf("fetching room for auto-start check: %w", err)
		}
		if r == nil || !r.IsQuickPlay || r.Status != "waiting" {
			return nil
		}
		seatedCount := 0
		for _, p := range players {
			if p.Seat != nil {
				seatedCount++
			}
		}
		if seatedCount < 4 {
			return nil
		}
		r.Status = "playing"
		if err := tx.Update(r); err != nil {
			return fmt.Errorf("auto-starting quick play room: %w", err)
		}
		gameStarted = true
		autoStartRoom = r
		return nil
	}); err != nil {
		return fmt.Errorf("auto-start check: %w", err)
	}

	if gameStarted && autoStartRoom != nil {
		// Wire gameStarter for Quick Play auto-start
		if h.gameStarter != nil {
			var seatInfo [4]PlayerSeatInfo
			for _, p := range players {
				if p.Seat != nil {
					seatInfo[*p.Seat] = PlayerSeatInfo{
						UserID:   p.UserID,
						Username: p.Username,
						Seat:     *p.Seat,
					}
				}
			}
			timerDuration := 0
			if autoStartRoom.TimerDurationSeconds != nil {
				timerDuration = *autoStartRoom.TimerDurationSeconds
			}
			reconnectWindow := resolveReconnectWindow(autoStartRoom.ReconnectWindowSec)
			if err := h.gameStarter.StartGame(uint(roomID), autoStartRoom.Variant, autoStartRoom.MatchMode, seatInfo, autoStartRoom.TimerStyle, timerDuration, autoStartRoom.OwnerID, reconnectWindow); err != nil {
				slog.Error("failed to start game session for quick play", "roomID", roomID, "error", err)
			}
		}

		// Broadcast system:game_started to all room participants
		h.broadcastToRoom(uint(roomID), ws.SystemGameStarted, map[string]interface{}{
			"roomId": roomID,
		})

		// Broadcast system:room_updated to lobby browse page
		h.broadcastRoomUpdated(autoStartRoom)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": map[string]interface{}{
			"players":     players,
			"gameStarted": gameStarted,
		},
	})
}

type KickPlayerRequest struct {
	UserID uint `json:"userId"`
}

func (h *RoomHandler) KickPlayer(c echo.Context) error {
	ownerID, err := auth.GetUserID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	roomID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		return apperr.ErrRoomNotFound
	}

	var req KickPlayerRequest
	if err := c.Bind(&req); err != nil {
		return apperr.ErrBadRequest
	}
	if req.UserID == 0 {
		return apperr.ErrBadRequest
	}

	// Capture the kicked player's username before the transaction removes them
	var kickedUsername string
	prePlayers, _ := h.repo.FindPlayersByRoomID(uint(roomID))
	for _, p := range prePlayers {
		if p.UserID == req.UserID {
			kickedUsername = p.Username
			break
		}
	}

	var postRoom *Room
	if err := h.repo.RunInTransaction(func(tx RoomRepository) error {
		r, err := tx.FindByID(uint(roomID))
		if err != nil {
			return fmt.Errorf("finding room: %w", err)
		}
		if r == nil {
			return apperr.ErrRoomNotFound
		}
		if r.Status != "waiting" {
			return apperr.ErrRoomNotWaiting
		}
		if r.OwnerID != ownerID {
			return apperr.ErrNotRoomOwner
		}
		if req.UserID == r.OwnerID {
			return apperr.ErrCannotKickSelf
		}

		target, err := tx.FindPlayerRoom(req.UserID)
		if err != nil {
			return fmt.Errorf("finding target player room: %w", err)
		}
		if target == nil || target.RoomID != uint(roomID) {
			return apperr.ErrNotInRoom
		}

		if err := tx.RemovePlayer(uint(roomID), req.UserID); err != nil {
			return err
		}
		if err := tx.DecrementPlayerCount(uint(roomID)); err != nil {
			return fmt.Errorf("decrementing player count: %w", err)
		}

		fresh, err := tx.FindByID(uint(roomID))
		if err != nil {
			return fmt.Errorf("re-fetching room after kick: %w", err)
		}
		postRoom = fresh
		return nil
	}); err != nil {
		if errors.Is(err, apperr.ErrRoomNotFound) ||
			errors.Is(err, apperr.ErrRoomNotWaiting) ||
			errors.Is(err, apperr.ErrNotRoomOwner) ||
			errors.Is(err, apperr.ErrCannotKickSelf) ||
			errors.Is(err, apperr.ErrNotInRoom) {
			return err
		}
		return fmt.Errorf("kicking player: %w", err)
	}

	// If the post-tx re-fetch returned nil (e.g. concurrent room cleanup), bail
	// out of the broadcast/response branches that need PlayerCount rather than
	// dereferencing a nil pointer.
	if postRoom == nil {
		return apperr.ErrRoomNotFound
	}

	// Broadcast: kicked user gets system:room_kicked
	h.broadcastToUsers([]uint{req.UserID}, ws.SystemRoomKicked, ws.RoomKickedPayload{
		RoomID: uint(roomID),
		Reason: "kicked_by_owner",
	})

	// Broadcast: remaining members get system:player_left
	remainingPlayers, broadcastErr := h.repo.FindPlayersByRoomID(uint(roomID))
	if broadcastErr == nil {
		userIDs := make([]uint, 0, len(remainingPlayers))
		for _, p := range remainingPlayers {
			userIDs = append(userIDs, p.UserID)
		}
		h.broadcastToUsers(userIDs, ws.SystemPlayerLeft, map[string]interface{}{
			"roomId":      roomID,
			"userId":      req.UserID,
			"username":    kickedUsername,
			"playerCount": postRoom.PlayerCount,
		})

		// Broadcast: lobby browse page gets system:room_updated
		h.broadcastRoomUpdated(postRoom)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": map[string]interface{}{"playerCount": postRoom.PlayerCount},
	})
}

type SwapSeatsRequest struct {
	SeatA *int `json:"seatA"`
	SeatB *int `json:"seatB"`
}

func (h *RoomHandler) SwapSeats(c echo.Context) error {
	ownerID, err := auth.GetUserID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	roomID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		return apperr.ErrRoomNotFound
	}

	var req SwapSeatsRequest
	if err := c.Bind(&req); err != nil {
		return apperr.ErrBadRequest
	}
	if req.SeatA == nil || req.SeatB == nil {
		return apperr.ErrInvalidSeat
	}
	seatA := *req.SeatA
	seatB := *req.SeatB
	if seatA < 0 || seatA > 3 || seatB < 0 || seatB > 3 || seatA == seatB {
		return apperr.ErrInvalidSeat
	}

	type swapped struct {
		userID       uint
		username     string
		seat         int
		team         string
		previousSeat int
	}
	var swapA, swapB swapped

	if err := h.repo.RunInTransaction(func(tx RoomRepository) error {
		r, err := tx.FindByID(uint(roomID))
		if err != nil {
			return fmt.Errorf("finding room: %w", err)
		}
		if r == nil {
			return apperr.ErrRoomNotFound
		}
		if r.Status != "waiting" {
			return apperr.ErrRoomNotWaiting
		}
		if r.OwnerID != ownerID {
			return apperr.ErrNotRoomOwner
		}

		pA, err := tx.FindPlayerBySeat(uint(roomID), seatA)
		if err != nil {
			return fmt.Errorf("finding player at seatA: %w", err)
		}
		pB, err := tx.FindPlayerBySeat(uint(roomID), seatB)
		if err != nil {
			return fmt.Errorf("finding player at seatB: %w", err)
		}
		if pA == nil || pB == nil {
			return apperr.ErrSeatNotOccupied
		}

		newSeatA := seatB
		newSeatB := seatA
		teamA := teamForSeat(newSeatA)
		teamB := teamForSeat(newSeatB)

		if err := tx.UpdatePlayerSeat(uint(roomID), pA.UserID, newSeatA, teamA); err != nil {
			return fmt.Errorf("updating seatA player: %w", err)
		}
		if err := tx.UpdatePlayerSeat(uint(roomID), pB.UserID, newSeatB, teamB); err != nil {
			return fmt.Errorf("updating seatB player: %w", err)
		}

		swapA = swapped{
			userID:       pA.UserID,
			username:     pA.Username,
			seat:         newSeatA,
			team:         teamA,
			previousSeat: seatA,
		}
		swapB = swapped{
			userID:       pB.UserID,
			username:     pB.Username,
			seat:         newSeatB,
			team:         teamB,
			previousSeat: seatB,
		}
		return nil
	}); err != nil {
		if errors.Is(err, apperr.ErrRoomNotFound) ||
			errors.Is(err, apperr.ErrRoomNotWaiting) ||
			errors.Is(err, apperr.ErrNotRoomOwner) ||
			errors.Is(err, apperr.ErrSeatNotOccupied) ||
			errors.Is(err, apperr.ErrInvalidSeat) {
			return err
		}
		return fmt.Errorf("swapping seats: %w", err)
	}

	players, err := h.repo.FindPlayersByRoomID(uint(roomID))
	if err != nil {
		return fmt.Errorf("fetching players after swap: %w", err)
	}

	// Broadcast TWO ordered system:seat_updated events to every room member.
	// Multi-event sequences are sent as separate messages, never batched.
	h.broadcastToRoom(uint(roomID), ws.SystemSeatUpdated, map[string]interface{}{
		"roomId":       roomID,
		"userId":       swapA.userID,
		"username":     swapA.username,
		"seat":         swapA.seat,
		"team":         swapA.team,
		"previousSeat": swapA.previousSeat,
	})
	h.broadcastToRoom(uint(roomID), ws.SystemSeatUpdated, map[string]interface{}{
		"roomId":       roomID,
		"userId":       swapB.userID,
		"username":     swapB.username,
		"seat":         swapB.seat,
		"team":         swapB.team,
		"previousSeat": swapB.previousSeat,
	})

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": PlayersResponse{Players: players},
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

	// Start game session via session manager
	if h.gameStarter != nil {
		players, err := h.repo.FindPlayersByRoomID(uint(roomID))
		if err != nil {
			slog.Error("failed to load players for game start", "roomID", roomID, "error", err)
		} else {
			var seatInfo [4]PlayerSeatInfo
			for _, p := range players {
				if p.Seat != nil {
					seatInfo[*p.Seat] = PlayerSeatInfo{
						UserID:   p.UserID,
						Username: p.Username,
						Seat:     *p.Seat,
					}
				}
			}
			timerDuration := 0
			if updatedRoom.TimerDurationSeconds != nil {
				timerDuration = *updatedRoom.TimerDurationSeconds
			}
			reconnectWindow := resolveReconnectWindow(updatedRoom.ReconnectWindowSec)
			if err := h.gameStarter.StartGame(uint(roomID), updatedRoom.Variant, updatedRoom.MatchMode, seatInfo, updatedRoom.TimerStyle, timerDuration, updatedRoom.OwnerID, reconnectWindow); err != nil {
				slog.Error("failed to start game session", "roomID", roomID, "error", err)
			}
		}
	}

	// Broadcast system:game_started to all room participants
	h.broadcastToRoom(uint(roomID), ws.SystemGameStarted, map[string]interface{}{
		"roomId": roomID,
	})

	// Broadcast system:room_updated to lobby browse page
	h.broadcastRoomUpdated(updatedRoom)

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
	createdNew := false
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
				createdNew = false
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
			createdNew = true
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

	// Broadcast lobby-wide events for QuickPlay
	if createdNew {
		h.broadcastToAll(ws.SystemRoomCreated, map[string]interface{}{
			"id":                   resultRoom.ID,
			"name":                 resultRoom.Name,
			"code":                 resultRoom.Code,
			"ownerId":              resultRoom.OwnerID,
			"variant":              resultRoom.Variant,
			"matchMode":            resultRoom.MatchMode,
			"timerStyle":           resultRoom.TimerStyle,
			"timerDurationSeconds": resultRoom.TimerDurationSeconds,
			"playerCount":          resultRoom.PlayerCount,
			"status":               resultRoom.Status,
			"isQuickPlay":          resultRoom.IsQuickPlay,
		})
	} else {
		// Joined an existing room — broadcast updated player count
		h.broadcastRoomUpdated(resultRoom)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"data": resultRoom})
}

// resolveReconnectWindow returns the reconnect window in seconds,
// defaulting to 120 if the room has no explicit setting.
func resolveReconnectWindow(roomSetting *int) int {
	if roomSetting != nil {
		return *roomSetting
	}
	return 120
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
