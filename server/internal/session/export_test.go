package session

import (
	"github.com/emilijan/beljot/server/internal/game"
	"github.com/emilijan/beljot/server/internal/match"
	"github.com/emilijan/beljot/server/internal/ws"
)

// HandleMatchEndForTest exposes handleMatchEnd for tests in the external
// session_test package. Used by Story 8.5-1 AC4 tests to assert the
// persist-before-broadcast invariant directly without driving a full game to
// match completion.
func (m *Manager) HandleMatchEndForTest(roomID uint, finalState *game.GameState, surrenderedBy *uint, payload ws.MatchEndPayload) {
	m.mu.RLock()
	session, ok := m.sessions[roomID]
	m.mu.RUnlock()
	if !ok {
		return
	}
	m.handleMatchEnd(session, finalState, surrenderedBy, payload)
}

// AutoActionTypeFor exposes autoActionTypeFor for tests in the external
// session_test package. The wire-format mapping is the contract surface;
// keep it tested independently so future refactors don't silently drift.
func AutoActionTypeFor(actionType string) (ws.AutoActionType, bool) {
	return autoActionTypeFor(actionType)
}

// BufferHandResultIfScored exposes bufferHandResultIfScored for tests in the
// external session_test package.
func (m *Manager) BufferHandResultIfScored(roomID uint, oldState, newState *game.GameState) {
	m.mu.RLock()
	session, ok := m.sessions[roomID]
	m.mu.RUnlock()
	if !ok {
		return
	}
	m.bufferHandResultIfScored(session, oldState, newState)
}

// HandResults returns a copy of the session's buffered hand results for tests.
func (m *Manager) HandResults(roomID uint) []match.HandResult {
	m.mu.RLock()
	session, ok := m.sessions[roomID]
	m.mu.RUnlock()
	if !ok {
		return nil
	}
	session.mu.RLock()
	defer session.mu.RUnlock()
	out := make([]match.HandResult, len(session.handResults))
	copy(out, session.handResults)
	return out
}
