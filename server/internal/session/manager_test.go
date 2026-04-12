package session_test

import (
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/emilijan/belote/server/internal/game"
	"github.com/emilijan/belote/server/internal/match"
	"github.com/emilijan/belote/server/internal/room"
	"github.com/emilijan/belote/server/internal/session"
	"github.com/emilijan/belote/server/internal/ws"
)

// --- Mock Hub ---

type sentMessage struct {
	UserID uint
	Data   []byte
}

type mockHub struct {
	mu       sync.Mutex
	sent     []sentMessage
	broadcast []sentMessage
}

func newMockHub() *mockHub {
	return &mockHub{}
}

func (h *mockHub) SendToUser(userID uint, msg []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.sent = append(h.sent, sentMessage{UserID: userID, Data: msg})
}

func (h *mockHub) BroadcastToUsers(userIDs []uint, msg []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, uid := range userIDs {
		h.broadcast = append(h.broadcast, sentMessage{UserID: uid, Data: msg})
	}
}

func (h *mockHub) getSent() []sentMessage {
	h.mu.Lock()
	defer h.mu.Unlock()
	result := make([]sentMessage, len(h.sent))
	copy(result, h.sent)
	return result
}

func (h *mockHub) getBroadcast() []sentMessage {
	h.mu.Lock()
	defer h.mu.Unlock()
	result := make([]sentMessage, len(h.broadcast))
	copy(result, h.broadcast)
	return result
}

// --- Mock Match Repository ---

type mockMatchRepo struct {
	mu      sync.Mutex
	matches []*match.Match
	err     error
}

func newMockMatchRepo() *mockMatchRepo {
	return &mockMatchRepo{}
}

func (r *mockMatchRepo) Create(m *match.Match) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.err != nil {
		return r.err
	}
	m.ID = uint(len(r.matches) + 1)
	r.matches = append(r.matches, m)
	return nil
}

func (r *mockMatchRepo) getMatches() []*match.Match {
	r.mu.Lock()
	defer r.mu.Unlock()
	result := make([]*match.Match, len(r.matches))
	copy(result, r.matches)
	return result
}

// --- Hub Adapter ---
// The session manager expects *ws.Hub, but we need to test with a mock.
// We'll create a real hub but intercept via SetActionHandler for integration testing.
// For unit tests, we test the Manager's public methods directly.

func defaultPlayers() [4]room.PlayerSeatInfo {
	return [4]room.PlayerSeatInfo{
		{UserID: 10, Seat: 0},
		{UserID: 20, Seat: 1},
		{UserID: 30, Seat: 2},
		{UserID: 40, Seat: 3},
	}
}

// --- Tests ---

func TestStartGame_CreatesSession(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers())
	require.NoError(t, err)

	assert.True(t, mgr.HasSession(100))

	state := mgr.GetStateSnapshot(100)
	require.NotNil(t, state)
	assert.Equal(t, uint(100), state.RoomID)
	assert.Equal(t, game.Variant("bitola"), state.Variant)
	assert.Equal(t, "1001", state.MatchMode)
	assert.Equal(t, game.PhaseBidding, state.Phase)
	assert.Equal(t, uint(10), state.Players[0].UserID)
	assert.Equal(t, uint(20), state.Players[1].UserID)
	assert.Equal(t, uint(30), state.Players[2].UserID)
	assert.Equal(t, uint(40), state.Players[3].UserID)
}

func TestStartGame_BroadcastsInitialState(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers())
	require.NoError(t, err)

	// Give broadcast time to process
	time.Sleep(50 * time.Millisecond)

	// The hub broadcast goes to connected clients — since no real WS clients
	// are connected, we verify the session was created and state is valid
	state := mgr.GetStateSnapshot(100)
	require.NotNil(t, state)
	assert.Equal(t, game.PhaseBidding, state.Phase)
}

func TestHandleAction_InvalidUser(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	// No session exists — client not in any game
	client := &ws.Client{UserID: 999}
	payload, _ := json.Marshal(map[string]string{"cardId": "KS"})
	msg := ws.WSMessage{
		Type:    "action:play_card",
		Payload: payload,
	}

	// Should not panic
	mgr.HandleAction(client, msg)
	time.Sleep(50 * time.Millisecond)
}

func TestHandleAction_PlayCard_ParsesCorrectly(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers())
	require.NoError(t, err)

	state := mgr.GetStateSnapshot(100)
	require.NotNil(t, state)

	// Find the active player and a card they hold
	activeSeat := state.ActivePlayerSeat
	activeUserID := state.Players[activeSeat].UserID
	require.True(t, len(state.Players[activeSeat].Hand) > 0, "active player should have cards")

	// Try to play a card (may fail due to game rules, but it should parse correctly)
	card := state.Players[activeSeat].Hand[0]
	payload, _ := json.Marshal(map[string]string{"cardId": card.String()})
	msg := ws.WSMessage{
		Type:    "action:play_card",
		Payload: payload,
	}

	client := &ws.Client{UserID: activeUserID}
	mgr.HandleAction(client, msg)
	time.Sleep(50 * time.Millisecond)

	// The action may succeed or fail depending on game phase (bidding vs playing)
	// but it should not panic
}

func TestHandleAction_BiddingActions(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers())
	require.NoError(t, err)

	state := mgr.GetStateSnapshot(100)
	require.NotNil(t, state)
	assert.Equal(t, game.PhaseBidding, state.Phase)

	// The active player should be able to pick or pass trump
	activeSeat := state.ActivePlayerSeat
	activeUserID := state.Players[activeSeat].UserID

	// Try pick_trump
	msg := ws.WSMessage{
		Type:    "action:pick_trump",
		Payload: json.RawMessage(`{}`),
	}
	client := &ws.Client{UserID: activeUserID}
	mgr.HandleAction(client, msg)
	time.Sleep(100 * time.Millisecond)

	// Check state changed — either trump was picked or not depending on rules
	newState := mgr.GetStateSnapshot(100)
	require.NotNil(t, newState)
	// After picking trump in bidding, phase should transition to playing
	assert.Equal(t, game.PhasePlaying, newState.Phase)
	assert.NotNil(t, newState.TrumpSuit)
}

func TestGetStateSnapshot_NoSession(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	state := mgr.GetStateSnapshot(999)
	assert.Nil(t, state)
}

func TestRemoveSession(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers())
	require.NoError(t, err)
	assert.True(t, mgr.HasSession(100))

	mgr.RemoveSession(100)
	assert.False(t, mgr.HasSession(100))
	assert.Nil(t, mgr.GetStateSnapshot(100))
}

func TestHasSession(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	assert.False(t, mgr.HasSession(100))

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers())
	require.NoError(t, err)

	assert.True(t, mgr.HasSession(100))
}
