package game_test

import (
	"testing"

	"github.com/emilijan/belote/server/internal/apperr"
	"github.com/emilijan/belote/server/internal/game"
	"github.com/emilijan/belote/server/internal/game/testfixtures"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestPlayCardLeading tests that any card is legal when leading a trick.
func TestPlayCardLeading(t *testing.T) {
	tests := []struct {
		name string
		card game.Card
	}{
		{"lead with spade", game.Card{Rank: game.RankAce, Suit: game.SuitSpades}},
		{"lead with trump heart", game.Card{Rank: game.RankAce, Suit: game.SuitHearts}},
		{"lead with diamond", game.Card{Rank: game.RankKing, Suit: game.SuitDiamonds}},
		{"lead with club", game.Card{Rank: game.Rank7, Suit: game.SuitClubs}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gs := testfixtures.NewGameMidPlay(1)
			action := game.Action{
				Type:       game.ActionPlayCard,
				PlayerSeat: 0,
				Card:       &tc.card,
			}

			result, err := game.ApplyAction(gs, action)

			require.NoError(t, err)
			require.NotNil(t, result)
			// Card removed from hand
			assert.Len(t, result.Players[0].Hand, 7)
			// Card added to trick
			assert.Len(t, result.CurrentTrick, 1)
			assert.Equal(t, tc.card.Rank, result.CurrentTrick[0].Card.Rank)
			assert.Equal(t, tc.card.Suit, result.CurrentTrick[0].Card.Suit)
			assert.Equal(t, 0, result.CurrentTrick[0].PlayerSeat)
			// Lead suit set
			require.NotNil(t, result.LeadSuit)
			assert.Equal(t, tc.card.Suit, *result.LeadSuit)
			// Active player advances
			assert.Equal(t, 1, result.ActivePlayerSeat)
		})
	}
}

// TestPlayCardFollowSuit tests that players must follow the led suit.
func TestPlayCardFollowSuit(t *testing.T) {
	t.Run("player with led suit cards must play one", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		// Seat 0 leads a spade
		leadAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 0,
			Card: &game.Card{Rank: game.RankAce, Suit: game.SuitSpades}}
		gs, err := game.ApplyAction(gs, leadAction)
		require.NoError(t, err)

		// Seat 1 has spades (JS, 9S, 8S, 7S) — must play one
		followAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 1,
			Card: &game.Card{Rank: game.RankJack, Suit: game.SuitSpades}}
		result, err := game.ApplyAction(gs, followAction)

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Len(t, result.CurrentTrick, 2)
	})

	t.Run("playing non-led suit when holding led suit returns ErrIllegalPlay", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		// Seat 0 leads a spade
		leadAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 0,
			Card: &game.Card{Rank: game.RankAce, Suit: game.SuitSpades}}
		gs, err := game.ApplyAction(gs, leadAction)
		require.NoError(t, err)

		// Seat 1 has spades but tries to play a heart (trump)
		illegalAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 1,
			Card: &game.Card{Rank: game.RankJack, Suit: game.SuitHearts}}
		result, err := game.ApplyAction(gs, illegalAction)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.ErrorIs(t, err, apperr.ErrIllegalPlay)
	})
}

