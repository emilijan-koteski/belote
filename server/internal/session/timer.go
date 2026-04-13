package session

// cancelTurnTimer stops the current turn timer if active. Safe to call when nil.
// Must be called under session.mu.Lock().
func (s *Session) cancelTurnTimer() {
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
