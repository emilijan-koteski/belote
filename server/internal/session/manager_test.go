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

// --- Mock Match Repository ---

type mockMatchRepo struct {
	mu      sync.Mutex
	matches []*match.Match
	hands   [][]match.HandResult // index-aligned with matches (same order as Create / CreateWithHands calls)
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
	r.hands = append(r.hands, nil)
	return nil
}

func (r *mockMatchRepo) CreateWithHands(m *match.Match, hands []match.HandResult) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.err != nil {
		return r.err
	}
	m.ID = uint(len(r.matches) + 1)
	r.matches = append(r.matches, m)
	handsCopy := make([]match.HandResult, len(hands))
	copy(handsCopy, hands)
	for i := range handsCopy {
		handsCopy[i].MatchID = m.ID
	}
	r.hands = append(r.hands, handsCopy)
	return nil
}

func (r *mockMatchRepo) GetMatchesForUser(userID uint, limit, offset int) ([]match.Match, int64, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.err != nil {
		return nil, 0, r.err
	}
	// Not exercised by session-manager tests — return empty page.
	_ = userID
	_ = limit
	_ = offset
	return nil, 0, nil
}

func (r *mockMatchRepo) GetStatsForUser(userID uint) (int, int, int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.err != nil {
		return 0, 0, 0, r.err
	}
	// Not exercised by session-manager tests — return zero counts.
	_ = userID
	return 0, 0, 0, nil
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
		{UserID: 10, Username: "player1", Seat: 0},
		{UserID: 20, Username: "player2", Seat: 1},
		{UserID: 30, Username: "player3", Seat: 2},
		{UserID: 40, Username: "player4", Seat: 3},
	}
}

// --- Tests ---

func TestStartGame_CreatesSession(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120)
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

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120)
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

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120)
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

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120)
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

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120)
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

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120)
	require.NoError(t, err)

	assert.True(t, mgr.HasSession(100))
}

func TestIsUserInGame(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	// Unknown user → false
	assert.False(t, mgr.IsUserInGame(10))
	assert.False(t, mgr.IsUserInGame(999))

	// After StartGame → all 4 seated players are in game
	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120)
	require.NoError(t, err)

	assert.True(t, mgr.IsUserInGame(10))
	assert.True(t, mgr.IsUserInGame(20))
	assert.True(t, mgr.IsUserInGame(30))
	assert.True(t, mgr.IsUserInGame(40))
	assert.False(t, mgr.IsUserInGame(999), "non-player should not be in game")

	// After RemoveSession → users no longer in game
	mgr.RemoveSession(100)
	assert.False(t, mgr.IsUserInGame(10))
	assert.False(t, mgr.IsUserInGame(20))
	assert.False(t, mgr.IsUserInGame(30))
	assert.False(t, mgr.IsUserInGame(40))
}

func TestMatchParticipants(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	// No session yet for this roomID → (zero, false)
	ids, ok := mgr.MatchParticipants(100)
	assert.False(t, ok)
	assert.Equal(t, [4]uint{}, ids)

	// After StartGame → 4 player IDs returned, indexed by seat
	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120)
	require.NoError(t, err)

	ids, ok = mgr.MatchParticipants(100)
	require.True(t, ok)
	assert.Equal(t, [4]uint{10, 20, 30, 40}, ids)

	// A different roomID → (zero, false)
	_, ok = mgr.MatchParticipants(999)
	assert.False(t, ok)

	// After RemoveSession → (zero, false)
	mgr.RemoveSession(100)
	ids, ok = mgr.MatchParticipants(100)
	assert.False(t, ok)
	assert.Equal(t, [4]uint{}, ids)
}

// --- Timer Tests ---

func TestStartGame_PerMoveTimer_SetsTurnExpiresAt(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "per-move", 30, 10, 120)
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

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120)
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

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "per-move", 30, 10, 120)
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
	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "per-move", 1, 10, 120)
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
	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "per-move", 1, 10, 120)
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

// --- Hand-result buffering (Story 7.1) ---

// bufferTestResult produces a game.HandResult populated with distinctive values so
// mapping correctness can be asserted.
func bufferTestResult(red, blue int) *game.HandResult {
	capotTeam := game.TeamBlue
	return &game.HandResult{
		RedCardPoints:   red,
		BlueCardPoints:  blue,
		RedDeclPoints:   20,
		BlueDeclPoints:  50,
		LastTrickTeam:   game.TeamRed,
		LastTrickBonus:  10,
		Capot:           true,
		CapotTeam:       &capotTeam,
		CapotBonus:      100,
		FailedContract:  true,
		ContractingTeam: game.TeamRed,
		RedHandTotal:    red + 20,
		BlueHandTotal:   blue + 150,
	}
}

func TestBufferHandResultIfScored_HandAdvanced(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)
	require.NoError(t, mgr.StartGame(900, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120))

	// Normal hand completion: HandNumber advances from 3 → 4.
	old := &game.GameState{HandNumber: 3}
	next := &game.GameState{HandNumber: 4, LastHandResult: bufferTestResult(81, 81)}

	mgr.BufferHandResultIfScored(900, old, next)

	hands := mgr.HandResults(900)
	require.Len(t, hands, 1)
	assert.Equal(t, 3, hands[0].HandNumber, "buffered hand number must be oldState.HandNumber (the hand just completed)")
	assert.Equal(t, 81, hands[0].RedCardPoints)
	assert.Equal(t, 81, hands[0].BlueCardPoints)
	assert.True(t, hands[0].Capot)
	require.NotNil(t, hands[0].CapotTeam)
	assert.Equal(t, game.TeamBlue, *hands[0].CapotTeam)
	assert.True(t, hands[0].FailedContract)
	assert.Equal(t, 101, hands[0].RedHandTotal)
	assert.Equal(t, 231, hands[0].BlueHandTotal)
}

func TestBufferHandResultIfScored_MatchEnd(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)
	require.NoError(t, mgr.StartGame(901, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120))

	// On match end startNewHand does NOT run, so HandNumber stays the same.
	old := &game.GameState{HandNumber: 7}
	next := &game.GameState{HandNumber: 7, Phase: game.PhaseMatchEnd, LastHandResult: bufferTestResult(100, 62)}

	mgr.BufferHandResultIfScored(901, old, next)

	hands := mgr.HandResults(901)
	require.Len(t, hands, 1)
	assert.Equal(t, 7, hands[0].HandNumber, "match-end buffered hand number must be oldState.HandNumber (no startNewHand ran)")
}

func TestBufferHandResultIfScored_Noop_NoTransition(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)
	require.NoError(t, mgr.StartGame(902, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120))

	// No hand advance, not match end: buffer must stay empty.
	old := &game.GameState{HandNumber: 2}
	next := &game.GameState{HandNumber: 2, Phase: game.PhasePlaying, LastHandResult: bufferTestResult(10, 20)}

	mgr.BufferHandResultIfScored(902, old, next)

	assert.Empty(t, mgr.HandResults(902))
}

func TestBufferHandResultIfScored_Noop_NilHandResult(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)
	require.NoError(t, mgr.StartGame(903, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120))

	old := &game.GameState{HandNumber: 2}
	next := &game.GameState{HandNumber: 3, LastHandResult: nil}

	mgr.BufferHandResultIfScored(903, old, next)

	assert.Empty(t, mgr.HandResults(903))
}