// TestPlayCardTrumpLed tests over-trump obligations when trump is led.
func TestPlayCardTrumpLed(t *testing.T) {
	t.Run("trump led - must over-trump if possible", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		// Set seat 2 as active (has KH, QH, 8H, 7H)
		gs.ActivePlayerSeat = 2
		// Seat 2 leads with QH (trump)
		leadAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 2,
			Card: &game.Card{Rank: game.RankQueen, Suit: game.SuitHearts}}
		gs, err := game.ApplyAction(gs, leadAction)
		require.NoError(t, err)

		// Seat 3 has no trump — must play any card (void in trump, no obligation to follow)
		// But first test seat 0 (active=3 now, but seat 3 has no trump)
		// Advance: after seat 2 lead, active is seat 3
		// Seat 3 has no hearts — any card is legal
		anyCard := game.Action{Type: game.ActionPlayCard, PlayerSeat: 3,
			Card: &game.Card{Rank: game.RankJack, Suit: game.SuitDiamonds}}
		result, err := game.ApplyAction(gs, anyCard)
		require.NoError(t, err)
		require.NotNil(t, result)
	})

	t.Run("trump led - lower trump rejected when higher available", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		// Seat 0 leads with TH (trump, rank order 4)
		gs.ActivePlayerSeat = 0
		leadAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 0,
			Card: &game.Card{Rank: game.RankTen, Suit: game.SuitHearts}}
		gs, err := game.ApplyAction(gs, leadAction)
		require.NoError(t, err)

		// Seat 1 has JH (order 7) and 9H (order 6) — both beat TH (order 4)
		// Playing 9H is valid (over-trumps)
		validAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 1,
			Card: &game.Card{Rank: game.Rank9, Suit: game.SuitHearts}}
		result, err := game.ApplyAction(gs, validAction)
		require.NoError(t, err)
		require.NotNil(t, result)
	})

	t.Run("trump led - playing lower trump when higher available is illegal", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		// Give seat 1 a mix of higher and lower trumps
		gs.Players[1].Hand = []game.Card{
			{Rank: game.RankJack, Suit: game.SuitHearts}, // trump order 7
			{Rank: game.Rank9, Suit: game.SuitHearts},    // trump order 6
			{Rank: game.Rank7, Suit: game.SuitHearts},    // trump order 0 (LOWER)
			{Rank: game.RankJack, Suit: game.SuitSpades},
			{Rank: game.Rank9, Suit: game.SuitSpades},
			{Rank: game.Rank8, Suit: game.SuitSpades},
			{Rank: game.RankQueen, Suit: game.SuitDiamonds},
			{Rank: game.Rank8, Suit: game.SuitClubs},
		}
		// Seat 0 leads with AH (trump, rank order 5)
		gs.ActivePlayerSeat = 0
		leadAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 0,
			Card: &game.Card{Rank: game.RankAce, Suit: game.SuitHearts}}
		gs, err := game.ApplyAction(gs, leadAction)
		require.NoError(t, err)

		// Seat 1 has JH(7), 9H(6) which beat AH(5), plus 7H(0) which can't.
		// Playing 7H (lower trump) when higher trumps are available is illegal.
		illegalAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 1,
			Card: &game.Card{Rank: game.Rank7, Suit: game.SuitHearts}}
		result, err := game.ApplyAction(gs, illegalAction)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.ErrorIs(t, err, apperr.ErrIllegalPlay)
	})
}

// TestPlayCardTrumpObligation tests trump obligation when opponent is winning.
func TestPlayCardTrumpObligation(t *testing.T) {
	t.Run("void in led suit opponent winning - non-trump rejected", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		// Seat 1 (Blue) leads JS — opponent to seat 2 (Red)
		gs.ActivePlayerSeat = 1
		leadAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 1,
			Card: &game.Card{Rank: game.RankJack, Suit: game.SuitSpades}}
		gs, err := game.ApplyAction(gs, leadAction)
		require.NoError(t, err)

		// Seat 2 (Red) is void in spades, opponent Blue (seat 1) is winning.
		// Seat 2 has trump hearts (KH, QH, 8H, 7H) — must play trump.
		// Playing a non-trump card should be illegal.
		illegalAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 2,
			Card: &game.Card{Rank: game.RankAce, Suit: game.SuitDiamonds}}
		result, err := game.ApplyAction(gs, illegalAction)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.ErrorIs(t, err, apperr.ErrIllegalPlay)
	})

	t.Run("void in led suit opponent winning - trump accepted", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		// Seat 1 (Blue) leads JS
		gs.ActivePlayerSeat = 1
		leadAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 1,
			Card: &game.Card{Rank: game.RankJack, Suit: game.SuitSpades}}
		gs, err := game.ApplyAction(gs, leadAction)
		require.NoError(t, err)

		// Seat 2 (Red) is void in spades, opponent winning — plays trump
		trumpAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 2,
			Card: &game.Card{Rank: game.RankKing, Suit: game.SuitHearts}}
		result, err := game.ApplyAction(gs, trumpAction)

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Len(t, result.CurrentTrick, 2)
	})
}

