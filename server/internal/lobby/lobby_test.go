package lobby_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/emilijan/beljot/server/internal/lobby"
	"github.com/emilijan/beljot/server/internal/room"
	"github.com/emilijan/beljot/server/internal/user"
)

type fakeHub struct {
	connected []uint
}

func (h *fakeHub) ConnectedUserIDs() []uint {
	out := make([]uint, len(h.connected))
	copy(out, h.connected)
	return out
}

type fakeSessions struct {
	inGame []uint
}

func (s *fakeSessions) InGameUserIDs() []uint {
	out := make([]uint, len(s.inGame))
	copy(out, s.inGame)
	return out
}

type fakeRoomRepo struct {
	usersByStatus map[string][]uint
}

func (r *fakeRoomRepo) FindUserIDsByRoomStatus(status string) ([]uint, error) {
	return r.usersByStatus[status], nil
}

// All other RoomRepository methods are unused by GetStats — panic loudly so a
// regression that touches them shows up in test output.
func (r *fakeRoomRepo) Create(*room.Room) error                           { panic("unused") }
func (r *fakeRoomRepo) Update(*room.Room) error                           { panic("unused") }
func (r *fakeRoomRepo) FindByID(uint) (*room.Room, error)                 { panic("unused") }
func (r *fakeRoomRepo) FindByIDForUpdate(uint) (*room.Room, error)        { panic("unused") }
func (r *fakeRoomRepo) FindByCode(string) (*room.Room, error)             { panic("unused") }
func (r *fakeRoomRepo) FindByStatus(string) ([]room.Room, error)          { panic("unused") }
func (r *fakeRoomRepo) AddPlayer(*room.RoomPlayer) error                  { panic("unused") }
func (r *fakeRoomRepo) RemovePlayer(uint, uint) error                     { panic("unused") }
func (r *fakeRoomRepo) FindPlayersByRoomID(uint) ([]room.RoomPlayer, error) {
	panic("unused")
}
func (r *fakeRoomRepo) FindPlayerRoom(uint) (*room.RoomPlayer, error)  { panic("unused") }
func (r *fakeRoomRepo) IncrementPlayerCount(uint) error                { panic("unused") }
func (r *fakeRoomRepo) DecrementPlayerCount(uint) error                { panic("unused") }
func (r *fakeRoomRepo) UpdatePlayerSeat(uint, uint, int, string) error { panic("unused") }
func (r *fakeRoomRepo) ClearPlayerSeat(uint, uint) error               { panic("unused") }
func (r *fakeRoomRepo) FindPlayerBySeat(uint, int) (*room.RoomPlayer, error) {
	panic("unused")
}
func (r *fakeRoomRepo) FindQuickPlayRoom() (*room.Room, error) { panic("unused") }
func (r *fakeRoomRepo) FindQuickPlayRoomExcluding(map[uint]bool) (*room.Room, error) {
	panic("unused")
}
func (r *fakeRoomRepo) UpdateStatus(uint, string) error                        { panic("unused") }
func (r *fakeRoomRepo) RunInTransaction(func(room.RoomRepository) error) error { panic("unused") }
func (r *fakeRoomRepo) LoadOwnerUsernames([]*room.Room) error                  { return nil }
func (r *fakeRoomRepo) FindPlayersByRoomIDs([]uint) (map[uint][]room.RoomPlayer, error) {
	return map[uint][]room.RoomPlayer{}, nil
}

type fakeUserRepo struct {
	count   int64
	countErr error
}

func (u *fakeUserRepo) Count() (int64, error) {
	return u.count, u.countErr
}

// Unused — panic to surface accidental coupling.
func (u *fakeUserRepo) Create(*user.User) error                     { panic("unused") }
func (u *fakeUserRepo) FindByEmail(string) (*user.User, error)      { panic("unused") }
func (u *fakeUserRepo) FindByUsername(string) (*user.User, error)   { panic("unused") }
func (u *fakeUserRepo) FindByID(uint) (*user.User, error)           { panic("unused") }
func (u *fakeUserRepo) FindManyByIDs([]uint) ([]user.User, error)   { panic("unused") }
func (u *fakeUserRepo) UpdateLanguagePreference(uint, string) error { panic("unused") }

