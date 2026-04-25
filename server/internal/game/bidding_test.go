package game_test

import (
	"testing"

	"github.com/emilijan/belote/server/internal/apperr"
	"github.com/emilijan/belote/server/internal/game"
	"github.com/emilijan/belote/server/internal/game/testfixtures"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPickTrumpRound1(t *testing.T) {
	tests := []struct {
		name          string
		passCount     int
		activeSeat    int
		expectedTrump game.Suit
	}{
		{
			name:          "first bidder picks immediately",
			passCount:     0,
			activeSeat:    1,
			expectedTrump: game.SuitHearts, // trump candidate is 7H
		},
		{
			name:          "second bidder picks after 1 pass",
			passCount:     1,
			activeSeat:    2,
			expectedTrump: game.SuitHearts,
		},
		{
			name:          "third bidder picks after 2 passes",
			passCount:     2,
			activeSeat:    3,
			expectedTrump: game.SuitHearts,
		},
		{
			name:          "fourth bidder picks after 3 passes",
			passCount:     3,
			activeSeat:    0,
			expectedTrump: game.SuitHearts,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gs := testfixtures.NewGameMidBidding(tc.passCount)
			action := game.Action{
				Type:       game.ActionPickTrump,
				PlayerSeat: tc.activeSeat,
			}

			result, err := game.ApplyAction(gs, action)

			require.NoError(t, err)
			require.NotNil(t, result)
			assert.Equal(t, game.PhasePlaying, result.Phase)
			require.NotNil(t, result.TrumpSuit)
			assert.Equal(t, tc.expectedTrump, *result.TrumpSuit)
			require.NotNil(t, result.TrumpCallerSeat)
			assert.Equal(t, tc.activeSeat, *result.TrumpCallerSeat)
			assert.Equal(t, 1, result.ActivePlayerSeat) // (DealerSeat+1)%4 = 1
			assert.Equal(t, 1, result.TrickNumber)
			assert.Empty(t, result.CurrentTrick)
		})
	}
}

func TestPassTrumpSequence(t *testing.T) {
	tests := []struct {
		name               string
		passCount          int
		activeSeat         int
		expectedPassCount  int
		expectedActiveSeat int
		expectedRound      int
	}{
		{
			name:               "first pass in round 1",
			passCount:          0,
			activeSeat:         1,
			expectedPassCount:  1,
			expectedActiveSeat: 2,
			expectedRound:      1,
		},
		{
			name:               "second pass in round 1",
			passCount:          1,
			activeSeat:         2,
			expectedPassCount:  2,
			expectedActiveSeat: 3,
			expectedRound:      1,
		},
		{
			name:               "third pass in round 1",
			passCount:          2,
			activeSeat:         3,
			expectedPassCount:  3,
			expectedActiveSeat: 0,
			expectedRound:      1,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gs := testfixtures.NewGameMidBidding(tc.passCount)
			action := game.Action{
				Type:       game.ActionPassTrump,
				PlayerSeat: tc.activeSeat,
			}

			result, err := game.ApplyAction(gs, action)

			require.NoError(t, err)
			require.NotNil(t, result)
			assert.Equal(t, game.PhaseBidding, result.Phase)
			assert.Equal(t, tc.expectedPassCount, result.BiddingPassCount)
			assert.Equal(t, tc.expectedActiveSeat, result.ActivePlayerSeat)
			assert.Equal(t, tc.expectedRound, result.BiddingRound)
			assert.Nil(t, result.TrumpSuit, "trump should not be set during passing")
		})
	}
}

func TestRound1ToRound2Transition(t *testing.T) {
	// 3 passes already applied, 4th pass triggers round 2
	gs := testfixtures.NewGameMidBidding(3)
	action := game.Action{
		Type:       game.ActionPassTrump,
		PlayerSeat: 0, // seat 0 is the active bidder after 3 passes
	}

	result, err := game.ApplyAction(gs, action)

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, game.PhaseBidding, result.Phase)
	assert.Equal(t, 2, result.BiddingRound, "should transition to round 2")
	assert.Equal(t, 0, result.BiddingPassCount, "pass count resets in round 2")
	assert.Equal(t, 1, result.ActivePlayerSeat, "bidding restarts from (DealerSeat+1)%4")
	assert.Nil(t, result.TrumpSuit, "trump should not be set")
}