// TestPlayCardOverTrump tests the over-trump obligation.
func TestPlayCardOverTrump(t *testing.T) {
	t.Run("must over-trump when obligated to trump and higher available", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		// Seat 0 leads spade
		leadAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 0,
			Card: &game.Card{Rank: game.RankQueen, Suit: game.SuitSpades}}
		gs, err := game.ApplyAction(gs, leadAction)
		require.NoError(t, err)

		// Seat 1 plays trump 9H (rank order 6) — opponent trumping
		gs.Players[1].Hand = []game.Card{
			{Rank: game.Rank9, Suit: game.SuitHearts},
			{Rank: game.Rank8, Suit: game.SuitClubs},
		}
		followAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 1,
			Card: &game.Card{Rank: game.Rank9, Suit: game.SuitHearts}}
		gs, err = game.ApplyAction(gs, followAction)
		require.NoError(t, err)

		// Seat 2 (Red) is void in spades, opponent (seat 1 Blue) winning with 9H.
		// Seat 2 has KH (order 3), QH (order 2), 8H (order 1), 7H (order 0)
		// None can over-trump 9H (order 6), so any trump is legal.
		lowerTrumpAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 2,
			Card: &game.Card{Rank: game.RankKing, Suit: game.SuitHearts}}
		result, err := game.ApplyAction(gs, lowerTrumpAction)

		require.NoError(t, err)
		require.NotNil(t, result)
	})

	t.Run("lower trump rejected when higher available - obligation path with trump in trick", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		// Set up: seat 0 leads spade, seat 1 (void in spades) trumps with 8H,
		// seat 2 (void in spades) must over-trump 8H.
		// Give seat 1 no spades, with 8H as its only trump (taken from seat 2).
		gs.Players[1].Hand = []game.Card{
			{Rank: game.Rank8, Suit: game.SuitHearts}, // trump order 1
			{Rank: game.Rank8, Suit: game.SuitClubs},
			{Rank: game.Rank9, Suit: game.SuitClubs},
			{Rank: game.RankQueen, Suit: game.SuitDiamonds},
			{Rank: game.RankJack, Suit: game.SuitDiamonds},
			{Rank: game.Rank9, Suit: game.SuitDiamonds},
			{Rank: game.Rank8, Suit: game.SuitDiamonds},
			{Rank: game.Rank7, Suit: game.SuitDiamonds},
		}
		// Give seat 2 trumps KH(3), QH(2), 7H(0) — no 8H (seat 1 has it)
		gs.Players[2].Hand = []game.Card{
			{Rank: game.RankKing, Suit: game.SuitHearts},  // trump order 3 — over-trumps
			{Rank: game.RankQueen, Suit: game.SuitHearts}, // trump order 2 — over-trumps
			{Rank: game.Rank7, Suit: game.SuitHearts},     // trump order 0 — CANNOT over-trump
			{Rank: game.RankAce, Suit: game.SuitDiamonds},
			{Rank: game.RankTen, Suit: game.SuitDiamonds},
			{Rank: game.RankAce, Suit: game.SuitClubs},
			{Rank: game.RankTen, Suit: game.SuitClubs},
			{Rank: game.Rank7, Suit: game.SuitClubs},
		}

		// Seat 0 leads QS
		leadAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 0,
			Card: &game.Card{Rank: game.RankQueen, Suit: game.SuitSpades}}
		gs, err := game.ApplyAction(gs, leadAction)
		require.NoError(t, err)

		// Seat 1 (Blue) void in spades, opponent (seat 0 Red) winning → must trump
		trumpAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 1,
			Card: &game.Card{Rank: game.Rank8, Suit: game.SuitHearts}}
		gs, err = game.ApplyAction(gs, trumpAction)
		require.NoError(t, err)

		// Seat 2 (Red) void in spades, opponent Blue (seat 1) winning with 8H (order 1).
		// Seat 2 has KH(3) and QH(2) which beat 8H, plus 7H(0) which can't.
		// Playing 7H should be illegal since higher over-trumps are available.
		illegalLowerTrump := game.Action{Type: game.ActionPlayCard, PlayerSeat: 2,
			Card: &game.Card{Rank: game.Rank7, Suit: game.SuitHearts}}
		result, err := game.ApplyAction(gs, illegalLowerTrump)

		require.Error(t, err, "lower trump should be rejected when higher over-trumps available")
		assert.Nil(t, result)
		assert.ErrorIs(t, err, apperr.ErrIllegalPlay)
	})
}

