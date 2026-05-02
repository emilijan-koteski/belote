package session

// cancelTurnTimer stops the current turn timer if active. Safe to call when nil.
// Must be called under session.mu.Lock().
//
// Bumps timerGeneration unconditionally so any goroutine already past
// time.AfterFunc but blocked on session.mu fails the staleness check in
// handleTimerExpiry. This makes "cancel == invalidate stale callbacks" a
// property of this function rather than a discipline imposed on every caller.
func (s *Session) cancelTurnTimer() {
	s.timerGeneration++
	if s.turnTimer != nil {
		s.turnTimer.Stop()
		s.turnTimer = nil
	}
}

// cancelReconnectTimer stops the reconnect countdown timer if active. Safe to call when nil.
// Must be called under session.mu.Lock().
func (s *Session) cancelReconnectTimer() {
	if s.reconnectTimer != nil {
		s.reconnectTimer.Stop()
		s.reconnectTimer = nil
	}
}
