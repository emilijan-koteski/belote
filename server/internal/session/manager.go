package session

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/emilijan/belote/server/internal/game"
	"github.com/emilijan/belote/server/internal/match"
	"github.com/emilijan/belote/server/internal/room"
	"github.com/emilijan/belote/server/internal/ws"
)

// Session holds the live game state and player mapping for one active game.
type Session struct {
	gameState            *game.GameState
	playerIDs            [4]uint // index = seat
	roomID               uint
	startedAt            time.Time
	timerStyle           string      // "relaxed" or "per-move"
	timerDurationSec     int         // seconds per move (only used when timerStyle == "per-move")
	turnTimer            *time.Timer // current per-move timer (nil when inactive)
	timerGeneration      uint64      // incremented on each turn; timer callback checks staleness
	reconnectWindowSec   int         // seconds to wait for disconnected player (default 120)
	reconnectTimer       *time.Timer // reconnect countdown timer (nil when inactive)
	reconnectGeneration  uint64      // incremented on each disconnect; timer callback checks staleness
	closed               bool        // set when session is being removed
	mu                   sync.RWMutex
}

// RoomStatusUpdater updates a room's status in the database.
type RoomStatusUpdater interface {
	UpdateRoomStatus(roomID uint, status string) error
}

// Manager orchestrates game sessions: receives actions via WebSocket,
// calls the rules engine, broadcasts results, and persists completed matches.
type Manager struct {
	sessions    map[uint]*Session // keyed by roomID
	userToRoom  map[uint]uint     // userID → roomID for quick lookup
	hub         *ws.Hub
	matchRepo   match.MatchRepository
	roomUpdater RoomStatusUpdater
	mu          sync.RWMutex
}

// NewManager creates a session manager wired to the WebSocket hub and match repository.
func NewManager(hub *ws.Hub, matchRepo match.MatchRepository) *Manager {
	return &Manager{
		sessions:   make(map[uint]*Session),
		userToRoom: make(map[uint]uint),
		hub:        hub,
		matchRepo:  matchRepo,
	}
}

// SetRoomUpdater sets the interface for updating room status on match completion.
func (m *Manager) SetRoomUpdater(updater RoomStatusUpdater) {
	m.roomUpdater = updater
}

// StartGame creates a new game session from room data and broadcasts the initial state.
func (m *Manager) StartGame(roomID uint, variant string, matchMode string, players [4]room.PlayerSeatInfo, timerStyle string, timerDurationSec int, ownerID uint, reconnectWindowSec int) error {
	m.mu.Lock()
	if _, exists := m.sessions[roomID]; exists {
		m.mu.Unlock()
		return fmt.Errorf("session already exists for room %d", roomID)
	}

	var playerIDs [4]uint
	for _, p := range players {
		playerIDs[p.Seat] = p.UserID
	}

	gs := game.NewGame(playerIDs, game.Variant(variant), matchMode, roomID)

	// Map room owner to seat index for pause override validation.
	// Default to -1 (no owner override available) if ownerID not found among players.
	gs.OwnerSeat = -1
	for i, uid := range playerIDs {
		if uid == ownerID {
			gs.OwnerSeat = i
			break
		}
	}

	session := &Session{
		gameState:          gs,
		playerIDs:          playerIDs,
		roomID:             roomID,
		startedAt:          time.Now(),
		timerStyle:         timerStyle,
		timerDurationSec:   timerDurationSec,
		reconnectWindowSec: reconnectWindowSec,
	}

	m.sessions[roomID] = session
	for _, uid := range playerIDs {
		m.userToRoom[uid] = roomID
	}
	m.mu.Unlock()

	slog.Info("session: game started", "roomID", roomID, "players", playerIDs)

	// Broadcast dealing-phase state (client shows deal animation)
	m.hub.BroadcastToUsers(playerIDs[:], buildMessage(ws.EventGameState, gs))

	// Auto-transition to bidding phase (client's DealAnimation handles visual timing)
	if gs.Phase == game.PhaseDealing {
		session.mu.Lock()
		gs.Phase = game.PhaseBidding
		m.setTurnExpiry(session, gs)
		m.startTimerLocked(session)
		session.mu.Unlock()
		m.hub.BroadcastToUsers(playerIDs[:], buildMessage(ws.EventGameState, gs))
	}

	return nil
}

