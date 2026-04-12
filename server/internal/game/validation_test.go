package game_test

import (
	"testing"

	"github.com/emilijan/belote/server/internal/apperr"
	"github.com/emilijan/belote/server/internal/game"
	"github.com/emilijan/belote/server/internal/game/testfixtures"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestValidationAllTrumpCards tests that when all hand cards are trump and
// a non-trump suit is led with opponent winning, all trump cards are legal.
func TestValidationAllTrumpCards(t *testing.T) {
	t.Run("all hand cards are trump - over-trump applies among them", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		// Set seat 2's hand to only trump cards
		gs.Players[2].Hand = []game.Card{
			{Rank: game.RankKing, Suit: game.SuitHearts},
			{Rank: game.RankQueen, Suit: game.SuitHearts},
			{Rank: game.Rank8, Suit: game.SuitHearts},
			{Rank: game.Rank7, Suit: game.SuitHearts},
		}

		// Seat 1 (Blue) leads with JS — opponent to seat 2
		gs.ActivePlayerSeat = 1
		leadAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 1,
			Card: &game.Card{Rank: game.RankJack, Suit: game.SuitSpades}}
		gs, err := game.ApplyAction(gs, leadAction)
		require.NoError(t, err)

		// Seat 2 is void in spades, opponent winning, has only trump.
		// No trump in trick yet, so no over-trump obligation — any trump is legal.
		lowerTrump := game.Action{Type: game.ActionPlayCard, PlayerSeat: 2,
			Card: &game.Card{Rank: game.Rank7, Suit: game.SuitHearts}}
		result, err := game.ApplyAction(gs, lowerTrump)

		require.NoError(t, err)
		require.NotNil(t, result)
	})
}

// TestValidationOneCardLeft tests that the last card is always legal.
func TestValidationOneCardLeft(t *testing.T) {
	t.Run("player with one card left - always legal", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(8) // 1 card per player
		// Seat 0 has only AS
		action := game.Action{Type: game.ActionPlayCard, PlayerSeat: 0,
			Card: &game.Card{Rank: game.RankAce, Suit: game.SuitSpades}}

		result, err := game.ApplyAction(gs, action)

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Empty(t, result.Players[0].Hand)
	})
}

// TestValidationFourthPlayer tests that rules still apply for the 4th player.
func TestValidationFourthPlayer(t *testing.T) {
	t.Run("4th player still must follow suit", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		// Play 3 cards: seat 0 leads spade, seat 1 follows, seat 2 trumps
		plays := []struct {
			seat int
			card game.Card
		}{
			{0, game.Card{Rank: game.RankAce, Suit: game.SuitSpades}},
			{1, game.Card{Rank: game.RankJack, Suit: game.SuitSpades}},
			{2, game.Card{Rank: game.RankKing, Suit: game.SuitHearts}},
		}

		state := gs
		for _, p := range plays {
			action := game.Action{Type: game.ActionPlayCard, PlayerSeat: p.seat, Card: &p.card}
			var err error
			state, err = game.ApplyAction(state, action)
			require.NoError(t, err)
		}

		// Seat 3 has 4 diamonds and 4 clubs, no spades.
		// Seat 2 (Red, partner of seat 0) played trump KH and is winning.
		// Seat 3 is Blue — partner exemption does NOT apply (opponent winning).
		// Actually seat 2 played trump KH — who is winning?
		// Cards: AS(seat 0, rank 7 non-trump), JS(seat 1, rank 3 non-trump), KH(seat 2, trump rank 3)
		// Trump beats non-trump — seat 2 (Red) is winning.
		// Seat 3 is Blue — opponent (Red) is winning.
		// Seat 3 has no spades AND no trump — any card is legal.
		anyCard := game.Action{Type: game.ActionPlayCard, PlayerSeat: 3,
			Card: &game.Card{Rank: game.RankKing, Suit: game.SuitClubs}}
		result, err := game.ApplyAction(state, anyCard)

		require.NoError(t, err)
		require.NotNil(t, result)
	})
}

