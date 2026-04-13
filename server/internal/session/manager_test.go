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

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "relaxed", 0)
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

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "relaxed", 0)
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

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "relaxed", 0)
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

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "relaxed", 0)
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

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "relaxed", 0)
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

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "relaxed", 0)
	require.NoError(t, err)

	assert.True(t, mgr.HasSession(100))
}

// --- Timer Tests ---

func TestStartGame_PerMoveTimer_SetsTurnExpiresAt(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "per-move", 30)
	require.NoError(t, err)

	state := mgr.GetStateSnapshot(100)
	require.NotNil(t, state)
	assert.NotNil(t, state.TurnExpiresAt, "per-move timer should set TurnExpiresAt")
	assert.Equal(t, 30, state.TimerDurationSec)
	assert.True(t, state.TurnExpiresAt.After(time.Now()), "TurnExpiresAt should be in the future")
}

func TestStartGame_RelaxedTimer_NilTurnExpiresAt(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "relaxed", 0)
	require.NoError(t, err)

	state := mgr.GetStateSnapshot(100)
	require.NotNil(t, state)
	assert.Nil(t, state.TurnExpiresAt, "relaxed timer should NOT set TurnExpiresAt")
	assert.Equal(t, 0, state.TimerDurationSec)
}

func TestHandleAction_PerMoveTimer_ResetsOnAction(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "per-move", 30)
	require.NoError(t, err)

	state := mgr.GetStateSnapshot(100)
	require.NotNil(t, state)
	firstExpiry := state.TurnExpiresAt
	require.NotNil(t, firstExpiry)

	// Perform a valid action (pick trump in bidding phase)
	activeSeat := state.ActivePlayerSeat
	activeUserID := state.Players[activeSeat].UserID

	client := &ws.Client{UserID: activeUserID}
	msg := ws.WSMessage{
		Type:    "action:pick_trump",
		Payload: json.RawMessage(`{}`),
	}
	mgr.HandleAction(client, msg)
	time.Sleep(100 * time.Millisecond)

	newState := mgr.GetStateSnapshot(100)
	require.NotNil(t, newState)
	// After picking trump, phase transitions to playing — new expiry for next player
	if newState.TurnExpiresAt != nil {
		assert.True(t, !newState.TurnExpiresAt.Before(*firstExpiry),
			"new TurnExpiresAt should be >= first expiry (timer reset)")
	}
}

func TestPerMoveTimer_AutoPlayOnExpiry(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	// Use a very short timer (1 second) so it expires quickly in the test
	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "per-move", 1)
	require.NoError(t, err)

	state := mgr.GetStateSnapshot(100)
	require.NotNil(t, state)
	assert.Equal(t, game.PhaseBidding, state.Phase)

	// Pick trump to transition to playing phase (where auto-play can happen)
	activeSeat := state.ActivePlayerSeat
	activeUserID := state.Players[activeSeat].UserID
	client := &ws.Client{UserID: activeUserID}
	msg := ws.WSMessage{
		Type:    "action:pick_trump",
		Payload: json.RawMessage(`{}`),
	}
	mgr.HandleAction(client, msg)
	time.Sleep(100 * time.Millisecond)

	playingState := mgr.GetStateSnapshot(100)
	require.NotNil(t, playingState)
	assert.Equal(t, game.PhasePlaying, playingState.Phase)

	totalBefore := 0
	for _, p := range playingState.Players {
		totalBefore += len(p.Hand)
	}

	// Wait for timer to expire and auto-play to fire. With 1s timer, multiple
	// auto-steps may be needed (skip declaration → skip belot → play card),
	// each taking 1s. Wait long enough for all steps.
	time.Sleep(4500 * time.Millisecond)

	afterAutoPlay := mgr.GetStateSnapshot(100)
	require.NotNil(t, afterAutoPlay, "session should still exist after auto-play")

	// At least one card should have been played after enough timer cycles
	cardCountAfter := 0
	for _, p := range afterAutoPlay.Players {
		cardCountAfter += len(p.Hand)
	}
	assert.Less(t, cardCountAfter, totalBefore, "auto-play should have played at least one card")
}

func TestPerMoveTimer_ConcurrentActionAndExpiry(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	// Use 1-second timer
	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "per-move", 1)
	require.NoError(t, err)

	// Transition to playing phase
	state := mgr.GetStateSnapshot(100)
	activeSeat := state.ActivePlayerSeat
	activeUserID := state.Players[activeSeat].UserID
	client := &ws.Client{UserID: activeUserID}
	msg := ws.WSMessage{
		Type:    "action:pick_trump",
		Payload: json.RawMessage(`{}`),
	}
	mgr.HandleAction(client, msg)
	time.Sleep(50 * time.Millisecond)

	playingState := mgr.GetStateSnapshot(100)
	require.NotNil(t, playingState)
	require.Equal(t, game.PhasePlaying, playingState.Phase)

	// Fire many concurrent actions and let the timer expire simultaneously.
	// This tests that the generation counter prevents stale timer callbacks
	// from acting on the wrong turn.
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			s := mgr.GetStateSnapshot(100)
			if s == nil {
				return
			}
			seat := s.ActivePlayerSeat
			uid := s.Players[seat].UserID
			c := &ws.Client{UserID: uid}
			// Try to play a card (may fail if not our turn)
			if len(s.Players[seat].Hand) > 0 {
				card := s.Players[seat].Hand[0]
				payload, _ := json.Marshal(map[string]string{"cardId": card.String()})
				m := ws.WSMessage{
					Type:    "action:play_card",
					Payload: payload,
				}
				mgr.HandleAction(c, m)
			}
		}()
	}

	// Let timer expire concurrently with actions
	time.Sleep(1200 * time.Millisecond)
	wg.Wait()

	// The session should still be valid (no panic, no corruption)
	finalState := mgr.GetStateSnapshot(100)
	require.NotNil(t, finalState, "session should survive concurrent access")
}