// HandleAction processes a player's game action received via WebSocket.
// This is called by the hub's action handler (dispatched in a goroutine).
func (m *Manager) HandleAction(client *ws.Client, msg ws.WSMessage) {
	m.mu.RLock()
	roomID, ok := m.userToRoom[client.UserID]
	if !ok {
		m.mu.RUnlock()
		m.sendError(client.UserID, ws.ErrorInvalidAction, "not in a game session")
		return
	}
	session, ok := m.sessions[roomID]
	m.mu.RUnlock()
	if !ok {
		m.sendError(client.UserID, ws.ErrorInvalidAction, "game session not found")
		return
	}

	// Parse the action from the WS message
	action, err := m.parseAction(client.UserID, session, msg)
	if err != nil {
		m.sendError(client.UserID, ws.ErrorInvalidAction, err.Error())
		return
	}

	// Lock the session for state mutation — cancel timer first to prevent race
	session.mu.Lock()
	if session.closed {
		session.mu.Unlock()
		return
	}
	session.cancelTurnTimer()

	oldState := session.gameState
	newState, err := game.ApplyAction(oldState, action)
	if err != nil {
		// Restart timer since we cancelled it but the action failed
		if oldState.Phase != game.PhasePaused {
			m.setTurnExpiry(session, oldState)
			m.startTimerLocked(session)
		}
		session.mu.Unlock()
		m.sendGameError(client.UserID, err)
		return
	}

	// Handle dealing→bidding auto-transition inside the lock (prevents data race)
	if newState.Phase == game.PhaseDealing {
		newState.Phase = game.PhaseBidding
	}

	// Timer management for pause/unpause
	if action.Type == game.ActionPause && newState.Phase == game.PhasePaused {
		// Capture remaining timer time before discarding it
		if oldState.TurnExpiresAt != nil {
			remaining := time.Until(*oldState.TurnExpiresAt)
			if remaining > 0 {
				newState.TurnTimeRemaining = remaining.Milliseconds()
			}
		}
		newState.TurnExpiresAt = nil
		// Do NOT start timer — game is paused
	} else if (action.Type == game.ActionUnpause || action.Type == game.ActionOwnerUnpause) && newState.Phase != game.PhasePaused {
		// Game resumed — restore timer from preserved remaining time
		if session.timerStyle == "per-move" {
			// Enforce a minimum floor of 3 seconds to give the player reaction time after unpause
			const minResumeMs int64 = 3000
			remaining := time.Duration(newState.TurnTimeRemaining) * time.Millisecond
			if newState.TurnTimeRemaining > 0 && newState.TurnTimeRemaining < minResumeMs {
				remaining = time.Duration(minResumeMs) * time.Millisecond
			} else if newState.TurnTimeRemaining <= 0 {
				// Timer had expired or was not active — give minimum floor, not a full reset
				remaining = time.Duration(minResumeMs) * time.Millisecond
			}
			expiry := time.Now().Add(remaining)
			newState.TurnExpiresAt = &expiry
			newState.TurnTimeRemaining = 0
			// Start timer with remaining duration
			session.cancelTurnTimer()
			session.timerGeneration++
			gen := session.timerGeneration
			expectedSeat := newState.ActivePlayerSeat
			session.turnTimer = time.AfterFunc(remaining, func() {
				m.handleTimerExpiry(session, gen, expectedSeat)
			})
		} else {
			newState.TurnTimeRemaining = 0
		}
	} else if newState.Phase == game.PhasePlaying || newState.Phase == game.PhaseBidding {
		// Normal turn — set expiry and start timer
		m.setTurnExpiry(session, newState)
		m.startTimerLocked(session)
	}

	session.gameState = newState
	// Capture immutable values for use after unlock
	playerIDs := session.playerIDs
	startedAt := session.startedAt
	session.mu.Unlock()

	// Broadcast the result using captured local variables (not session.gameState)
	m.broadcastActionResult(playerIDs, oldState, newState, action, false, startedAt)

	// Check for match completion
	if newState.Phase == game.PhaseMatchEnd {
		m.handleMatchEnd(session, newState)
	}
}

// GetStateSnapshot returns the current game state for a room (used for reconnection).
func (m *Manager) GetStateSnapshot(roomID uint) *game.GameState {
	m.mu.RLock()
	session, ok := m.sessions[roomID]
	m.mu.RUnlock()
	if !ok {
		return nil
	}
	session.mu.RLock()
	defer session.mu.RUnlock()
	return session.gameState
}