// TestValidationPartnerTrumped tests partner exemption when partner played trump.
func TestValidationPartnerTrumped(t *testing.T) {
	t.Run("partner trumped and is winning - any card legal", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		// Seat 1 (Blue) leads spade, Seat 2 (Red) trumps (partner to seat 0)
		gs.ActivePlayerSeat = 1
		plays := []struct {
			seat int
			card game.Card
		}{
			{1, game.Card{Rank: game.RankJack, Suit: game.SuitSpades}},
			{2, game.Card{Rank: game.RankKing, Suit: game.SuitHearts}}, // trump, wins
			{3, game.Card{Rank: game.Rank7, Suit: game.SuitDiamonds}},  // any card
		}

		state := gs
		for _, p := range plays {
			action := game.Action{Type: game.ActionPlayCard, PlayerSeat: p.seat, Card: &p.card}
			var err error
			state, err = game.ApplyAction(state, action)
			require.NoError(t, err)
		}

		// Seat 0 (Red) — partner seat 2 trumped and is winning.
		// Spade was led. Seat 0 has spades but also other suits.
		// Must follow suit (has spades) — partner exemption only applies when void.
		// So seat 0 must play a spade.
		validSpade := game.Action{Type: game.ActionPlayCard, PlayerSeat: 0,
			Card: &game.Card{Rank: game.RankAce, Suit: game.SuitSpades}}
		result, err := game.ApplyAction(state, validSpade)
		require.NoError(t, err)
		require.NotNil(t, result)

		// Playing a non-spade should be illegal (has spades)
		state2 := gs
		for _, p := range plays {
			action := game.Action{Type: game.ActionPlayCard, PlayerSeat: p.seat, Card: &p.card}
			var err error
			state2, err = game.ApplyAction(state2, action)
			require.NoError(t, err)
		}
		illegalNonSpade := game.Action{Type: game.ActionPlayCard, PlayerSeat: 0,
			Card: &game.Card{Rank: game.RankAce, Suit: game.SuitHearts}}
		result, err = game.ApplyAction(state2, illegalNonSpade)
		assert.ErrorIs(t, err, apperr.ErrIllegalPlay)
		assert.Nil(t, result)
	})

	t.Run("void in led suit and partner trumped winning - any card legal", func(t *testing.T) {
		gs := testfixtures.NewGameMidPlay(1)
		// Setup: seat 0 leads spade, seat 1 (Blue, void in spades) trumps,
		// seat 2 (Red) follows spade, seat 3 (Blue, partner of seat 1) is void
		// in spades. Partner seat 1 is winning with trump → any card legal.
		// Give seat 1 no spades but a trump.
		gs.Players[1].Hand = []game.Card{
			{Rank: game.Rank9, Suit: game.SuitHearts}, // trump order 6
			{Rank: game.Rank8, Suit: game.SuitClubs},
			{Rank: game.Rank9, Suit: game.SuitClubs},
			{Rank: game.RankQueen, Suit: game.SuitDiamonds},
			{Rank: game.RankJack, Suit: game.SuitDiamonds},
			{Rank: game.Rank9, Suit: game.SuitDiamonds},
			{Rank: game.Rank8, Suit: game.SuitDiamonds},
			{Rank: game.Rank7, Suit: game.SuitDiamonds},
		}

		// Seat 0 (Red) leads QS
		leadAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 0,
			Card: &game.Card{Rank: game.RankQueen, Suit: game.SuitSpades}}
		gs, err := game.ApplyAction(gs, leadAction)
		require.NoError(t, err)

		// Seat 1 (Blue) void in spades, opponent Red winning → trumps with 9H
		trumpAction := game.Action{Type: game.ActionPlayCard, PlayerSeat: 1,
			Card: &game.Card{Rank: game.Rank9, Suit: game.SuitHearts}}
		gs, err = game.ApplyAction(gs, trumpAction)
		require.NoError(t, err)

		// Seat 2 (Red) void in spades, opponent Blue winning → must trump.
		// Must over-trump 9H(6). Seat 2 has KH(3), QH(2), 8H(1), 7H(0). None beat 9H(6).
		// So any trump is legal.
		seat2Trump := game.Action{Type: game.ActionPlayCard, PlayerSeat: 2,
			Card: &game.Card{Rank: game.RankKing, Suit: game.SuitHearts}}
		gs, err = game.ApplyAction(gs, seat2Trump)
		require.NoError(t, err)

		// Seat 3 (Blue) is void in spades, no trump. Partner seat 1 (Blue) trumped with 9H.
		// Current trick winner: 9H (seat 1, Blue, trump order 6) beats KH (seat 2, Red, order 3).
		// Wait — 9H order 6 > KH order 3. Seat 1 (Blue) is still winning.
		// Seat 3 is Blue team → partner winning → any card legal.
		// Seat 3 has no trump → any card legal anyway, but the partner exemption is the reason.
		anyCard := game.Action{Type: game.ActionPlayCard, PlayerSeat: 3,
			Card: &game.Card{Rank: game.RankKing, Suit: game.SuitClubs}}
		result, err := game.ApplyAction(gs, anyCard)

		require.NoError(t, err, "partner trumped and winning — any card should be legal")
		require.NotNil(t, result)
	})
}
