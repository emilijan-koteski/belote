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

func TestMatchParticipantsByUser(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	// No session yet → (zero, -1, false) for every userID.
	ids, seat, ok := mgr.MatchParticipantsByUser(10)
	assert.False(t, ok)
	assert.Equal(t, -1, seat)
	assert.Equal(t, [4]uint{}, ids)

	// After StartGame → resolves to (participants, seat, true) for each player.
	require.NoError(t, mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120))

	for expectedSeat, userID := range []uint{10, 20, 30, 40} {
		ids, seat, ok := mgr.MatchParticipantsByUser(userID)
		require.True(t, ok, "user %d should resolve to an active session", userID)
		assert.Equal(t, [4]uint{10, 20, 30, 40}, ids)
		assert.Equal(t, expectedSeat, seat,
			"user %d expected at seat %d", userID, expectedSeat)
	}

	// Non-participant → (zero, -1, false).
	ids, seat, ok = mgr.MatchParticipantsByUser(999)
	assert.False(t, ok)
	assert.Equal(t, -1, seat)
	assert.Equal(t, [4]uint{}, ids)

	// After RemoveSession → all participants stop resolving.
	mgr.RemoveSession(100)
	for _, userID := range []uint{10, 20, 30, 40} {
		_, _, ok := mgr.MatchParticipantsByUser(userID)
		assert.False(t, ok, "user %d should no longer resolve after session removal", userID)
	}
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
func bufferTestResult(a, b int) *game.HandResult {
	capotTeam := game.TeamB
	return &game.HandResult{
		TeamACardPoints: a,
		TeamBCardPoints: b,
		TeamADeclPoints: 20,
		TeamBDeclPoints: 50,
		LastTrickTeam:   game.TeamA,
		LastTrickBonus:  10,
		Capot:           true,
		CapotTeam:       &capotTeam,
		CapotBonus:      100,
		FailedContract:  true,
		ContractingTeam: game.TeamA,
		TeamAHandTotal:  a + 20,
		TeamBHandTotal:  b + 150,
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
	assert.Equal(t, 81, hands[0].TeamACardPoints)
	assert.Equal(t, 81, hands[0].TeamBCardPoints)
	assert.True(t, hands[0].Capot)
	require.NotNil(t, hands[0].CapotTeam)
	assert.Equal(t, game.TeamB, *hands[0].CapotTeam)
	assert.True(t, hands[0].FailedContract)
	assert.Equal(t, 101, hands[0].TeamAHandTotal)
	assert.Equal(t, 231, hands[0].TeamBHandTotal)
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

// --- Surrender (Story 8.2) ---

func TestSurrender_RequestSucceeds(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	require.NoError(t, mgr.StartGame(800, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120))

	// Bidding phase is valid for surrender.
	state := mgr.GetStateSnapshot(800)
	require.NotNil(t, state)
	assert.Equal(t, game.PhaseBidding, state.Phase)

	client := &ws.Client{UserID: 10} // seat 0
	mgr.HandleAction(client, ws.WSMessage{
		Type:    "action:surrender_request",
		Payload: json.RawMessage(`{}`),
	})
	time.Sleep(50 * time.Millisecond)

	newState := mgr.GetStateSnapshot(800)
	require.NotNil(t, newState)
	require.NotNil(t, newState.SurrenderProposerSeat)
	assert.Equal(t, 0, *newState.SurrenderProposerSeat)
	assert.True(t, newState.SurrenderUsed[0])
	assert.Equal(t, game.PhaseBidding, newState.Phase, "phase unchanged on request")
	assert.True(t, mgr.HasSession(800), "session continues during pending proposal")
}

func TestSurrender_AcceptPersistsMatchAsCompleted(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	require.NoError(t, mgr.StartGame(801, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120))

	// Seat 0 (team A) requests surrender.
	mgr.HandleAction(&ws.Client{UserID: 10}, ws.WSMessage{
		Type:    "action:surrender_request",
		Payload: json.RawMessage(`{}`),
	})
	time.Sleep(50 * time.Millisecond)

	// Seat 2 (partner of seat 0) accepts.
	mgr.HandleAction(&ws.Client{UserID: 30}, ws.WSMessage{
		Type:    "action:surrender_accept",
		Payload: json.RawMessage(`{}`),
	})
	time.Sleep(100 * time.Millisecond)

	// Match record persisted with surrendered_by = seat 0's userID;
	// status stays "completed" (not "surrendered").
	matches := repo.getMatches()
	require.Len(t, matches, 1)
	m := matches[0]
	assert.Equal(t, "completed", m.Status)
	assert.Equal(t, 1, m.WinnerTeam, "Team B (team 1) wins because team A surrendered")
	require.NotNil(t, m.SurrenderedBy)
	assert.Equal(t, uint(10), *m.SurrenderedBy)
	assert.Nil(t, m.AbandonedBy, "AbandonedBy stays nil for surrender end")

	// Session removed.
	assert.False(t, mgr.HasSession(801))
}

func TestSurrender_DeclineKeepsSessionActive(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	require.NoError(t, mgr.StartGame(802, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120))

	// Seat 0 requests
	mgr.HandleAction(&ws.Client{UserID: 10}, ws.WSMessage{
		Type:    "action:surrender_request",
		Payload: json.RawMessage(`{}`),
	})
	time.Sleep(30 * time.Millisecond)

	// Seat 2 (partner) declines
	mgr.HandleAction(&ws.Client{UserID: 30}, ws.WSMessage{
		Type:    "action:surrender_decline",
		Payload: json.RawMessage(`{}`),
	})
	time.Sleep(30 * time.Millisecond)

	state := mgr.GetStateSnapshot(802)
	require.NotNil(t, state)
	assert.Nil(t, state.SurrenderProposerSeat)
	assert.True(t, state.SurrenderUsed[0], "proposer's attempt remains consumed on decline")
	assert.True(t, mgr.HasSession(802))

	// No match record persisted.
	assert.Empty(t, repo.getMatches())
}

func TestSurrender_ExhaustedAfterDecline(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	require.NoError(t, mgr.StartGame(803, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120))

	mgr.HandleAction(&ws.Client{UserID: 10}, ws.WSMessage{
		Type:    "action:surrender_request",
		Payload: json.RawMessage(`{}`),
	})
	time.Sleep(30 * time.Millisecond)
	mgr.HandleAction(&ws.Client{UserID: 30}, ws.WSMessage{
		Type:    "action:surrender_decline",
		Payload: json.RawMessage(`{}`),
	})
	time.Sleep(30 * time.Millisecond)

	// Seat 0 retries — should be rejected, state unchanged.
	mgr.HandleAction(&ws.Client{UserID: 10}, ws.WSMessage{
		Type:    "action:surrender_request",
		Payload: json.RawMessage(`{}`),
	})
	time.Sleep(30 * time.Millisecond)

	state := mgr.GetStateSnapshot(803)
	require.NotNil(t, state)
	assert.Nil(t, state.SurrenderProposerSeat, "second request rejected; no new proposer")
	assert.True(t, state.SurrenderUsed[0])
}

func TestSurrender_SecondRequestWhilePending_Rejected(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	require.NoError(t, mgr.StartGame(804, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120))

	mgr.HandleAction(&ws.Client{UserID: 10}, ws.WSMessage{
		Type:    "action:surrender_request",
		Payload: json.RawMessage(`{}`),
	})
	time.Sleep(30 * time.Millisecond)

	// Seat 1 (different player, still has their own attempt) requests while
	// seat 0's proposal is pending.
	mgr.HandleAction(&ws.Client{UserID: 20}, ws.WSMessage{
		Type:    "action:surrender_request",
		Payload: json.RawMessage(`{}`),
	})
	time.Sleep(30 * time.Millisecond)

	state := mgr.GetStateSnapshot(804)
	require.NotNil(t, state)
	require.NotNil(t, state.SurrenderProposerSeat)
	assert.Equal(t, 0, *state.SurrenderProposerSeat, "first proposer unaffected")
	assert.False(t, state.SurrenderUsed[1], "rejected request must not consume seat 1's attempt")
}

func TestSurrender_NonPartnerAccept_Rejected(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	require.NoError(t, mgr.StartGame(805, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120))

	// Seat 0 requests
	mgr.HandleAction(&ws.Client{UserID: 10}, ws.WSMessage{
		Type:    "action:surrender_request",
		Payload: json.RawMessage(`{}`),
	})
	time.Sleep(30 * time.Millisecond)

	// Seat 1 (opponent) tries to accept — must be rejected.
	mgr.HandleAction(&ws.Client{UserID: 20}, ws.WSMessage{
		Type:    "action:surrender_accept",
		Payload: json.RawMessage(`{}`),
	})
	time.Sleep(50 * time.Millisecond)

	state := mgr.GetStateSnapshot(805)
	require.NotNil(t, state)
	assert.NotEqual(t, game.PhaseMatchEnd, state.Phase, "non-partner cannot accept")
	require.NotNil(t, state.SurrenderProposerSeat, "proposal still pending")
	assert.True(t, mgr.HasSession(805))
	assert.Empty(t, repo.getMatches())
}

func TestSurrender_PauseInteraction_PreservesProposal(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	require.NoError(t, mgr.StartGame(806, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120))

	// Seat 0 requests surrender
	mgr.HandleAction(&ws.Client{UserID: 10}, ws.WSMessage{
		Type:    "action:surrender_request",
		Payload: json.RawMessage(`{}`),
	})
	time.Sleep(30 * time.Millisecond)

	// Seat 1 pauses
	mgr.HandleAction(&ws.Client{UserID: 20}, ws.WSMessage{
		Type:    "action:pause",
		Payload: json.RawMessage(`{}`),
	})
	time.Sleep(30 * time.Millisecond)

	paused := mgr.GetStateSnapshot(806)
	require.NotNil(t, paused)
	assert.Equal(t, game.PhasePaused, paused.Phase)
	require.NotNil(t, paused.SurrenderProposerSeat, "surrender proposal survives pause")
	assert.Equal(t, 0, *paused.SurrenderProposerSeat)

	// Seat 1 unpauses (clears their own pause)
	mgr.HandleAction(&ws.Client{UserID: 20}, ws.WSMessage{
		Type:    "action:unpause",
		Payload: json.RawMessage(`{}`),
	})
	time.Sleep(30 * time.Millisecond)

	resumed := mgr.GetStateSnapshot(806)
	require.NotNil(t, resumed)
	assert.NotEqual(t, game.PhasePaused, resumed.Phase)
	require.NotNil(t, resumed.SurrenderProposerSeat, "proposal still pending after unpause")
}
