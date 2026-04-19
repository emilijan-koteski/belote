package session

import (
	"github.com/emilijan/belote/server/internal/game"
	"github.com/emilijan/belote/server/internal/match"
)

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
