package game

import "github.com/emilijan/belote/server/internal/apperr"

// ApplyAction is the pure function entry point for the rules engine.
// It takes the current game state and a player action, and returns
// a new game state (or an error if the action is invalid).
// No side effects — session manager handles broadcasting, persistence, timers.
func ApplyAction(state *GameState, action Action) (*GameState, error) {
	switch state.Phase {
	case PhaseBidding:
		return handleBidding(state, action)
	case PhasePlaying:
		return handlePlaying(state, action)
	case PhaseMatchEnd:
		return nil, apperr.ErrWrongPhase
	case PhasePaused:
		return nil, apperr.ErrGamePaused
	default:
		return nil, apperr.ErrWrongPhase
	}
}
