package game

import "github.com/emilijan/belote/server/internal/apperr"

// ApplyAction is the pure function entry point for the rules engine.
// It takes the current game state and a player action, and returns
// a new game state (or an error if the action is invalid).
// No side effects — session manager handles broadcasting, persistence, timers.
//
// Stub implementation: returns ErrWrongPhase for all actions.
// Game logic will be implemented in Stories 3.2-3.6.
func ApplyAction(state *GameState, action Action) (*GameState, error) {
	return nil, apperr.ErrWrongPhase
}
