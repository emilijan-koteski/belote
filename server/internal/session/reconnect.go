package session

import (
	"log/slog"
	"time"

	"github.com/emilijan/belote/server/internal/game"
	"github.com/emilijan/belote/server/internal/ws"
)

// HandleDisconnect is called by the hub when a client truly disconnects (not replaced).
// If the user is in an active game session, this transitions the game to PhaseDisconnected,
// broadcasts the disconnect event, and starts a reconnect countdown timer.
func (m *Manager) HandleDisconnect(userID uint) {
	m.mu.RLock()
	roomID, ok := m.userToRoom[userID]
	if !ok {
		m.mu.RUnlock()
		return // Not in a game session — lobby disconnect, no game impact
	}
	session, ok := m.sessions[roomID]
	m.mu.RUnlock()
	if !ok {
		return
	}

	session.mu.Lock()
	if session.closed {
		session.mu.Unlock()
		return
	}

	gs := session.gameState

	// [F3] Only handle disconnect during stable player-facing phases (AC1)
	switch gs.Phase {
	case game.PhasePlaying, game.PhaseBidding, game.PhasePaused:
		// These are valid phases for disconnect handling — proceed
	default:
		// Transient phases (dealing, trick_resolving, hand_scoring, match_end, disconnected) — skip
		session.mu.Unlock()
		return
	}

	// Find the seat index for the disconnected user
	seat := -1
	for i, uid := range session.playerIDs {
		if uid == userID {
			seat = i
			break
		}
	}
	if seat == -1 {
		session.mu.Unlock()
		return
	}

	slog.Info("session: player disconnected", "roomID", roomID, "userID", userID, "seat", seat)

	// [F5] Track whether we auto-cleared a pause — if so, TurnTimeRemaining
	// is already preserved from the original pause and should not be overwritten.
	pauseWasAutoCleared := false

	// Auto-clear disconnected player's active pause (fixes D54)
	if gs.PausedPlayers[seat] {
		gs.PausedPlayers[seat] = false
		// If game was paused and no other pauses remain, restore previous phase
		anyPaused := false
		for _, p := range gs.PausedPlayers {
			if p {
				anyPaused = true
				break
			}
		}
		if !anyPaused && gs.Phase == game.PhasePaused {
			gs.Phase = gs.PreviousPhase
			gs.PreviousPhase = ""
			pauseWasAutoCleared = true
		}
	}

	// Mark player as disconnected
	gs.Players[seat].Connected = false

	// [F4] Increment timerGeneration to invalidate any in-flight stale timer callback
	session.timerGeneration++

	// Cancel turn timer and capture remaining time (same pattern as pause)
	session.cancelTurnTimer()
	// [F5] Only capture TurnTimeRemaining from TurnExpiresAt if we didn't just auto-clear
	// a pause — in the pause case, TurnTimeRemaining was already stored by the original
	// pause action and TurnExpiresAt is nil, so we should keep the existing value.
	if !pauseWasAutoCleared {
		if gs.TurnExpiresAt != nil {
			remaining := time.Until(*gs.TurnExpiresAt)
			if remaining > 0 {
				gs.TurnTimeRemaining = remaining.Milliseconds()
			}
		}
		gs.TurnExpiresAt = nil
	}

	// [F2] Transition to disconnected phase — when current phase is PhasePaused
	// (other players still have active pauses), save the pre-pause phase, not PhasePaused itself.
	if gs.Phase == game.PhasePaused {
		// gs.PreviousPhase already holds the pre-pause phase — keep it as the restore target
		// (don't overwrite with PhasePaused)
	} else {
		gs.PreviousPhase = gs.Phase
	}
	gs.Phase = game.PhaseDisconnected
	gs.DisconnectedSeat = seat

	// Set reconnect expiry using absolute server timestamp
	reconnectExpiry := time.Now().Add(time.Duration(session.reconnectWindowSec) * time.Second)
	gs.ReconnectExpiresAt = &reconnectExpiry

	// Start reconnect countdown timer
	session.cancelReconnectTimer()
	session.reconnectGeneration++
	gen := session.reconnectGeneration
	session.reconnectTimer = time.AfterFunc(
		time.Duration(session.reconnectWindowSec)*time.Second,
		func() {
			m.handleReconnectTimeout(session, gen)
		},
	)

	// [F1] Capture immutable values and build messages BEFORE unlocking to avoid data races.
	// The gs pointer aliases session.gameState — concurrent HandleAction could mutate after unlock.
	playerIDs := session.playerIDs
	username := "" // D43: server PlayerState has no Username field; client resolves from gameState

	disconnectPayload := ws.PlayerDisconnectedPayload{
		PlayerSeat:         seat,
		Username:           username,
		ReconnectExpiresAt: reconnectExpiry.UTC().Format(time.RFC3339Nano),
	}

	disconnectMsg := buildMessage(ws.EventPlayerDisconnected, disconnectPayload)
	stateMsg := buildMessage(ws.EventGameState, gs)

	session.mu.Unlock()

	// Broadcast to remaining 3 players (exclude disconnected player)
	remainingPlayers := make([]uint, 0, 3)
	for i, uid := range playerIDs {
		if i != seat {
			remainingPlayers = append(remainingPlayers, uid)
		}
	}
	m.hub.BroadcastToUsers(remainingPlayers, disconnectMsg)
	m.hub.BroadcastToUsers(remainingPlayers, stateMsg)
}

// handleReconnectTimeout is called when the reconnect countdown expires.
// For now this is a placeholder — match abandonment is implemented in Story 5.5.
func (m *Manager) handleReconnectTimeout(session *Session, generation uint64) {
	session.mu.Lock()
	defer session.mu.Unlock()

	// Guard: session closed or generation stale (player already reconnected)
	if session.closed || session.reconnectGeneration != generation {
		return
	}

	slog.Warn("session: reconnect timeout expired — match abandonment not yet implemented (Story 5.5)",
		"roomID", session.roomID,
	)
	// Story 5.5 will implement: transition to PhaseMatchEnd with abandon status,
	// persist match record, broadcast event:match_abandoned, return players to lobby.
}
