package game_test

import (
	"testing"

	"github.com/emilijan/beljot/server/internal/game"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCardString(t *testing.T) {
	tests := []struct {
		name     string
		card     game.Card
		expected string
	}{
		{"King of Spades", game.Card{Rank: game.RankKing, Suit: game.SuitSpades}, "KS"},
		{"Ten of Hearts", game.Card{Rank: game.RankTen, Suit: game.SuitHearts}, "TH"},
		{"Seven of Diamonds", game.Card{Rank: game.Rank7, Suit: game.SuitDiamonds}, "7D"},
		{"Ace of Clubs", game.Card{Rank: game.RankAce, Suit: game.SuitClubs}, "AC"},
		{"Jack of Hearts", game.Card{Rank: game.RankJack, Suit: game.SuitHearts}, "JH"},
		{"Queen of Spades", game.Card{Rank: game.RankQueen, Suit: game.SuitSpades}, "QS"},
		{"Nine of Clubs", game.Card{Rank: game.Rank9, Suit: game.SuitClubs}, "9C"},
		{"Eight of Diamonds", game.Card{Rank: game.Rank8, Suit: game.SuitDiamonds}, "8D"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, tc.card.String())
		})
	}
}

func TestParseCard(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		expected  game.Card
		expectErr bool
	}{
		{"valid KS", "KS", game.Card{Rank: game.RankKing, Suit: game.SuitSpades}, false},
		{"valid TH", "TH", game.Card{Rank: game.RankTen, Suit: game.SuitHearts}, false},
		{"valid 7D", "7D", game.Card{Rank: game.Rank7, Suit: game.SuitDiamonds}, false},
		{"valid AC", "AC", game.Card{Rank: game.RankAce, Suit: game.SuitClubs}, false},
		{"valid JH", "JH", game.Card{Rank: game.RankJack, Suit: game.SuitHearts}, false},
		{"valid QS", "QS", game.Card{Rank: game.RankQueen, Suit: game.SuitSpades}, false},
		{"valid 9C", "9C", game.Card{Rank: game.Rank9, Suit: game.SuitClubs}, false},
		{"valid 8D", "8D", game.Card{Rank: game.Rank8, Suit: game.SuitDiamonds}, false},
		{"empty string", "", game.Card{}, true},
		{"single char", "K", game.Card{}, true},
		{"three chars", "KSS", game.Card{}, true},
		{"invalid rank", "XS", game.Card{}, true},
		{"invalid suit", "KX", game.Card{}, true},
		{"lowercase rank", "kS", game.Card{}, true},
		{"lowercase suit", "Ks", game.Card{}, true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			card, err := game.ParseCard(tc.input)
			if tc.expectErr {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tc.expected, card)
			}
		})
	}
}

func TestParseCardRoundTrip(t *testing.T) {
	tests := []struct {
		name string
		id   string
	}{
		{"KS round-trip", "KS"},
		{"TH round-trip", "TH"},
		{"7D round-trip", "7D"},
		{"AC round-trip", "AC"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			card, err := game.ParseCard(tc.id)
			require.NoError(t, err)
			assert.Equal(t, tc.id, card.String())
		})
	}
}

func TestNewDeck(t *testing.T) {
	deck := game.NewDeck()

	t.Run("has 32 cards", func(t *testing.T) {
		assert.Len(t, deck, 32)
	})

	t.Run("all cards are unique", func(t *testing.T) {
		seen := make(map[string]bool)
		for _, card := range deck {
			id := card.String()
			assert.False(t, seen[id], "duplicate card: %s", id)
			seen[id] = true
		}
	})

	t.Run("contains all suits", func(t *testing.T) {
		suits := make(map[game.Suit]int)
		for _, card := range deck {
			suits[card.Suit]++
		}
		for _, suit := range game.AllSuits {
			assert.Equal(t, 8, suits[suit], "suit %s should have 8 cards", suit)
		}
	})

	t.Run("contains all ranks", func(t *testing.T) {
		ranks := make(map[game.Rank]int)
		for _, card := range deck {
			ranks[card.Rank]++
		}
		for _, rank := range game.AllRanks {
			assert.Equal(t, 4, ranks[rank], "rank %s should have 4 cards", rank)
		}
	})
}

func TestTrumpCardPoints(t *testing.T) {
	tests := []struct {
		rank     game.Rank
		expected int
	}{
		{game.RankJack, 20},
		{game.Rank9, 14},
		{game.RankAce, 11},
		{game.RankTen, 10},
		{game.RankKing, 4},
		{game.RankQueen, 3},
		{game.Rank8, 0},
		{game.Rank7, 0},
	}

	for _, tc := range tests {
		t.Run(string(tc.rank), func(t *testing.T) {
			assert.Equal(t, tc.expected, game.TrumpCardPoints[tc.rank])
		})
	}

	t.Run("all ranks covered", func(t *testing.T) {
		assert.Len(t, game.TrumpCardPoints, 8)
	})

	t.Run("trump suit totals 62 points", func(t *testing.T) {
		total := 0
		for _, pts := range game.TrumpCardPoints {
			total += pts
		}
		assert.Equal(t, 62, total)
	})
}

func TestNonTrumpCardPoints(t *testing.T) {
	tests := []struct {
		rank     game.Rank
		expected int
	}{
		{game.RankAce, 11},
		{game.RankTen, 10},
		{game.RankKing, 4},
		{game.RankQueen, 3},
		{game.RankJack, 2},
		{game.Rank9, 0},
		{game.Rank8, 0},
		{game.Rank7, 0},
	}

	for _, tc := range tests {
		t.Run(string(tc.rank), func(t *testing.T) {
			assert.Equal(t, tc.expected, game.NonTrumpCardPoints[tc.rank])
		})
	}

	t.Run("all ranks covered", func(t *testing.T) {
		assert.Len(t, game.NonTrumpCardPoints, 8)
	})

	t.Run("non-trump suit totals 30 points", func(t *testing.T) {
		total := 0
		for _, pts := range game.NonTrumpCardPoints {
			total += pts
		}
		assert.Equal(t, 30, total)
	})
}