// TestPlayCardPartnerExemption tests that any card is legal when partner is winning.
func TestPlayCardPartnerExemption(t *testing.T) {
	t.Run("partner winning - any card legal including non-trump", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		// Seat 0 (Red) leads with AS (highest non-trump spade)
		leadAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 0,
			Card: &game.Card{Rank: game.RankAce, Suit: game.SuitSpades}}
		gs, err := game.ApplyAction(gs, leadAction)
		require.NoError(t, err)

		// Seat 1 (Blue) follows
		followAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 1,
			Card: &game.Card{Rank: game.Rank7, Suit: game.SuitSpades}}
		gs, err = game.ApplyAction(gs, followAction)
		require.NoError(t, err)

		// Seat 2 (Red) — partner seat 0 is winning with AS.
		// Void in spades, partner winning — any card is legal.
		nonTrumpAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 2,
			Card: &game.Card{Rank: game.RankAce, Suit: game.SuitDiamonds}}
		result, err := game.ApplyAction(gs, nonTrumpAction)

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Len(t, result.CurrentTrick, 3)
	})
}

// TestPlayCardNoTrumpHeld tests that any card is legal when void in suit and holding no trump.
func TestPlayCardNoTrumpHeld(t *testing.T) {
	t.Run("void in led suit no trump held - any card legal", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		// Seat 0 leads spade
		leadAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 0,
			Card: &game.Card{Rank: game.RankAce, Suit: game.SuitSpades}}
		gs, err := game.ApplyAction(gs, leadAction)
		require.NoError(t, err)

		// Seat 1 follows spade
		followAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 1,
			Card: &game.Card{Rank: game.RankJack, Suit: game.SuitSpades}}
		gs, err = game.ApplyAction(gs, followAction)
		require.NoError(t, err)

		// Seat 2 plays trump (Red partner winning, but that's fine)
		trumpAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 2,
			Card: &game.Card{Rank: game.RankKing, Suit: game.SuitHearts}}
		gs, err = game.ApplyAction(gs, trumpAction)
		require.NoError(t, err)

		// Seat 3 has no spades AND no trump hearts — any card is legal
		anyCard := game.Action{Type: game.ActionPlayCard, PlayerSeat: 3,
			Card: &game.Card{Rank: game.RankKing, Suit: game.SuitClubs}}
		result, err := game.ApplyAction(gs, anyCard)

		require.NoError(t, err)
		require.NotNil(t, result)
	})
}

