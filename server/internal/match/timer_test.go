package match

import (
	"testing"
	"time"
)

// TestCancelTurnTimer_BumpsGeneration locks in Story 8.5-1 AC1 / D-2026-05-02
// "cancelTurnTimer() does not increment timerGeneration".
//
// cancelTurnTimer must bump timerGeneration on EVERY call — not only the
// callsites that immediately re-arm a timer afterwards. This guarantees that
// any in-flight time.AfterFunc goroutine already past its trigger but blocked
// on session.mu fails the staleness check in handleTimerExpiry. Without this
// invariant a future patch that adds work above handleTimerExpiry's switch
// could fire spuriously after a cancel.
func TestCancelTurnTimer_BumpsGeneration(t *testing.T) {
	s := &LiveMatch{timerGeneration: 7}

	s.mu.Lock()
	before := s.timerGeneration
	s.cancelTurnTimer()
	after := s.timerGeneration
	s.mu.Unlock()

	if after != before+1 {
		t.Fatalf("cancelTurnTimer must bump timerGeneration by 1; before=%d after=%d", before, after)
	}
}

// TestCancelTurnTimer_BumpsGeneration_WithActiveTimer confirms the bump
// happens even when an active *time.Timer is being stopped (the original case
// the staleness guard was designed for).
func TestCancelTurnTimer_BumpsGeneration_WithActiveTimer(t *testing.T) {
	s := &LiveMatch{timerGeneration: 0}
	// Schedule far enough out that Stop() succeeds before it fires.
	s.turnTimer = time.AfterFunc(time.Hour, func() {})

	s.mu.Lock()
	before := s.timerGeneration
	s.cancelTurnTimer()
	after := s.timerGeneration
	tt := s.turnTimer
	s.mu.Unlock()

	if after != before+1 {
		t.Fatalf("cancelTurnTimer must bump generation when stopping an active timer; before=%d after=%d", before, after)
	}
	if tt != nil {
		t.Fatalf("cancelTurnTimer must clear the turnTimer pointer; got %v", tt)
	}
}
