package session_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/emilijan/belote/server/internal/game"
	"github.com/emilijan/belote/server/internal/game/testfixtures"
	"github.com/emilijan/belote/server/internal/session"
	"github.com/emilijan/belote/server/internal/ws"
)

func newGameReconnectingFixture(seat int) *game.GameState {
	return testfixtures.NewGameReconnecting(seat)
}

// setupDisconnectedGame creates a game session with per-move timer, picks trump
// to reach playing phase, then disconnects the specified seat. Returns the manager
// and the userID of the disconnected player.
func setupDisconnectedGame(t *testing.T, hub *ws.Hub, disconnectSeat int) (*session.Manager, uint) {
	t.Helper()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	// Start game with per-move timer (1s short for tests) and 120s reconnect window
	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "per-move", 30, 10, 120)
	require.NoError(t, err)

	state := mgr.GetStateSnapshot(100)
	require.NotNil(t, state)

	// Pick trump to reach playing phase
	activeSeat := state.ActivePlayerSeat
	activeUserID := state.Players[activeSeat].UserID
	client := &ws.Client{UserID: activeUserID}
	msg := ws.WSMessage{
		Type:    "action:pick_trump",
		Payload: []byte(`{}`),
	}
	mgr.HandleAction(client, msg)
	time.Sleep(100 * time.Millisecond)

	state = mgr.GetStateSnapshot(100)
	require.NotNil(t, state)
	require.Equal(t, game.PhasePlaying, state.Phase)

	// Disconnect the specified player
	disconnectedUserID := state.Players[disconnectSeat].UserID
	mgr.HandleDisconnect(disconnectedUserID)
	time.Sleep(100 * time.Millisecond)

	state = mgr.GetStateSnapshot(100)
	require.NotNil(t, state)
	require.Equal(t, game.PhaseDisconnected, state.Phase)
	require.Equal(t, disconnectSeat, state.DisconnectedSeat)
	require.False(t, state.Players[disconnectSeat].Connected)

	return mgr, disconnectedUserID
}

func TestHandleReconnect_RestoresPlayerState(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	mgr, disconnectedUserID := setupDisconnectedGame(t, hub, 0)

	// Reconnect the player
	mgr.HandleReconnect(disconnectedUserID)
	time.Sleep(100 * time.Millisecond)

	state := mgr.GetStateSnapshot(100)
	require.NotNil(t, state)

	// Phase restored from disconnected to playing
	assert.Equal(t, game.PhasePlaying, state.Phase)
	assert.Equal(t, "", string(state.PreviousPhase))
	// Disconnect fields cleared
	assert.Equal(t, -1, state.DisconnectedSeat)
	assert.Nil(t, state.ReconnectExpiresAt)
	// Player marked connected
	assert.True(t, state.Players[0].Connected)
}

func TestHandleReconnect_RestoresTurnTimer(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	mgr, disconnectedUserID := setupDisconnectedGame(t, hub, 0)

	// Check TurnTimeRemaining was captured during disconnect
	state := mgr.GetStateSnapshot(100)
	require.NotNil(t, state)
	assert.Nil(t, state.TurnExpiresAt, "timer should be paused during disconnect")

	// Reconnect
	mgr.HandleReconnect(disconnectedUserID)
	time.Sleep(100 * time.Millisecond)

	state = mgr.GetStateSnapshot(100)
	require.NotNil(t, state)

	// Turn timer should be restored
	assert.NotNil(t, state.TurnExpiresAt, "per-move timer should be restored on reconnect")
	assert.True(t, state.TurnExpiresAt.After(time.Now()), "timer should be in the future")
	assert.Equal(t, int64(0), state.TurnTimeRemaining, "TurnTimeRemaining should be reset to 0")
}

func TestHandleReconnect_RejectsExpiredWindow(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	// Start game with very short reconnect window (1 second)
	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "per-move", 30, 10, 1)
	require.NoError(t, err)

	// Pick trump to reach playing phase
	state := mgr.GetStateSnapshot(100)
	activeSeat := state.ActivePlayerSeat
	activeUserID := state.Players[activeSeat].UserID
	client := &ws.Client{UserID: activeUserID}
	msg := ws.WSMessage{
		Type:    "action:pick_trump",
		Payload: []byte(`{}`),
	}
	mgr.HandleAction(client, msg)
	time.Sleep(100 * time.Millisecond)

	// Disconnect seat 0
	mgr.HandleDisconnect(uint(10))
	time.Sleep(100 * time.Millisecond)

	state = mgr.GetStateSnapshot(100)
	require.Equal(t, game.PhaseDisconnected, state.Phase)

	// Wait for reconnect window to expire
	time.Sleep(1200 * time.Millisecond)

	// Attempt reconnect — should be rejected (window expired)
	mgr.HandleReconnect(uint(10))
	time.Sleep(100 * time.Millisecond)

	state = mgr.GetStateSnapshot(100)
	require.NotNil(t, state)
	// Still in disconnected phase — reconnect was rejected
	assert.Equal(t, game.PhaseDisconnected, state.Phase)
	assert.False(t, state.Players[0].Connected)
}