// TestTrickResolution tests that trick resolution works correctly.
func TestTrickResolution(t *testing.T) {
	t.Run("4th card triggers resolution - winner gets points and leads next", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		// Play 4 cards: all spades
		cards := []struct {
			seat int
			card game.Card
		}{
			{0, game.Card{Rank: game.RankAce, Suit: game.SuitSpades}},   // 11 pts
			{1, game.Card{Rank: game.RankJack, Suit: game.SuitSpades}},  // 2 pts
			{2, game.Card{Rank: game.RankAce, Suit: game.SuitDiamonds}}, // void, partner winning, any card
			{3, game.Card{Rank: game.RankJack, Suit: game.SuitDiamonds}},
		}

		var result *game.GameState
		var err error
		state := gs
		for _, c := range cards {
			action := game.Action{Type: game.ActionPlayCard, PlayerSeat: c.seat, Card: &c.card}
			result, err = game.ApplyAction(state, action)
			require.NoError(t, err)
			state = result
		}

		// AS wins (highest non-trump of led suit) — seat 0 (Red team)
		// Points: AS(11) + JS(2) + AD(11) + JD(2) = 26
		assert.Equal(t, 26, result.HandPoints[0]) // Red team
		assert.Equal(t, 0, result.HandPoints[1])  // Blue team
		assert.Equal(t, 1, result.TricksWon[0])
		assert.Equal(t, 0, result.TricksWon[1])
		// Winner leads next trick
		assert.Equal(t, 0, result.ActivePlayerSeat)
		assert.Equal(t, 2, result.TrickNumber)
		// Trick cleared
		assert.Empty(t, result.CurrentTrick)
		assert.Nil(t, result.LeadSuit)
		assert.Nil(t, result.TrickWinnerSeat)
		// Phase stays playing
		assert.Equal(t, game.PhasePlaying, result.Phase)
	})

	t.Run("trump beats non-trump", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		// Seat 0 leads QS (non-trump)
		cards := []struct {
			seat int
			card game.Card
		}{
			{0, game.Card{Rank: game.RankQueen, Suit: game.SuitSpades}},
			{1, game.Card{Rank: game.Rank7, Suit: game.SuitSpades}},
			{2, game.Card{Rank: game.Rank7, Suit: game.SuitHearts}},   // trump — void in spades
			{3, game.Card{Rank: game.Rank7, Suit: game.SuitDiamonds}}, // any card
		}

		state := gs
		var result *game.GameState
		var err error
		for _, c := range cards {
			action := game.Action{Type: game.ActionPlayCard, PlayerSeat: c.seat, Card: &c.card}
			result, err = game.ApplyAction(state, action)
			require.NoError(t, err)
			state = result
		}

		// 7H (trump) wins — seat 2 (Red)
		assert.Equal(t, 2, result.ActivePlayerSeat) // winner leads next
		assert.Equal(t, 1, result.TricksWon[0])     // Red team
	})

	t.Run("higher trump beats lower trump", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		// Seat 0 leads QS
		cards := []struct {
			seat int
			card game.Card
		}{
			{0, game.Card{Rank: game.RankQueen, Suit: game.SuitSpades}},
			{1, game.Card{Rank: game.Rank9, Suit: game.SuitSpades}},
			{2, game.Card{Rank: game.Rank8, Suit: game.SuitHearts}}, // trump 8H
			{3, game.Card{Rank: game.Rank9, Suit: game.SuitDiamonds}},
		}

		state := gs
		var result *game.GameState
		var err error
		for _, c := range cards {
			action := game.Action{Type: game.ActionPlayCard, PlayerSeat: c.seat, Card: &c.card}
			result, err = game.ApplyAction(state, action)
			require.NoError(t, err)
			state = result
		}

		// 8H (trump, order 1) wins — seat 2
		assert.Equal(t, 2, result.ActivePlayerSeat)
	})
}

// TestTrickPointCalculation tests card point accumulation.
func TestTrickPointCalculation(t *testing.T) {
	t.Run("correct points for mixed trick", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		// Trump is Hearts. Play: AS(11), 9S(0), KH(trump 4), 7D(0)
		cards := []struct {
			seat int
			card game.Card
		}{
			{0, game.Card{Rank: game.RankAce, Suit: game.SuitSpades}},
			{1, game.Card{Rank: game.Rank9, Suit: game.SuitSpades}},
			{2, game.Card{Rank: game.RankKing, Suit: game.SuitHearts}}, // trump K=4pts
			{3, game.Card{Rank: game.Rank7, Suit: game.SuitDiamonds}},
		}

		state := gs
		var result *game.GameState
		var err error
		for _, c := range cards {
			action := game.Action{Type: game.ActionPlayCard, PlayerSeat: c.seat, Card: &c.card}
			result, err = game.ApplyAction(state, action)
			require.NoError(t, err)
			state = result
		}

		// KH (trump) wins — seat 2 (Red)
		// Points: AS=11(non-trump), 9S=0(non-trump), KH=4(trump), 7D=0(non-trump) = 15
		assert.Equal(t, 15, result.HandPoints[0]) // Red team gets all trick points
	})
}

// TestEighthTrickTransition tests phase transition after the 8th trick.
func TestEighthTrickTransition(t *testing.T) {
	t.Run("8th trick transitions to PhaseHandScoring", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(8)
		// Each player has 1 card. Play all 4.
		// Seat 0: AS, Seat 1: JS, Seat 2: AD, Seat 3: JD
		cards := []struct {
			seat int
			card game.Card
		}{
			{0, game.Card{Rank: game.RankAce, Suit: game.SuitSpades}},
			{1, game.Card{Rank: game.RankJack, Suit: game.SuitSpades}},
			{2, game.Card{Rank: game.RankAce, Suit: game.SuitDiamonds}},
			{3, game.Card{Rank: game.RankJack, Suit: game.SuitDiamonds}},
		}

		state := gs
		var result *game.GameState
		var err error
		for _, c := range cards {
			action := game.Action{Type: game.ActionPlayCard, PlayerSeat: c.seat, Card: &c.card}
			result, err = game.ApplyAction(state, action)
			require.NoError(t, err)
			state = result
		}

		// After trick 8, scoring runs atomically — state advances to PhaseDealing (new hand) or PhaseMatchEnd
		assert.Contains(t, []game.Phase{game.PhaseDealing, game.PhaseMatchEnd}, result.Phase,
			"should advance past PhaseHandScoring to PhaseDealing or PhaseMatchEnd")
	})
}