func decodeStats(t *testing.T, body []byte) lobby.StatsResponse {
	t.Helper()
	var env struct {
		Data lobby.StatsResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(body, &env))
	return env.Data
}

func TestGetStats_BucketsConnectedUsers(t *testing.T) {
	// 1, 2, 3, 4, 5 online. 1+2 in a game, 3 in a waiting room, 4+5 idle.
	// 6 in a waiting room but offline → must NOT be counted (connection-aware).
	hub := &fakeHub{connected: []uint{1, 2, 3, 4, 5}}
	sessions := &fakeSessions{inGame: []uint{1, 2}}
	rooms := &fakeRoomRepo{
		usersByStatus: map[string][]uint{
			"waiting": {3, 6},
		},
	}
	users := &fakeUserRepo{count: 100}

	h := lobby.NewHandler(hub, sessions, rooms, users)
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/lobby/stats", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	require.NoError(t, h.GetStats(c))
	require.Equal(t, http.StatusOK, rec.Code)

	stats := decodeStats(t, rec.Body.Bytes())
	assert.Equal(t, 2, stats.InGame, "users 1 and 2")
	assert.Equal(t, 1, stats.InRoom, "user 3 only — 6 is offline")
	assert.Equal(t, 2, stats.InLobby, "users 4 and 5")
	assert.Equal(t, 5, stats.Online)
	assert.Equal(t, int64(100), stats.Registered)
	// Invariant: online == sum of buckets.
	assert.Equal(t, stats.Online, stats.InLobby+stats.InRoom+stats.InGame)
}

func TestGetStats_InGameWinsOverInRoom(t *testing.T) {
	// User 7 appears in both the session manager (in game) and the
	// room_players table (waiting). Stale waiting row must not double-count.
	hub := &fakeHub{connected: []uint{7}}
	sessions := &fakeSessions{inGame: []uint{7}}
	rooms := &fakeRoomRepo{usersByStatus: map[string][]uint{"waiting": {7}}}
	users := &fakeUserRepo{count: 1}

	h := lobby.NewHandler(hub, sessions, rooms, users)
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/lobby/stats", nil)
	rec := httptest.NewRecorder()
	require.NoError(t, h.GetStats(e.NewContext(req, rec)))

	stats := decodeStats(t, rec.Body.Bytes())
	assert.Equal(t, 1, stats.InGame)
	assert.Equal(t, 0, stats.InRoom)
	assert.Equal(t, 0, stats.InLobby)
	assert.Equal(t, 1, stats.Online)
}

func TestGetStats_EmptyHub(t *testing.T) {
	hub := &fakeHub{connected: nil}
	sessions := &fakeSessions{inGame: nil}
	rooms := &fakeRoomRepo{usersByStatus: nil}
	users := &fakeUserRepo{count: 42}

	h := lobby.NewHandler(hub, sessions, rooms, users)
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/lobby/stats", nil)
	rec := httptest.NewRecorder()
	require.NoError(t, h.GetStats(e.NewContext(req, rec)))

	stats := decodeStats(t, rec.Body.Bytes())
	assert.Equal(t, 0, stats.Online)
	assert.Equal(t, 0, stats.InLobby)
	assert.Equal(t, 0, stats.InRoom)
	assert.Equal(t, 0, stats.InGame)
	assert.Equal(t, int64(42), stats.Registered)
}

func TestGetStats_UserCountErrorPropagates(t *testing.T) {
	users := &fakeUserRepo{countErr: errors.New("db down")}
	hub := &fakeHub{connected: []uint{1}}
	sessions := &fakeSessions{}
	rooms := &fakeRoomRepo{}

	h := lobby.NewHandler(hub, sessions, rooms, users)
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/lobby/stats", nil)
	rec := httptest.NewRecorder()
	err := h.GetStats(e.NewContext(req, rec))
	assert.Error(t, err)
}