func TestPickTrumpRound2(t *testing.T) {
	tests := []struct {
		name          string
		passCount     int
		activeSeat    int
		chosenSuit    game.Suit
		expectedTrump game.Suit
	}{
		{
			name:          "pick spades in round 2",
			passCount:     4,
			activeSeat:    1,
			chosenSuit:    game.SuitSpades,
			expectedTrump: game.SuitSpades,
		},
		{
			name:          "pick diamonds in round 2 after 1 pass",
			passCount:     5,
			activeSeat:    2,
			chosenSuit:    game.SuitDiamonds,
			expectedTrump: game.SuitDiamonds,
		},
		{
			name:          "pick clubs in round 2 after 2 passes",
			passCount:     6,
			activeSeat:    3,
			chosenSuit:    game.SuitClubs,
			expectedTrump: game.SuitClubs,
		},
		{
			name:          "pick hearts (same as candidate) in round 2",
			passCount:     4,
			activeSeat:    1,
			chosenSuit:    game.SuitHearts,
			expectedTrump: game.SuitHearts,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gs := testfixtures.NewGameMidBidding(tc.passCount)
			suit := tc.chosenSuit
			action := game.Action{
				Type:       game.ActionPickTrump,
				PlayerSeat: tc.activeSeat,
				Suit:       &suit,
			}

			result, err := game.ApplyAction(gs, action)

			require.NoError(t, err)
			require.NotNil(t, result)
			assert.Equal(t, game.PhasePlaying, result.Phase)
			require.NotNil(t, result.TrumpSuit)
			assert.Equal(t, tc.expectedTrump, *result.TrumpSuit)
			require.NotNil(t, result.TrumpCallerSeat)
			assert.Equal(t, tc.activeSeat, *result.TrumpCallerSeat)
			assert.Equal(t, 1, result.ActivePlayerSeat)
			assert.Equal(t, 1, result.TrickNumber)
			assert.Empty(t, result.CurrentTrick)
		})
	}
}

func TestRound2PickWithoutSuit(t *testing.T) {
	gs := testfixtures.NewGameMidBidding(4) // round 2
	action := game.Action{
		Type:       game.ActionPickTrump,
		PlayerSeat: 1, // active bidder
		// Suit is nil — should fail
	}

	result, err := game.ApplyAction(gs, action)

	assert.Nil(t, result)
	require.Error(t, err)
	assert.ErrorIs(t, err, apperr.ErrInvalidBid)
}

func TestRound2FullPassReshuffle(t *testing.T) {
	// 7 passes applied (round 2 with 3 passes), 8th pass triggers reshuffle
	gs := testfixtures.NewGameMidBidding(7)
	action := game.Action{
		Type:       game.ActionPassTrump,
		PlayerSeat: 0, // seat 0 is active after 7 passes
	}

	result, err := game.ApplyAction(gs, action)

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, game.PhaseDealing, result.Phase, "reshuffle transitions to dealing phase")
	assert.Equal(t, 1, result.BiddingRound, "round resets to 1 after reshuffle")
	assert.Equal(t, 0, result.BiddingPassCount, "pass count resets after reshuffle")
	assert.Equal(t, 1, result.DealerSeat, "dealer rotates from 0 to 1")
	assert.Equal(t, 2, result.ActivePlayerSeat, "(new dealer + 1) % 4 = 2")
	assert.Nil(t, result.TrumpSuit, "trump should be nil after reshuffle")
	assert.Nil(t, result.TrumpCallerSeat, "caller should be nil after reshuffle")
	require.NotNil(t, result.TrumpCandidate, "new trump candidate should be revealed")
	assert.Equal(t, 1, result.HandNumber, "hand number unchanged during reshuffle")

	// Stage-1 sizes after re-deal.
	for i, p := range result.Players {
		assert.Len(t, p.Hand, 5, "seat %d should have 5 cards after stage-1 re-deal", i)
	}
	assert.Len(t, result.Deck, 11, "Deck should hold 11 cards after re-deal")

	// Card conservation: same 32 cards across hands + Deck + candidate, with
	// no duplicates anywhere. Use the shared collectCards helper.
	assertCardsAreFullDeck(t, collectCards(result))
}