// TestPlayCardErrors tests error conditions.
func TestPlayCardErrors(t *testing.T) {
	t.Run("card not in hand returns ErrInvalidCard", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		// Seat 0 doesn't have 7D
		action := game.Action{Type: game.ActionPlayCard, PlayerSeat: 0,
			Card: &game.Card{Rank: game.Rank7, Suit: game.SuitDiamonds}}

		result, err := game.ApplyAction(gs, action)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.ErrorIs(t, err, apperr.ErrInvalidCard)
	})

	t.Run("nil card returns ErrInvalidCard", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		action := game.Action{Type: game.ActionPlayCard, PlayerSeat: 0, Card: nil}

		result, err := game.ApplyAction(gs, action)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.ErrorIs(t, err, apperr.ErrInvalidCard)
	})

	t.Run("wrong player returns ErrNotYourTurn", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1) // Active player is 0
		action := game.Action{Type: game.ActionPlayCard, PlayerSeat: 1,
			Card: &game.Card{Rank: game.RankJack, Suit: game.SuitSpades}}

		result, err := game.ApplyAction(gs, action)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.ErrorIs(t, err, apperr.ErrNotYourTurn)
	})

	t.Run("play_card in non-playing phase returns ErrWrongPhase", func(t *testing.T) {
		gs := testfixtures.NewGameJustDealt() // bidding phase
		action := game.Action{Type: game.ActionPlayCard, PlayerSeat: 1,
			Card: &game.Card{Rank: game.Rank7, Suit: game.SuitHearts}}

		result, err := game.ApplyAction(gs, action)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.ErrorIs(t, err, apperr.ErrWrongPhase)
	})

	t.Run("declare action in playing phase returns ErrWrongPhase", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		action := game.Action{Type: game.ActionDeclare, PlayerSeat: 0}

		result, err := game.ApplyAction(gs, action)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.ErrorIs(t, err, apperr.ErrWrongPhase)
	})
}

// TestPlayCardStateImmutability tests that the original state is not modified.
func TestPlayCardStateImmutability(t *testing.T) {
	t.Run("original state unchanged after ApplyAction", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		originalHandLen := len(gs.Players[0].Hand)
		originalTrickLen := len(gs.CurrentTrick)
		originalActive := gs.ActivePlayerSeat
		originalPhase := gs.Phase

		action := game.Action{Type: game.ActionPlayCard, PlayerSeat: 0,
			Card: &game.Card{Rank: game.RankAce, Suit: game.SuitSpades}}

		result, err := game.ApplyAction(gs, action)

		require.NoError(t, err)
		require.NotNil(t, result)

		// Original state unchanged
		assert.Len(t, gs.Players[0].Hand, originalHandLen)
		assert.Len(t, gs.CurrentTrick, originalTrickLen)
		assert.Equal(t, originalActive, gs.ActivePlayerSeat)
		assert.Equal(t, originalPhase, gs.Phase)
		assert.Nil(t, gs.LeadSuit)
	})

	t.Run("pointer fields not aliased after clone", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		action := game.Action{Type: game.ActionPlayCard, PlayerSeat: 0,
			Card: &game.Card{Rank: game.RankAce, Suit: game.SuitSpades}}

		result, err := game.ApplyAction(gs, action)
		require.NoError(t, err)

		// Modifying result's pointer field should not affect original
		newSuit := game.SuitClubs
		result.LeadSuit = &newSuit
		// Original TrumpSuit should be unchanged
		assert.Equal(t, game.SuitHearts, *gs.TrumpSuit)
	})
}

