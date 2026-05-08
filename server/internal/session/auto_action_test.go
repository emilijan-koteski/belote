package session_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/emilijan/beljot/server/internal/game"
	"github.com/emilijan/beljot/server/internal/session"
	"github.com/emilijan/beljot/server/internal/ws"
)

// TestAutoActionTypeFor locks the wire-format mapping that drives
// EventAutoAction. ActionPlayCard intentionally returns ok=false because
// card auto-play is signalled via the AutoPlayed flag on EventCardPlayed.
func TestAutoActionTypeFor(t *testing.T) {
	cases := []struct {
		name       string
		actionType string
		wantType   ws.AutoActionType
		wantOK     bool
	}{
		{"pass_trump emits auto-action", game.ActionPassTrump, ws.AutoActionPassTrump, true},
		{"skip_declare emits auto-action", game.ActionSkipDeclare, ws.AutoActionSkipDeclare, true},
		{"skip_belot emits auto-action", game.ActionSkipBelot, ws.AutoActionSkipBelot, true},
		{"play_card uses autoPlayed flag, not auto-action", game.ActionPlayCard, "", false},
		{"announce_belot is not a timeout action", game.ActionAnnounceBelot, "", false},
		{"declare is not a timeout action", game.ActionDeclare, "", false},
		{"pick_trump is not a timeout action", game.ActionPickTrump, "", false},
		{"empty action", "", "", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := session.AutoActionTypeFor(tc.actionType)
			assert.Equal(t, tc.wantOK, ok)
			assert.Equal(t, tc.wantType, got)
		})
	}
}

// TestPerMoveTimer_BiddingPhaseAutoPasses confirms the auto-pass path runs
// end-to-end: a bidding-phase timer expiry advances the active seat without
// panicking and without leaving the session stuck. The wire-format payload
// itself is locked by TestAutoActionTypeFor; this test guards against silent
// regression where the new EventAutoAction broadcast path corrupts state.
func TestPerMoveTimer_BiddingPhaseAutoPasses(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Shutdown()

	repo := newMockMatchRepo()
	mgr := session.NewManager(hub, repo)

	// 1-second timer so it expires quickly
	require.NoError(t, mgr.StartGame(100, "bitola", "1001", defaultPlayers(), "per-move", 1, 10, 120))

	state := mgr.GetStateSnapshot(100)
	require.NotNil(t, state)
	require.Equal(t, game.PhaseBidding, state.Phase)
	firstBidder := state.ActivePlayerSeat

	// Wait through one bidding timeout — server auto-passes for the active bidder.
	// Sleep a little longer than the timer to ensure the callback fires and the
	// follow-up broadcast settles before snapshotting.
	time.Sleep(1500 * time.Millisecond)

	after := mgr.GetStateSnapshot(100)
	require.NotNil(t, after, "session must survive the bidding timeout broadcast path")
	assert.NotEqual(t, firstBidder, after.ActivePlayerSeat, "auto-pass should advance the active seat")
}

// TestPerMoveTimer_PickTrumpJSONShapeUnchanged is a regression guard: the new
// EventAutoAction wire-format must be parseable as JSON. We construct a
// payload directly and round-trip it to catch any future struct-tag drift.
func TestPerMoveTimer_PickTrumpJSONShapeUnchanged(t *testing.T) {
	payload := ws.AutoActionPayload{PlayerSeat: 2, Type: ws.AutoActionPassTrump}
	b, err := json.Marshal(payload)
	require.NoError(t, err)
	assert.JSONEq(t, `{"playerSeat":2,"type":"pass_trump"}`, string(b))
}