// assertCardsAreFullDeck validates that the given slice contains every Bitola
// card exactly once. Used to enforce card-conservation across stage-1, stage-2,
// and reshuffle.
func assertCardsAreFullDeck(t *testing.T, cards []game.Card) {
	t.Helper()
	require.Len(t, cards, 32, "expected exactly 32 cards across all locations")
	seen := make(map[string]bool, 32)
	for _, c := range cards {
		id := c.String()
		assert.False(t, seen[id], "duplicate card: %s", id)
		seen[id] = true
	}
	assert.Len(t, seen, 32, "all 32 cards must be unique")
}

func TestErrNotYourTurn(t *testing.T) {
	tests := []struct {
		name       string
		actionType string
		wrongSeat  int
	}{
		{
			name:       "pick_trump from wrong player",
			actionType: game.ActionPickTrump,
			wrongSeat:  0, // active bidder is seat 1
		},
		{
			name:       "pass_trump from wrong player",
			actionType: game.ActionPassTrump,
			wrongSeat:  2,
		},
		{
			name:       "pick_trump from seat 3",
			actionType: game.ActionPickTrump,
			wrongSeat:  3,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gs := testfixtures.NewGameJustDealt()
			action := game.Action{
				Type:       tc.actionType,
				PlayerSeat: tc.wrongSeat,
			}

			result, err := game.ApplyAction(gs, action)

			assert.Nil(t, result)
			require.Error(t, err)
			assert.ErrorIs(t, err, apperr.ErrNotYourTurn)
		})
	}
}

func TestErrWrongPhase(t *testing.T) {
	tests := []struct {
		name       string
		phase      game.Phase
		actionType string
	}{
		{
			name:       "pick_trump in playing phase",
			phase:      game.PhasePlaying,
			actionType: game.ActionPickTrump,
		},
		{
			name:       "pass_trump in playing phase",
			phase:      game.PhasePlaying,
			actionType: game.ActionPassTrump,
		},
		{
			name:       "pick_trump in match_end phase",
			phase:      game.PhaseMatchEnd,
			actionType: game.ActionPickTrump,
		},
		{
			name:       "play_card in bidding phase",
			phase:      game.PhaseBidding,
			actionType: game.ActionPlayCard,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gs := testfixtures.NewGameJustDealt()
			gs.Phase = tc.phase
			action := game.Action{
				Type:       tc.actionType,
				PlayerSeat: gs.ActivePlayerSeat,
			}

			result, err := game.ApplyAction(gs, action)

			assert.Nil(t, result)
			require.Error(t, err)
			assert.ErrorIs(t, err, apperr.ErrWrongPhase)
		})
	}
}

func TestStateImmutability(t *testing.T) {
	tests := []struct {
		name   string
		action game.Action
	}{
		{
			name: "pass_trump does not mutate original",
			action: game.Action{
				Type:       game.ActionPassTrump,
				PlayerSeat: 1,
			},
		},
		{
			name: "pick_trump does not mutate original",
			action: game.Action{
				Type:       game.ActionPickTrump,
				PlayerSeat: 1,
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gs := testfixtures.NewGameJustDealt()

			// Snapshot original values
			origPhase := gs.Phase
			origPassCount := gs.BiddingPassCount
			origRound := gs.BiddingRound
			origActive := gs.ActivePlayerSeat
			origDealer := gs.DealerSeat
			origHand0 := make([]game.Card, len(gs.Players[0].Hand))
			copy(origHand0, gs.Players[0].Hand)

			_, _ = game.ApplyAction(gs, tc.action)

			// Verify original state is unchanged
			assert.Equal(t, origPhase, gs.Phase, "Phase should not be mutated")
			assert.Equal(t, origPassCount, gs.BiddingPassCount, "BiddingPassCount should not be mutated")
			assert.Equal(t, origRound, gs.BiddingRound, "BiddingRound should not be mutated")
			assert.Equal(t, origActive, gs.ActivePlayerSeat, "ActivePlayerSeat should not be mutated")
			assert.Equal(t, origDealer, gs.DealerSeat, "DealerSeat should not be mutated")
			assert.Equal(t, origHand0, gs.Players[0].Hand, "Player hands should not be mutated")
		})
	}
}

