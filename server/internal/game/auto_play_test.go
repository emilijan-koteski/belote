package game_test

import (
	"testing"

	"github.com/emilijan/belote/server/internal/game"
	"github.com/emilijan/belote/server/internal/game/testfixtures"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAutoPlay(t *testing.T) {
	tests := []struct {
		name     string
		setup    func() *game.GameState
		expected string
	}{
		{
			name: "leading with mixed hand selects first by suit then rank",
			setup: func() *game.GameState {
				gs := testfixtures.NewGameMidPlay(1)
				// Seat 0 leads: AS TS KS QS AH TH KD 7C
				// Sorted by suit (S<H<D<C) then rank (7<8<9<T<J<Q<K<A)
				// Spades first, lowest rank: T(3) < Q(5) < K(6) < A(7) → TS
				gs.ActivePlayerSeat = 0
				return gs
			},
			expected: "TS",
		},
		{
			name: "leading with single suit selects lowest rank",
			setup: func() *game.GameState {
				gs := testfixtures.NewGameJustDealt()
				gs.Phase = game.PhasePlaying
				trump := game.SuitHearts
				gs.TrumpSuit = &trump
				caller := 1
				gs.TrumpCallerSeat = &caller
				gs.DeclarationsResolved = true
				gs.BelotAnnounced = true
				gs.TrickNumber = 1
				// Seat 0 has all spades: 7S 8S 9S TS JS QS KS AS
				// Sorted: all same suit S, rank order 7<8<9<T<J<Q<K<A → pick 7S
				gs.ActivePlayerSeat = 0
				return gs
			},
			expected: "7S",
		},
		{
			name: "must follow suit returns lowest legal card from led suit",
			setup: func() *game.GameState {
				gs := testfixtures.NewGameMidPlay(1)
				// Seat 1 hand: JS 9S 8S 7S JH 9H QD 8C
				leadSuit := game.SuitSpades
				gs.LeadSuit = &leadSuit
				gs.CurrentTrick = []game.TrickCard{
					{Card: game.Card{Rank: game.RankAce, Suit: game.SuitSpades}, PlayerSeat: 0},
				}
				gs.ActivePlayerSeat = 1
				// Legal: JS 9S 8S 7S (must follow spades)
				// Sorted by rank: 7S first
				return gs
			},
			expected: "7S",
		},
		{
			name: "void in led suit and no trump plays lowest by suit then rank",
			setup: func() *game.GameState {
				gs := testfixtures.NewGameMidPlay(1)
				// Seat 3 has no Spades and no Hearts(trump): JD 9D 8D 7D KC QC JC 9C
				leadSuit := game.SuitSpades
				gs.LeadSuit = &leadSuit
				gs.CurrentTrick = []game.TrickCard{
					{Card: game.Card{Rank: game.RankAce, Suit: game.SuitSpades}, PlayerSeat: 0},
				}
				gs.ActivePlayerSeat = 3
				// No spades, no trump → any card legal
				// Sorted: D(7D 8D 9D JD) then C(9C JC QC KC) → 7D first
				return gs
			},
			expected: "7D",
		},
		{
			name: "single card in hand returns that card",
			setup: func() *game.GameState {
				gs := testfixtures.NewGameMidPlay(8)
				// Seat 0 at trick 8: only 1 card left (AS)
				gs.ActivePlayerSeat = 0
				return gs
			},
			expected: "AS",
		},
		{
			name: "seat 2 leading with mixed suits picks lowest of first suit",
			setup: func() *game.GameState {
				gs := testfixtures.NewGameMidPlay(1)
				// Seat 2: AD TD KH QH 8H 7H AC TC
				// Leading: all cards legal
				// Sorted: H(7H 8H QH KH) then D(TD AD) then C(TC AC)
				// First: 7H
				gs.ActivePlayerSeat = 2
				return gs
			},
			expected: "7H",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gs := tt.setup()
			cardID, err := game.AutoPlay(gs)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, cardID)
		})
	}
}

func TestAutoPlay_ErrorOnEmptyHand(t *testing.T) {
	gs := testfixtures.NewGameMidPlay(1)
	gs.Players[0].Hand = []game.Card{}
	gs.ActivePlayerSeat = 0

	_, err := game.AutoPlay(gs)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no legal cards")
}
