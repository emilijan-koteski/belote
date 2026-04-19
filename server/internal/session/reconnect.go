package session

import (
	"log/slog"
	"time"

	"github.com/emilijan/belote/server/internal/game"
	"github.com/emilijan/belote/server/internal/match"
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
	username := gs.Players[seat].Username

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

// HandleReconnect is called by the hub when a client registers (connects or reconnects).
// If the user is in an active game session that is in PhaseDisconnected, this restores
// the game state, cancels the reconnect timer, and broadcasts the reconnection to all players.
// Safe to call for ALL connection registrations — returns immediately for non-game users.
func (m *Manager) HandleReconnect(userID uint) {
	m.mu.RLock()
	roomID, ok := m.userToRoom[userID]
	if !ok {
		m.mu.RUnlock()
		return // Not in a game session — lobby connection, no game impact
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

	// Only handle reconnection during PhaseDisconnected
	if gs.Phase != game.PhaseDisconnected {
		session.mu.Unlock()
		return
	}

	// Validate the reconnecting user matches the disconnected seat.
	// Silently return for non-matching users — ConnectHandler fires for ALL
	// connections, including players legitimately connecting while another seat
	// is disconnected. Sending an error here would confuse non-disconnected players.
	seat := gs.DisconnectedSeat
	if seat < 0 || seat >= 4 || session.playerIDs[seat] != userID {
		session.mu.Unlock()
		return
	}

	// Validate reconnect window has not expired
	if gs.ReconnectExpiresAt == nil || !time.Now().Before(*gs.ReconnectExpiresAt) {
		session.mu.Unlock()
		m.sendError(userID, ws.ErrorInvalidAction, "reconnection rejected: reconnect window expired")
		return
	}

	slog.Info("session: player reconnected", "roomID", roomID, "userID", userID, "seat", seat)

	// Restore player state
	gs.Players[seat].Connected = true
	session.cancelReconnectTimer()
	session.reconnectGeneration++ // Invalidate any in-flight reconnect timeout
	gs.Phase = gs.PreviousPhase
	gs.PreviousPhase = ""
	gs.DisconnectedSeat = -1
	gs.ReconnectExpiresAt = nil

	// Restore turn timer (same pattern as unpause timer resume in HandleAction)
	if session.timerStyle == "per-move" && (gs.Phase == game.PhasePlaying || gs.Phase == game.PhaseBidding) {
		const minResumeMs int64 = 3000
		remaining := time.Duration(gs.TurnTimeRemaining) * time.Millisecond
		if gs.TurnTimeRemaining > 0 && gs.TurnTimeRemaining < minResumeMs {
			remaining = time.Duration(minResumeMs) * time.Millisecond
		} else if gs.TurnTimeRemaining <= 0 {
			remaining = time.Duration(minResumeMs) * time.Millisecond
		}
		expiry := time.Now().Add(remaining)
		gs.TurnExpiresAt = &expiry
		gs.TurnTimeRemaining = 0
		session.cancelTurnTimer()
		session.timerGeneration++
		gen := session.timerGeneration
		expectedSeat := gs.ActivePlayerSeat
		session.turnTimer = time.AfterFunc(remaining, func() {
			m.handleTimerExpiry(session, gen, expectedSeat)
		})
	}

	// Build messages BEFORE unlocking (data-race prevention — same pattern as HandleDisconnect)
	playerIDs := session.playerIDs
	reconnectPayload := ws.PlayerReconnectedPayload{PlayerSeat: seat}
	reconnectMsg := buildMessage(ws.EventPlayerReconnected, reconnectPayload)
	stateMsg := buildMessage(ws.EventGameState, gs)

	session.mu.Unlock()

	// Broadcast to ALL 4 players (reconnecting player needs the state too)
	m.hub.BroadcastToUsers(playerIDs[:], reconnectMsg)
	m.hub.BroadcastToUsers(playerIDs[:], stateMsg)
}

// handleReconnectTimeout is called when the reconnect countdown expires.
// It transitions the game to PhaseMatchEnd (abandoned), persists the match record,
// broadcasts event:match_abandoned to all players, and cleans up the session.
func (m *Manager) handleReconnectTimeout(session *Session, generation uint64) {
	session.mu.Lock()

	// Guard: session closed or generation stale (player already reconnected)
	if session.closed || session.reconnectGeneration != generation {
		session.mu.Unlock()
		return
	}

	gs := session.gameState

	// Identify the abandoned player
	abandonedSeat := gs.DisconnectedSeat
	if abandonedSeat < 0 || abandonedSeat >= 4 {
		session.mu.Unlock()
		return
	}
	abandonedPlayerID := session.playerIDs[abandonedSeat]

	// Transition game state to match_end (abandoned)
	gs.Phase = game.PhaseMatchEnd
	// WinnerTeam stays nil — no winner for abandoned match
	// Clear disconnect fields
	gs.DisconnectedSeat = -1
	gs.ReconnectExpiresAt = nil

	// Cancel any active timers
	session.cancelReconnectTimer()
	session.cancelTurnTimer()

	// Capture data for broadcast BEFORE unlocking (data race prevention)
	playerIDs := session.playerIDs
	roomID := session.roomID
	startedAt := session.startedAt
	redScore := gs.TeamScores[game.TeamRed]
	blueScore := gs.TeamScores[game.TeamBlue]
	variant := string(gs.Variant)
	matchMode := gs.MatchMode
	// Snapshot any hands scored before the abandonment so they persist alongside
	// the match row. Empty when abandonment fires before hand 1 completed.
	handsCopy := make([]match.HandResult, len(session.handResults))
	copy(handsCopy, session.handResults)

	abandonedPayload := ws.MatchAbandonedPayload{
		AbandonedByPlayer: abandonedSeat,
		RedFinalScore:     redScore,
		BlueFinalScore:    blueScore,
		MatchDurationSec:  int(time.Since(startedAt).Seconds()),
	}
	abandonedMsg := buildMessage(ws.EventMatchAbandoned, abandonedPayload)
	stateMsg := buildMessage(ws.EventGameState, gs)

	session.mu.Unlock()

	// Broadcast to all 4 players (disconnected player gets it if they reconnect to WS later)
	userIDs := playerIDs[:]
	m.hub.BroadcastToUsers(userIDs, abandonedMsg)
	m.hub.BroadcastToUsers(userIDs, stateMsg)

	slog.Info("session: match abandoned due to reconnect timeout",
		"roomID", roomID,
		"abandonedBy", abandonedPlayerID,
		"abandonedSeat", abandonedSeat,
	)

	// Persist match record with abandoned status
	matchRecord := &match.Match{
		RoomID:        roomID,
		Player1ID:     playerIDs[0],
		Player2ID:     playerIDs[1],
		Player3ID:     playerIDs[2],
		Player4ID:     playerIDs[3],
		TeamRedScore:  redScore,
		TeamBlueScore: blueScore,
		WinnerTeam:    0,
		Variant:       variant,
		MatchMode:     matchMode,
		StartedAt:     startedAt,
		CompletedAt:   time.Now(),
		Status:        "abandoned",
		AbandonedBy:   &abandonedPlayerID,
	}

	if err := m.matchRepo.CreateWithHands(matchRecord, handsCopy); err != nil {
		slog.Error("session: failed to persist abandoned match", "roomID", roomID, "error", err)
	} else {
		slog.Info("session: abandoned match persisted", "roomID", roomID, "matchID", matchRecord.ID, "hands", len(handsCopy))
	}

	// Update room status
	if m.roomUpdater != nil {
		if err := m.roomUpdater.UpdateRoomStatus(roomID, "completed"); err != nil {
			slog.Error("session: failed to update room status", "roomID", roomID, "error", err)
		}
	}

	m.RemoveSession(roomID)
}