// RemoveSession cleans up a game session, cancelling any active timer.
func (m *Manager) RemoveSession(roomID uint) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if session, ok := m.sessions[roomID]; ok {
		session.mu.Lock()
		session.closed = true
		session.cancelTurnTimer()
		session.cancelReconnectTimer()
		session.mu.Unlock()
		for _, uid := range session.playerIDs {
			delete(m.userToRoom, uid)
		}
		delete(m.sessions, roomID)
		slog.Info("session: removed", "roomID", roomID)
	}
}

// HasSession checks if a game session exists for a room.
func (m *Manager) HasSession(roomID uint) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	_, ok := m.sessions[roomID]
	return ok
}

// parseAction converts a WS message into a game.Action for the rules engine.
func (m *Manager) parseAction(userID uint, session *Session, msg ws.WSMessage) (game.Action, error) {
	// Find seat for this user (playerIDs is immutable after StartGame)
	seat := -1
	for i, uid := range session.playerIDs {
		if uid == userID {
			seat = i
			break
		}
	}
	if seat == -1 {
		return game.Action{}, fmt.Errorf("user %d not found in session", userID)
	}

	// Extract action type from the WS event type (strip "action:" prefix)
	actionType := ""
	if len(msg.Type) > 7 && msg.Type[:7] == "action:" {
		actionType = msg.Type[7:]
	}
	if actionType == "" {
		return game.Action{}, fmt.Errorf("invalid action type: %s", msg.Type)
	}

	// Map WS event names to rules engine action types where they differ
	if actionType == "decline_belot" {
		actionType = game.ActionSkipBelot
	}

	action := game.Action{
		Type:       actionType,
		PlayerSeat: seat,
	}

	// Parse card from payload for play_card action
	if actionType == game.ActionPlayCard {
		var payload struct {
			CardID string `json:"cardId"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return game.Action{}, fmt.Errorf("invalid play_card payload: %w", err)
		}
		card, err := game.ParseCard(payload.CardID)
		if err != nil {
			return game.Action{}, fmt.Errorf("invalid card: %w", err)
		}
		action.Card = &card
	}

	// Parse suit from payload for pick_trump action (round 2 requires suit selection)
	if actionType == game.ActionPickTrump {
		var payload struct {
			Suit string `json:"suit"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err == nil && payload.Suit != "" {
			suit := game.Suit(payload.Suit)
			action.Suit = &suit
		}
		// If no suit provided, it's round 1 (picking the trump candidate) — action.Suit stays nil
	}

	return action, nil
}

// broadcastActionResult sends the appropriate event(s) after a successful action.
// All parameters are local values — no session.gameState reads (avoids data races).
// autoPlayed indicates whether the card was played by the timer auto-play system.
// startedAt is the session start time, used to compute match duration on match_end.
func (m *Manager) broadcastActionResult(playerIDs [4]uint, oldState, newState *game.GameState, action game.Action, autoPlayed bool, startedAt time.Time) {
	userIDs := playerIDs[:]

	switch action.Type {
	case game.ActionPlayCard:
		// Broadcast card played
		cardPlayed := map[string]interface{}{
			"playerSeat": action.PlayerSeat,
			"cardId":     action.Card.String(),
			"autoPlayed": autoPlayed,
		}
		m.hub.BroadcastToUsers(userIDs, buildMessage(ws.EventCardPlayed, cardPlayed))

		// Check if trick completed: oldState had cards in the trick, newState cleared them
		// or hand/match transitioned (trick number wrapped or phase changed)
		trickCompleted := len(oldState.CurrentTrick) == 3 && // 4th card was just played (3 in old + this one)
			(len(newState.CurrentTrick) == 0 || newState.Phase != game.PhasePlaying)

		if trickCompleted {
			// Capture trick winner from oldState's trick context — after resolution
			// the winner is in the state returned by ApplyAction
			winnerSeat := 0
			if oldState.TrickWinnerSeat != nil {
				winnerSeat = *oldState.TrickWinnerSeat
			} else if newState.TrickWinnerSeat != nil {
				winnerSeat = *newState.TrickWinnerSeat
			}

			trickCards := make([]string, 0, 4)
			for _, tc := range oldState.CurrentTrick {
				trickCards = append(trickCards, tc.Card.String())
			}
			if action.Card != nil {
				trickCards = append(trickCards, action.Card.String())
			}

			trickResolved := map[string]interface{}{
				"winnerSeat": winnerSeat,
				"winnerTeam": game.TeamForSeat(winnerSeat),
				"cards":      trickCards,
			}
			m.hub.BroadcastToUsers(userIDs, buildMessage(ws.EventTrickResolved, trickResolved))
		}

		// Check if hand was scored (hand number incremented or match ended)
		if (oldState.HandNumber < newState.HandNumber || newState.Phase == game.PhaseMatchEnd) && newState.LastHandResult != nil {
			hr := newState.LastHandResult
			handScored := map[string]interface{}{
				"redCardPoints":   hr.RedCardPoints,
				"blueCardPoints":  hr.BlueCardPoints,
				"redDeclPoints":   hr.RedDeclPoints,
				"blueDeclPoints":  hr.BlueDeclPoints,
				"lastTrickTeam":   hr.LastTrickTeam,
				"lastTrickBonus":  hr.LastTrickBonus,
				"capot":           hr.Capot,
				"capotTeam":       hr.CapotTeam,
				"capotBonus":      hr.CapotBonus,
				"failedContract":  hr.FailedContract,
				"contractingTeam": hr.ContractingTeam,
				"redHandTotal":    hr.RedHandTotal,
				"blueHandTotal":   hr.BlueHandTotal,
				"redMatchScore":   newState.TeamScores[game.TeamRed],
				"blueMatchScore":  newState.TeamScores[game.TeamBlue],
			}
			m.hub.BroadcastToUsers(userIDs, buildMessage(ws.EventHandScored, handScored))
		}

		// Check if match ended
		if newState.Phase == game.PhaseMatchEnd {
			matchEnd := map[string]interface{}{
				"winnerTeam":       safeDerefInt(newState.WinnerTeam),
				"redFinalScore":    newState.TeamScores[game.TeamRed],
				"blueFinalScore":   newState.TeamScores[game.TeamBlue],
				"matchDurationSec": int(time.Since(startedAt).Seconds()),
			}
			m.hub.BroadcastToUsers(userIDs, buildMessage(ws.EventMatchEnd, matchEnd))
		}

	case game.ActionPickTrump:
		if newState.TrumpSuit != nil {
			trumpSelected := map[string]interface{}{
				"playerSeat": action.PlayerSeat,
				"trumpSuit":  string(*newState.TrumpSuit),
			}
			m.hub.BroadcastToUsers(userIDs, buildMessage(ws.EventTrumpSelected, trumpSelected))
		} else {
			m.hub.BroadcastToUsers(userIDs, buildMessage(ws.EventGameState, newState))
		}

	case game.ActionPassTrump:
		m.hub.BroadcastToUsers(userIDs, buildMessage(ws.EventGameState, newState))

	case game.ActionDeclare, game.ActionSkipDeclare:
		if newState.DeclarationsResolved && !oldState.DeclarationsResolved {
			var decls []map[string]interface{}
			for _, p := range newState.Players {
				for _, d := range p.Declarations {
					decls = append(decls, map[string]interface{}{
						"playerSeat": d.PlayerSeat,
						"type":       string(d.Type),
						"value":      d.Value,
						"cards":      cardsToIDs(d.Cards),
					})
				}
			}
			// Determine declaration winner from points
			var declWinnerTeam interface{} = nil
			if newState.DeclarationPoints[game.TeamRed] > 0 {
				declWinnerTeam = game.TeamRed
			} else if newState.DeclarationPoints[game.TeamBlue] > 0 {
				declWinnerTeam = game.TeamBlue
			}
			declResolved := map[string]interface{}{
				"winnerTeam":   declWinnerTeam,
				"declarations": decls,
			}
			m.hub.BroadcastToUsers(userIDs, buildMessage(ws.EventDeclarationsResolved, declResolved))
		} else {
			m.hub.BroadcastToUsers(userIDs, buildMessage(ws.EventGameState, newState))
		}

	case game.ActionAnnounceBelot, game.ActionSkipBelot:
		if newState.BelotAnnounced && !oldState.BelotAnnounced {
			belot := map[string]interface{}{
				"playerSeat": action.PlayerSeat,
				"team":       game.TeamForSeat(action.PlayerSeat),
			}
			m.hub.BroadcastToUsers(userIDs, buildMessage(ws.EventBelotAnnounced, belot))
		} else {
			m.hub.BroadcastToUsers(userIDs, buildMessage(ws.EventGameState, newState))
		}

	case game.ActionPause:
		paused := ws.GamePausedPayload{
			PausedBy:      action.PlayerSeat,
			PausedPlayers: newState.PausedPlayers,
		}
		m.hub.BroadcastToUsers(userIDs, buildMessage(ws.EventGamePaused, paused))
		m.hub.BroadcastToUsers(userIDs, buildMessage(ws.EventGameState, newState))

	case game.ActionUnpause, game.ActionOwnerUnpause:
		resumed := ws.GameResumedPayload{
			ResumedBy:     action.PlayerSeat,
			OwnerOverride: action.Type == game.ActionOwnerUnpause,
		}
		// Only send resumed event if game actually left paused phase
		if newState.Phase != game.PhasePaused {
			m.hub.BroadcastToUsers(userIDs, buildMessage(ws.EventGameResumed, resumed))
		}
		m.hub.BroadcastToUsers(userIDs, buildMessage(ws.EventGameState, newState))

	default:
		// For any other action, broadcast full state
		m.hub.BroadcastToUsers(userIDs, buildMessage(ws.EventGameState, newState))
	}

	// If the phase transitioned to dealing→bidding (handled inside the lock before
	// this function was called), broadcast the bidding state for the client to see
	// the dealing→bidding sequence.
	if newState.Phase == game.PhaseBidding && oldState.Phase != game.PhaseBidding &&
		(action.Type == game.ActionPassTrump || action.Type == game.ActionPlayCard) {
		m.hub.BroadcastToUsers(userIDs, buildMessage(ws.EventGameState, newState))
	}
}

// handleMatchEnd persists the match record, updates room status, and removes the session.
// Uses the passed newState (not session.gameState) to avoid data races.
func (m *Manager) handleMatchEnd(session *Session, finalState *game.GameState) {
	winnerTeam := 0
	if finalState.WinnerTeam != nil {
		winnerTeam = *finalState.WinnerTeam
	}

	matchRecord := &match.Match{
		RoomID:        session.roomID,
		Player1ID:     session.playerIDs[0],
		Player2ID:     session.playerIDs[1],
		Player3ID:     session.playerIDs[2],
		Player4ID:     session.playerIDs[3],
		TeamRedScore:  finalState.TeamScores[game.TeamRed],
		TeamBlueScore: finalState.TeamScores[game.TeamBlue],
		WinnerTeam:    winnerTeam,
		Variant:       string(finalState.Variant),
		MatchMode:     finalState.MatchMode,
		StartedAt:     session.startedAt,
		CompletedAt:   time.Now(),
		Status:        "completed",
	}

	if err := m.matchRepo.Create(matchRecord); err != nil {
		slog.Error("session: failed to persist match", "roomID", session.roomID, "error", err)
	} else {
		slog.Info("session: match persisted", "roomID", session.roomID, "matchID", matchRecord.ID)
	}

	// Update room status to completed
	if m.roomUpdater != nil {
		if err := m.roomUpdater.UpdateRoomStatus(session.roomID, "completed"); err != nil {
			slog.Error("session: failed to update room status", "roomID", session.roomID, "error", err)
		}
	}

	m.RemoveSession(session.roomID)
}

// sendError sends an error event to a single user.
func (m *Manager) sendError(userID uint, errorType string, message string) {
	payload := map[string]string{"message": message}
	m.hub.SendToUser(userID, buildMessage(errorType, payload))
}

// sendGameError maps rules engine errors to appropriate WS error events.
func (m *Manager) sendGameError(userID uint, err error) {
	m.sendError(userID, ws.ErrorInvalidAction, err.Error())
}

// buildMessage creates a JSON-encoded WS message.
func buildMessage(eventType string, payload interface{}) []byte {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		slog.Error("session: failed to marshal payload", "eventType", eventType, "error", err)
		payloadBytes = []byte(`{}`)
	}
	msg, err := json.Marshal(ws.WSMessage{
		Type:    eventType,
		Payload: payloadBytes,
	})
	if err != nil {
		slog.Error("session: failed to marshal message", "eventType", eventType, "error", err)
		return nil
	}
	return msg
}