func TestHandleReconnect_RejectsWrongUser(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	mgr, _ := setupDisconnectedGame(t, hub, 0)

	// Try to reconnect as a different user (seat 1, userID 20)
	mgr.HandleReconnect(uint(20))
	time.Sleep(100 * time.Millisecond)

	state := mgr.GetStateSnapshot(100)
	require.NotNil(t, state)
	// Still disconnected — wrong user tried to reconnect
	assert.Equal(t, game.PhaseDisconnected, state.Phase)
	assert.Equal(t, 0, state.DisconnectedSeat)
	assert.False(t, state.Players[0].Connected)
}

func TestHandleReconnect_NoOpForNonGameUser(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	// No session exists — calling HandleReconnect should not panic
	mgr.HandleReconnect(uint(999))
	// No assertion needed — just verify no panic
}

func TestHandleReconnect_NoOpWhenNotDisconnectedPhase(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120)
	require.NoError(t, err)

	// Game is in bidding phase, not disconnected
	state := mgr.GetStateSnapshot(100)
	require.Equal(t, game.PhaseBidding, state.Phase)

	// HandleReconnect should be a no-op
	mgr.HandleReconnect(uint(10))
	time.Sleep(50 * time.Millisecond)

	state = mgr.GetStateSnapshot(100)
	assert.Equal(t, game.PhaseBidding, state.Phase)
}

func TestHandleReconnect_IdempotentOnSecondCall(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	mgr, disconnectedUserID := setupDisconnectedGame(t, hub, 0)

	// First reconnect
	mgr.HandleReconnect(disconnectedUserID)
	time.Sleep(100 * time.Millisecond)

	state := mgr.GetStateSnapshot(100)
	require.Equal(t, game.PhasePlaying, state.Phase)

	// Second reconnect (idempotent — phase is no longer disconnected)
	mgr.HandleReconnect(disconnectedUserID)
	time.Sleep(50 * time.Millisecond)

	state = mgr.GetStateSnapshot(100)
	assert.Equal(t, game.PhasePlaying, state.Phase)
	assert.True(t, state.Players[0].Connected)
}

func TestHandleReconnect_RelaxedTimer_NoTimerRestore(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	// Start with relaxed timer (no per-move timer)
	err := mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "relaxed", 0, 10, 120)
	require.NoError(t, err)

	// Pick trump to reach playing phase
	state := mgr.GetStateSnapshot(100)
	activeSeat := state.ActivePlayerSeat
	activeUserID := state.Players[activeSeat].UserID
	client := &ws.Client{UserID: activeUserID}
	msg := ws.WSMessage{
		Type:    "action:pick_trump",
		Payload: []byte(`{}`),
	}
	mgr.HandleAction(client, msg)
	time.Sleep(100 * time.Millisecond)

	// Disconnect seat 0
	mgr.HandleDisconnect(uint(10))
	time.Sleep(100 * time.Millisecond)

	// Reconnect
	mgr.HandleReconnect(uint(10))
	time.Sleep(100 * time.Millisecond)

	state = mgr.GetStateSnapshot(100)
	require.NotNil(t, state)
	assert.Equal(t, game.PhasePlaying, state.Phase)
	assert.Nil(t, state.TurnExpiresAt, "relaxed timer should NOT set TurnExpiresAt on reconnect")
}

func TestNewGameReconnectingFixture(t *testing.T) {
	gs := newGameReconnectingFixture(2)

	assert.Equal(t, game.PhaseDisconnected, gs.Phase)
	assert.Equal(t, game.PhasePlaying, gs.PreviousPhase)
	assert.Equal(t, 2, gs.DisconnectedSeat)
	assert.False(t, gs.Players[2].Connected)
	assert.NotNil(t, gs.ReconnectExpiresAt)
	assert.True(t, gs.ReconnectExpiresAt.After(time.Now()))
	assert.Equal(t, int64(15000), gs.TurnTimeRemaining)
	assert.Nil(t, gs.TurnExpiresAt)

	// Other players remain connected
	assert.True(t, gs.Players[0].Connected)
	assert.True(t, gs.Players[1].Connected)
	assert.True(t, gs.Players[3].Connected)
}