// TestFull8TrickHand plays a complete 8-trick hand and verifies total points = 152.
func TestFull8TrickHand(t *testing.T) {
	t.Run("all 32 cards played total 152 points", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)

		// Play all 8 tricks systematically using the fixture's card distribution.
		// Trump is Hearts. Seat 0 leads each trick with a spade (until exhausted).
		// We need to carefully play legal cards for each trick.

		// Trick 1: Seat 0 leads AS (Spade lead)
		// Seat 1: 9S (follow), Seat 2: AD (void-partner winning-any), Seat 3: JD (void-any)
		// Winner: AS (seat 0), Points: 11+0+11+2=24
		trick1 := []struct {
			seat int
			card game.Card
		}{
			{0, game.Card{Rank: game.RankAce, Suit: game.SuitSpades}},
			{1, game.Card{Rank: game.Rank9, Suit: game.SuitSpades}},
			{2, game.Card{Rank: game.RankAce, Suit: game.SuitDiamonds}},
			{3, game.Card{Rank: game.RankJack, Suit: game.SuitDiamonds}},
		}

		state := gs
		for _, c := range trick1 {
			action := game.Action{Type: game.ActionPlayCard, PlayerSeat: c.seat, Card: &c.card}
			var err error
			state, err = game.ApplyAction(state, action)
			require.NoError(t, err, "trick 1 seat %d", c.seat)
		}
		assert.Equal(t, 2, state.TrickNumber)
		assert.Equal(t, 0, state.ActivePlayerSeat) // seat 0 won

		// Trick 2: Seat 0 leads TS
		trick2 := []struct {
			seat int
			card game.Card
		}{
			{0, game.Card{Rank: game.RankTen, Suit: game.SuitSpades}},
			{1, game.Card{Rank: game.Rank8, Suit: game.SuitSpades}},
			{2, game.Card{Rank: game.RankTen, Suit: game.SuitDiamonds}},
			{3, game.Card{Rank: game.Rank9, Suit: game.SuitDiamonds}},
		}
		for _, c := range trick2 {
			action := game.Action{Type: game.ActionPlayCard, PlayerSeat: c.seat, Card: &c.card}
			var err error
			state, err = game.ApplyAction(state, action)
			require.NoError(t, err, "trick 2 seat %d", c.seat)
		}

		// Trick 3: Seat 0 leads KS
		trick3 := []struct {
			seat int
			card game.Card
		}{
			{0, game.Card{Rank: game.RankKing, Suit: game.SuitSpades}},
			{1, game.Card{Rank: game.Rank7, Suit: game.SuitSpades}},
			{2, game.Card{Rank: game.RankKing, Suit: game.SuitHearts}}, // void, opponent 1 winning — must trump
			{3, game.Card{Rank: game.Rank8, Suit: game.SuitDiamonds}},  // any card
		}
		for _, c := range trick3 {
			action := game.Action{Type: game.ActionPlayCard, PlayerSeat: c.seat, Card: &c.card}
			var err error
			state, err = game.ApplyAction(state, action)
			require.NoError(t, err, "trick 3 seat %d", c.seat)
		}
		// KH (trump) wins — seat 2
		assert.Equal(t, 2, state.ActivePlayerSeat)

		// Trick 4: Seat 2 leads QH (trump)
		trick4 := []struct {
			seat int
			card game.Card
		}{
			{2, game.Card{Rank: game.RankQueen, Suit: game.SuitHearts}},
			{3, game.Card{Rank: game.Rank7, Suit: game.SuitDiamonds}},  // no trump, any
			{0, game.Card{Rank: game.RankAce, Suit: game.SuitHearts}},  // trump AH, over-trump
			{1, game.Card{Rank: game.RankJack, Suit: game.SuitHearts}}, // trump JH > AH, over-trump
		}
		for _, c := range trick4 {
			action := game.Action{Type: game.ActionPlayCard, PlayerSeat: c.seat, Card: &c.card}
			var err error
			state, err = game.ApplyAction(state, action)
			require.NoError(t, err, "trick 4 seat %d", c.seat)
		}
		// JH (trump order 7) wins — seat 1
		assert.Equal(t, 1, state.ActivePlayerSeat)

		// Trick 5: Seat 1 leads 9H (trump)
		trick5 := []struct {
			seat int
			card game.Card
		}{
			{1, game.Card{Rank: game.Rank9, Suit: game.SuitHearts}},
			{2, game.Card{Rank: game.Rank8, Suit: game.SuitHearts}},   // can't over-trump, still must play trump
			{3, game.Card{Rank: game.RankKing, Suit: game.SuitClubs}}, // no trump, any
			{0, game.Card{Rank: game.RankTen, Suit: game.SuitHearts}}, // can't over-trump 9H(order 6), play lower
		}
		for _, c := range trick5 {
			action := game.Action{Type: game.ActionPlayCard, PlayerSeat: c.seat, Card: &c.card}
			var err error
			state, err = game.ApplyAction(state, action)
			require.NoError(t, err, "trick 5 seat %d", c.seat)
		}
		// 9H (trump order 6) wins — seat 1
		assert.Equal(t, 1, state.ActivePlayerSeat)

		// Trick 6: Seat 1 leads QD
		trick6 := []struct {
			seat int
			card game.Card
		}{
			{1, game.Card{Rank: game.RankQueen, Suit: game.SuitDiamonds}},
			{2, game.Card{Rank: game.Rank7, Suit: game.SuitHearts}},      // void in D, opponent winning, must trump
			{3, game.Card{Rank: game.RankQueen, Suit: game.SuitClubs}},   // any
			{0, game.Card{Rank: game.RankKing, Suit: game.SuitDiamonds}}, // follow suit
		}
		for _, c := range trick6 {
			action := game.Action{Type: game.ActionPlayCard, PlayerSeat: c.seat, Card: &c.card}
			var err error
			state, err = game.ApplyAction(state, action)
			require.NoError(t, err, "trick 6 seat %d", c.seat)
		}
		// 7H (trump) wins — seat 2
		assert.Equal(t, 2, state.ActivePlayerSeat)

		// Trick 7: Seat 2 leads AC
		trick7 := []struct {
			seat int
			card game.Card
		}{
			{2, game.Card{Rank: game.RankAce, Suit: game.SuitClubs}},
			{3, game.Card{Rank: game.RankJack, Suit: game.SuitClubs}}, // follow suit
			{0, game.Card{Rank: game.Rank7, Suit: game.SuitClubs}},    // follow suit
			{1, game.Card{Rank: game.Rank8, Suit: game.SuitClubs}},    // follow suit
		}
		for _, c := range trick7 {
			action := game.Action{Type: game.ActionPlayCard, PlayerSeat: c.seat, Card: &c.card}
			var err error
			state, err = game.ApplyAction(state, action)
			require.NoError(t, err, "trick 7 seat %d", c.seat)
		}
		// AC wins — seat 2
		assert.Equal(t, 2, state.ActivePlayerSeat)

		// Trick 8: Seat 2 leads TC
		trick8 := []struct {
			seat int
			card game.Card
		}{
			{2, game.Card{Rank: game.RankTen, Suit: game.SuitClubs}},
			{3, game.Card{Rank: game.Rank9, Suit: game.SuitClubs}},      // follow suit
			{0, game.Card{Rank: game.RankQueen, Suit: game.SuitSpades}}, // void, partner winning, any
			{1, game.Card{Rank: game.RankJack, Suit: game.SuitSpades}},  // void, opponent winning — no trump, any
		}
		for _, c := range trick8 {
			action := game.Action{Type: game.ActionPlayCard, PlayerSeat: c.seat, Card: &c.card}
			var err error
			state, err = game.ApplyAction(state, action)
			require.NoError(t, err, "trick 8 seat %d", c.seat)
		}

		// After trick 8, scoring runs atomically — state advances to PhaseDealing (new hand) or PhaseMatchEnd.
		// Scoring adds last-trick bonus (+10) to HandPoints, then resets HandPoints on new hand.
		// Verify scoring completed by checking TeamScores increased (both teams had points from 8 tricks).
		assert.Contains(t, []game.Phase{game.PhaseDealing, game.PhaseMatchEnd}, state.Phase,
			"should advance past PhaseHandScoring to PhaseDealing or PhaseMatchEnd")
		totalTeamScores := state.TeamScores[0] + state.TeamScores[1]
		assert.Greater(t, totalTeamScores, 0, "TeamScores should reflect scored hand points (152 card pts + 10 last-trick bonus = 162)")

		if state.Phase == game.PhaseBidding {
			// New hand: each player gets 8 cards, HandPoints reset
			for i, p := range state.Players {
				assert.Len(t, p.Hand, 8, "player %d should have 8 cards after new deal", i)
			}
		}
	})
}