// setTurnExpiry sets TurnExpiresAt on the game state based on timer config.
// For "per-move" style, sets an absolute expiry timestamp. For "relaxed", sets nil.
// Must be called under session.mu.Lock().
func (m *Manager) setTurnExpiry(session *Session, gs *game.GameState) {
	if session.timerStyle == "per-move" && session.timerDurationSec > 0 {
		expiry := time.Now().Add(time.Duration(session.timerDurationSec) * time.Second)
		gs.TurnExpiresAt = &expiry
		gs.TimerDurationSec = session.timerDurationSec
	} else {
		gs.TurnExpiresAt = nil
		gs.TimerDurationSec = 0
	}
}

// startTimerLocked starts the per-move turn timer for the current session.
// Must be called under session.mu.Lock(). The timer callback will acquire
// session.mu.Lock() when it fires (safe — fires in a separate goroutine later).
func (m *Manager) startTimerLocked(session *Session) {
	if session.timerStyle != "per-move" || session.timerDurationSec <= 0 {
		return
	}
	session.cancelTurnTimer()
	session.timerGeneration++
	gen := session.timerGeneration
	expectedSeat := session.gameState.ActivePlayerSeat

	duration := time.Duration(session.timerDurationSec) * time.Second
	session.turnTimer = time.AfterFunc(duration, func() {
		m.handleTimerExpiry(session, gen, expectedSeat)
	})
}

