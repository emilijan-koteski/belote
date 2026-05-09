// Package lobby exposes lightweight lobby-scoped read endpoints. Today it only
// serves aggregate player-state stats (in-lobby / in-room / in-game / online /
// registered) consumed by the lobby UI's activity panel.
package lobby

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/emilijan/beljot/server/internal/room"
	"github.com/emilijan/beljot/server/internal/user"
)

// ConnectionTracker reports the set of user IDs currently holding a live
// WebSocket connection. Implemented by *ws.Hub.
type ConnectionTracker interface {
	ConnectedUserIDs() []uint
}

// SessionTracker reports the set of user IDs currently mapped to an active
// game session. Implemented by *session.Manager.
type SessionTracker interface {
	InGameUserIDs() []uint
}

// StatsResponse is the wire payload returned by GET /lobby/stats.
//
// All values are connection-aware: a user is only counted in inLobby /
// inRoom / inGame if they currently hold a live WebSocket connection. Stale
// DB rows (e.g. a user in room_players who has since dropped their socket)
// do not appear in any bucket. By construction:
//
//	online == inLobby + inRoom + inGame
type StatsResponse struct {
	InLobby    int   `json:"inLobby"`
	InRoom     int   `json:"inRoom"`
	InGame     int   `json:"inGame"`
	Online     int   `json:"online"`
	Registered int64 `json:"registered"`
}

// Handler serves lobby-scoped read endpoints.
type Handler struct {
	hub      ConnectionTracker
	sessions SessionTracker
	rooms    room.RoomRepository
	users    user.UserRepository
}

// NewHandler wires a Handler with its four data sources.
func NewHandler(hub ConnectionTracker, sessions SessionTracker, rooms room.RoomRepository, users user.UserRepository) *Handler {
	return &Handler{hub: hub, sessions: sessions, rooms: rooms, users: users}
}

// GetStats bucket-counts every currently-connected user as in-game / in-room /
// in-lobby and returns the totals alongside the registered-user count.
//
// Bucketing precedence is in-game → in-room → in-lobby: a user mapped to an
// active session is counted as in-game even if a stale DB row also places
// them in a waiting room (defensive — the session manager wins).
func (h *Handler) GetStats(c echo.Context) error {
	connected := h.hub.ConnectedUserIDs()
	connectedSet := make(map[uint]struct{}, len(connected))
	for _, uid := range connected {
		connectedSet[uid] = struct{}{}
	}

	inGameSet := make(map[uint]struct{})
	for _, uid := range h.sessions.InGameUserIDs() {
		if _, online := connectedSet[uid]; online {
			inGameSet[uid] = struct{}{}
		}
	}

	waitingUserIDs, err := h.rooms.FindUserIDsByRoomStatus("waiting")
	if err != nil {
		return err
	}
	inRoomSet := make(map[uint]struct{})
	for _, uid := range waitingUserIDs {
		if _, online := connectedSet[uid]; !online {
			continue
		}
		// Defensive precedence: never double-count a user who is also in a session.
		if _, inGame := inGameSet[uid]; inGame {
			continue
		}
		inRoomSet[uid] = struct{}{}
	}

	registered, err := h.users.Count()
	if err != nil {
		return err
	}

	online := len(connectedSet)
	inGame := len(inGameSet)
	inRoom := len(inRoomSet)
	inLobby := online - inGame - inRoom
	if inLobby < 0 {
		inLobby = 0
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": StatsResponse{
			InLobby:    inLobby,
			InRoom:     inRoom,
			InGame:     inGame,
			Online:     online,
			Registered: registered,
		},
	})
}