func TestMultipleReshuffles(t *testing.T) {
	// Start from a fresh game and apply 8 passes to trigger first reshuffle
	gs := testfixtures.NewGameJustDealt()

	// Apply 8 passes (full round 1 + full round 2) to trigger reshuffle
	for i := 0; i < 8; i++ {
		action := game.Action{
			Type:       game.ActionPassTrump,
			PlayerSeat: gs.ActivePlayerSeat,
		}
		var err error
		gs, err = game.ApplyAction(gs, action)
		require.NoError(t, err, "pass %d should succeed", i+1)
	}

	// After first reshuffle: dealer should be 1, phase is dealing
	assert.Equal(t, game.PhaseDealing, gs.Phase, "reshuffle sets dealing phase")
	assert.Equal(t, 1, gs.DealerSeat, "dealer should rotate to seat 1 after first reshuffle")
	assert.Equal(t, 2, gs.ActivePlayerSeat, "active should be (1+1)%4=2")
	assert.Equal(t, 1, gs.BiddingRound, "round should reset to 1")
	assert.Equal(t, 0, gs.BiddingPassCount, "pass count should reset to 0")

	// Simulate session manager auto-transition to bidding
	gs.Phase = game.PhaseBidding

	// Apply 8 more passes to trigger second reshuffle
	for i := 0; i < 8; i++ {
		action := game.Action{
			Type:       game.ActionPassTrump,
			PlayerSeat: gs.ActivePlayerSeat,
		}
		var err error
		gs, err = game.ApplyAction(gs, action)
		require.NoError(t, err, "pass %d (second round) should succeed", i+1)
	}

	// After second reshuffle: dealer should be 2
	assert.Equal(t, 2, gs.DealerSeat, "dealer should rotate to seat 2 after second reshuffle")
	assert.Equal(t, 3, gs.ActivePlayerSeat, "active should be (2+1)%4=3")
	assert.Equal(t, 1, gs.BiddingRound)
	assert.Equal(t, 0, gs.BiddingPassCount)

	// Verify card integrity after multiple reshuffles: 5 per hand + 11 in Deck + 1 candidate.
	seen := make(map[string]bool)
	for _, p := range gs.Players {
		assert.Len(t, p.Hand, 5)
		for _, card := range p.Hand {
			id := card.String()
			assert.False(t, seen[id], "duplicate card: %s", id)
			seen[id] = true
		}
	}
	assert.Len(t, gs.Deck, 11)
	for _, card := range gs.Deck {
		id := card.String()
		assert.False(t, seen[id], "duplicate card in deck: %s", id)
		seen[id] = true
	}
	require.NotNil(t, gs.TrumpCandidate)
	seen[gs.TrumpCandidate.String()] = true
	assert.Len(t, seen, 32)
}

// TestPickTrumpStage2Rotation verifies the real-table card distribution rule:
// the dealer rotates from (Dealer+1)%4 around the table dealing 3 to each
// non-picker seat, 2 to the picker in their natural slot; the public
// candidate is then appended to the picker's hand. Card-conservation:
// every starting card is accounted for exactly once after the deal.
func TestPickTrumpStage2Rotation(t *testing.T) {
	tests := []struct {
		name       string
		passCount  int
		picker     int
		round2Suit *game.Suit
	}{
		{name: "round 1, picker = seat 1 (first bidder)", passCount: 0, picker: 1},
		{name: "round 1, picker = seat 2", passCount: 1, picker: 2},
		{name: "round 1, picker = seat 3", passCount: 2, picker: 3},
		{name: "round 1, picker = seat 0 (last bidder)", passCount: 3, picker: 0},
		{name: "round 2, picker = seat 1, suit = spades", passCount: 4, picker: 1, round2Suit: suitPtr(game.SuitSpades)},
		{name: "round 2, picker = seat 0, suit = clubs", passCount: 7, picker: 0, round2Suit: suitPtr(game.SuitClubs)},
		// Round-2 same-suit-as-candidate edge case: candidate is AH, picker
		// chooses Hearts in round 2. Trump should still resolve to Hearts and
		// distribution should match the round-1 layout for this picker seat.
		{name: "round 2, picker = seat 1, suit = hearts (same as candidate)", passCount: 4, picker: 1, round2Suit: suitPtr(game.SuitHearts)},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gs := testfixtures.NewGameMidBidding(tc.passCount)

			// Snapshot the starting card layout so we can verify conservation.
			startingCards := collectCards(gs)

			action := game.Action{
				Type:       game.ActionPickTrump,
				PlayerSeat: tc.picker,
				Suit:       tc.round2Suit,
			}

			result, err := game.ApplyAction(gs, action)
			require.NoError(t, err)
			require.NotNil(t, result)

			// After stage-2 distribution: each hand has 8 cards, Deck empty, candidate cleared.
			for i, p := range result.Players {
				assert.Len(t, p.Hand, 8, "seat %d should have 8 cards after stage-2", i)
			}
			assert.Empty(t, result.Deck, "Deck should be cleared after stage-2")
			assert.Nil(t, result.TrumpCandidate, "TrumpCandidate should be cleared after stage-2")

			// Card conservation: same 32 cards across all hands now.
			finalCards := collectCards(result)
			assert.ElementsMatch(t, startingCards, finalCards, "all 32 cards preserved through stage-2")

			// Trump locked correctly.
			require.NotNil(t, result.TrumpSuit)
			if tc.round2Suit != nil {
				assert.Equal(t, *tc.round2Suit, *result.TrumpSuit, "round 2 trump matches action.Suit")
			} else {
				assert.Equal(t, game.SuitHearts, *result.TrumpSuit, "round 1 trump = candidate suit (hearts)")
			}
		})
	}
}