// handleTimerExpiry is called when a per-move timer fires. It auto-plays for the
// active player and broadcasts the result. The generation counter prevents stale
// timer callbacks from acting on the wrong turn.
func (m *Manager) handleTimerExpiry(session *Session, generation uint64, expectedSeat int) {
	session.mu.Lock()

	// Guard: session closed or timer is stale (turn already advanced)
	if session.closed || session.timerGeneration != generation {
		session.mu.Unlock()
		return
	}

	gs := session.gameState

	// Determine what action to auto-take based on game phase and state
	var action game.Action
	switch {
	case gs.Phase == game.PhaseBidding:
		// Auto-pass trump on bidding timeout
		action = game.Action{
			Type:       game.ActionPassTrump,
			PlayerSeat: expectedSeat,
		}
	case gs.Phase == game.PhasePlaying && gs.AwaitingDeclaration:
		// Auto-skip declaration on timer expiry
		action = game.Action{
			Type:       game.ActionSkipDeclare,
			PlayerSeat: expectedSeat,
		}
	case gs.Phase == game.PhasePlaying && gs.PendingBelotSeat != nil && *gs.PendingBelotSeat == expectedSeat:
		// Auto-skip belot announcement on timer expiry
		action = game.Action{
			Type:       game.ActionSkipBelot,
			PlayerSeat: expectedSeat,
		}
	case gs.Phase == game.PhasePlaying:
		// Auto-play a card
		cardID, err := game.AutoPlay(gs)
		if err != nil {
			slog.Error("session: auto-play failed", "roomID", session.roomID, "error", err)
			// Restart timer so the game doesn't stall
			m.startTimerLocked(session)
			session.mu.Unlock()
			return
		}
		card, err := game.ParseCard(cardID)
		if err != nil {
			slog.Error("session: auto-play card parse failed", "roomID", session.roomID, "cardID", cardID, "error", err)
			m.startTimerLocked(session)
			session.mu.Unlock()
			return
		}
		action = game.Action{
			Type:       game.ActionPlayCard,
			PlayerSeat: expectedSeat,
			Card:       &card,
		}
	default:
		// Phase doesn't support auto-play (e.g., match_end, paused)
		session.mu.Unlock()
		return
	}

	oldState := gs
	newState, err := game.ApplyAction(oldState, action)
	if err != nil {
		slog.Error("session: auto-play ApplyAction failed", "roomID", session.roomID, "error", err)
		// Restart timer so the game doesn't stall permanently
		m.startTimerLocked(session)
		session.mu.Unlock()
		return
	}

	// Handle dealing→bidding auto-transition inside the lock
	if newState.Phase == game.PhaseDealing {
		newState.Phase = game.PhaseBidding
	}

	// Set expiry and start timer for next player (inside lock)
	if newState.Phase == game.PhasePlaying || newState.Phase == game.PhaseBidding {
		m.setTurnExpiry(session, newState)
		m.startTimerLocked(session)
	}

	session.gameState = newState
	playerIDs := session.playerIDs
	startedAt := session.startedAt
	session.mu.Unlock()

	// Broadcast result
	isAutoPlayedCard := action.Type == game.ActionPlayCard
	m.broadcastActionResult(playerIDs, oldState, newState, action, isAutoPlayedCard, startedAt)

	// Check for match completion
	if newState.Phase == game.PhaseMatchEnd {
		m.handleMatchEnd(session, newState)
	}
}

func safeDerefInt(p *int) int {
	if p == nil {
		return 0
	}
	return *p
}

func cardsToIDs(cards []game.Card) []string {
	ids := make([]string, len(cards))
	for i, c := range cards {
		ids[i] = c.String()
	}
	return ids
}
