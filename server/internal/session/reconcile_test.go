package session_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/emilijan/beljot/server/internal/room"
	"github.com/emilijan/beljot/server/internal/session"
	"github.com/emilijan/beljot/server/internal/ws"
)

// stubRoomRepo implements room.RoomRepository with only the surface area that
// ReconcileStaleRooms needs. Methods we don't expect to be called panic so a
// regression that touches them shows up loudly in the test output.
type stubRoomRepo struct {
	rooms          []room.Room
	players        map[uint][]room.RoomPlayer
	statusUpdates  map[uint]string
	findByStatus   func(string) ([]room.Room, error)
	updateStatus   func(uint, string) error
}

func newStubRoomRepo() *stubRoomRepo {
	return &stubRoomRepo{
		players:       make(map[uint][]room.RoomPlayer),
		statusUpdates: make(map[uint]string),
	}
}

func (s *stubRoomRepo) FindByStatus(status string) ([]room.Room, error) {
	if s.findByStatus != nil {
		return s.findByStatus(status)
	}
	out := make([]room.Room, 0, len(s.rooms))
	for _, r := range s.rooms {
		if r.Status == status {
			out = append(out, r)
		}
	}
	return out, nil
}

func (s *stubRoomRepo) FindPlayersByRoomID(roomID uint) ([]room.RoomPlayer, error) {
	return s.players[roomID], nil
}

func (s *stubRoomRepo) UpdateStatus(roomID uint, status string) error {
	if s.updateStatus != nil {
		return s.updateStatus(roomID, status)
	}
	s.statusUpdates[roomID] = status
	for i := range s.rooms {
		if s.rooms[i].ID == roomID {
			s.rooms[i].Status = status
		}
	}
	return nil
}

// Unused interface members — panic if a future change makes ReconcileStaleRooms
// reach for them, so we notice and add coverage instead of getting silent nil
// behaviour.
func (s *stubRoomRepo) Create(*room.Room) error                        { panic("unused") }
func (s *stubRoomRepo) Update(*room.Room) error                        { panic("unused") }
func (s *stubRoomRepo) FindByID(uint) (*room.Room, error)              { panic("unused") }
func (s *stubRoomRepo) FindByIDForUpdate(uint) (*room.Room, error)     { panic("unused") }
func (s *stubRoomRepo) FindByCode(string) (*room.Room, error)          { panic("unused") }
func (s *stubRoomRepo) AddPlayer(*room.RoomPlayer) error               { panic("unused") }
func (s *stubRoomRepo) RemovePlayer(uint, uint) error                  { panic("unused") }
func (s *stubRoomRepo) FindPlayerRoom(uint) (*room.RoomPlayer, error)  { panic("unused") }
func (s *stubRoomRepo) IncrementPlayerCount(uint) error                { panic("unused") }
func (s *stubRoomRepo) DecrementPlayerCount(uint) error                { panic("unused") }
func (s *stubRoomRepo) UpdatePlayerSeat(uint, uint, int, string) error { panic("unused") }
func (s *stubRoomRepo) ClearPlayerSeat(uint, uint) error               { panic("unused") }
func (s *stubRoomRepo) FindPlayerBySeat(uint, int) (*room.RoomPlayer, error) {
	panic("unused")
}
func (s *stubRoomRepo) FindQuickPlayRoom() (*room.Room, error) { panic("unused") }
func (s *stubRoomRepo) FindQuickPlayRoomExcluding(map[uint]bool) (*room.Room, error) {
	panic("unused")
}
func (s *stubRoomRepo) RunInTransaction(func(room.RoomRepository) error) error {
	panic("unused")
}
func (s *stubRoomRepo) FindUserIDsByRoomStatus(string) ([]uint, error) { panic("unused") }

func intp(i int) *int { return &i }

// Server restart leaves rooms in status="playing" with no live session,
// stranding players because FindPlayerRoom counts "playing" as active and
// blocks them from quick-play / create-room. ReconcileStaleRooms must close
// those rows on boot so the lobby unblocks; for fully-seated rooms it must
// also persist a match row with status="abandoned" so player history matches
// what actually happened.
func TestReconcileStaleRooms_FlipsPlayingToCompleted(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	matchRepo := newMockMatchRepo()
	mgr := session.NewManager(hub, matchRepo)

	stub := newStubRoomRepo()
	stub.rooms = []room.Room{
		{ID: 100, Status: "playing", Variant: "bitola", MatchMode: "1001"},
		{ID: 101, Status: "playing", Variant: "bitola", MatchMode: "1001"},
		{ID: 102, Status: "waiting"}, // unrelated, must be left alone
		{ID: 103, Status: "completed"},
	}
	stub.players[100] = []room.RoomPlayer{
		{RoomID: 100, UserID: 10, Seat: intp(0)},
		{RoomID: 100, UserID: 20, Seat: intp(1)},
		{RoomID: 100, UserID: 30, Seat: intp(2)},
		{RoomID: 100, UserID: 40, Seat: intp(3)},
	}
	// Room 101 is short a player — flip status anyway, just skip the match row.
	stub.players[101] = []room.RoomPlayer{
		{RoomID: 101, UserID: 50, Seat: intp(0)},
		{RoomID: 101, UserID: 60, Seat: intp(1)},
	}

	err := mgr.ReconcileStaleRooms(stub)
	require.NoError(t, err)

	assert.Equal(t, "completed", stub.statusUpdates[100], "fully-seated room flipped to completed")
	assert.Equal(t, "completed", stub.statusUpdates[101], "under-seated room flipped to completed too")
	_, untouchedWaiting := stub.statusUpdates[102]
	assert.False(t, untouchedWaiting, "waiting room left alone")
	_, untouchedCompleted := stub.statusUpdates[103]
	assert.False(t, untouchedCompleted, "already-completed room left alone")

	matches := matchRepo.getMatches()
	require.Len(t, matches, 1, "only the fully-seated stale room persists a match record")
	assert.Equal(t, uint(100), matches[0].RoomID)
	assert.Equal(t, "abandoned", matches[0].Status)
	assert.Equal(t, uint(10), matches[0].Player1ID)
	assert.Equal(t, uint(40), matches[0].Player4ID)
	assert.Equal(t, 0, matches[0].WinnerTeam, "no winner for reconciled abandons")
}

func TestReconcileStaleRooms_NoOpWhenNothingStale(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	matchRepo := newMockMatchRepo()
	mgr := session.NewManager(hub, matchRepo)

	stub := newStubRoomRepo()
	stub.rooms = []room.Room{
		{ID: 1, Status: "waiting"},
		{ID: 2, Status: "completed"},
	}

	err := mgr.ReconcileStaleRooms(stub)
	require.NoError(t, err)
	assert.Empty(t, stub.statusUpdates, "no status updates when no playing rooms")
	assert.Empty(t, matchRepo.getMatches(), "no match records persisted")
}