// TestPickTrumpRound1_AppendsCandidateAndDealsCorrectCards spot-checks the
// canonical round-1 first-bidder rotation against the deterministic fixture
// layout, so a regression in the slice math is caught at the card level.
func TestPickTrumpRound1_AppendsCandidateAndDealsCorrectCards(t *testing.T) {
	gs := testfixtures.NewGameJustDealt()
	candidate := *gs.TrumpCandidate // AH
	expectedSeat1Adds := []game.Card{gs.Deck[0], gs.Deck[1], candidate}
	expectedSeat2Adds := []game.Card{gs.Deck[2], gs.Deck[3], gs.Deck[4]}
	expectedSeat3Adds := []game.Card{gs.Deck[5], gs.Deck[6], gs.Deck[7]}
	expectedSeat0Adds := []game.Card{gs.Deck[8], gs.Deck[9], gs.Deck[10]}

	result, err := game.ApplyAction(gs, game.Action{Type: game.ActionPickTrump, PlayerSeat: 1})
	require.NoError(t, err)

	// Each seat's final hand should be (their initial 5) ++ (the cards above).
	assert.Equal(t, append(append([]game.Card{}, gs.Players[1].Hand...), expectedSeat1Adds...), result.Players[1].Hand,
		"seat 1 (picker) gets Deck[0:2] + candidate after their initial 5")
	assert.Equal(t, append(append([]game.Card{}, gs.Players[2].Hand...), expectedSeat2Adds...), result.Players[2].Hand,
		"seat 2 gets Deck[2:5] after their initial 5")
	assert.Equal(t, append(append([]game.Card{}, gs.Players[3].Hand...), expectedSeat3Adds...), result.Players[3].Hand,
		"seat 3 gets Deck[5:8] after their initial 5")
	assert.Equal(t, append(append([]game.Card{}, gs.Players[0].Hand...), expectedSeat0Adds...), result.Players[0].Hand,
		"seat 0 gets Deck[8:11] after their initial 5")
}

// suitPtr is a one-line helper to take the address of a Suit literal.
func suitPtr(s game.Suit) *game.Suit { return &s }

// collectCards returns every card present anywhere in the game state:
// hands, deck, and the visible trump candidate.
func collectCards(gs *game.GameState) []game.Card {
	out := make([]game.Card, 0, 32)
	for i := range gs.Players {
		out = append(out, gs.Players[i].Hand...)
	}
	out = append(out, gs.Deck...)
	if gs.TrumpCandidate != nil {
		out = append(out, *gs.TrumpCandidate)
	}
	return out
}

func TestRound1IgnoresActionSuit(t *testing.T) {
	// In round 1, Action.Suit should be ignored — trump is always the candidate's suit
	gs := testfixtures.NewGameJustDealt()
	spades := game.SuitSpades
	action := game.Action{
		Type:       game.ActionPickTrump,
		PlayerSeat: 1,
		Suit:       &spades, // attempt to pick spades, but candidate is hearts
	}

	result, err := game.ApplyAction(gs, action)

	require.NoError(t, err)
	require.NotNil(t, result.TrumpSuit)
	assert.Equal(t, game.SuitHearts, *result.TrumpSuit, "round 1 should use candidate suit, not action.Suit")
}
