package testfixtures_test

import (
	"testing"

	"github.com/emilijan/belote/server/internal/game"
	"github.com/emilijan/belote/server/internal/game/testfixtures"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewGameJustDealt(t *testing.T) {
	gs := testfixtures.NewGameJustDealt()

	t.Run("phase is bidding", func(t *testing.T) {
		assert.Equal(t, game.PhaseBidding, gs.Phase)
	})

	t.Run("each player has 8 cards", func(t *testing.T) {
		for i, p := range gs.Players {
			assert.Len(t, p.Hand, 8, "player at seat %d should have 8 cards", i)
		}
	})

	t.Run("all 32 cards accounted for", func(t *testing.T) {
		seen := make(map[string]bool)
		for _, p := range gs.Players {
			for _, card := range p.Hand {
				id := card.String()
				assert.False(t, seen[id], "duplicate card: %s", id)
				seen[id] = true
			}
		}
		assert.Len(t, seen, 32)
	})

	t.Run("teams assigned correctly", func(t *testing.T) {
		assert.Equal(t, "red", gs.Players[0].Team)
		assert.Equal(t, "blue", gs.Players[1].Team)
		assert.Equal(t, "red", gs.Players[2].Team)
		assert.Equal(t, "blue", gs.Players[3].Team)
	})

	t.Run("dealer is seat 0", func(t *testing.T) {
		assert.Equal(t, 0, gs.DealerSeat)
	})

	t.Run("active player is seat 1", func(t *testing.T) {
		assert.Equal(t, 1, gs.ActivePlayerSeat)
	})

	t.Run("trump candidate is set", func(t *testing.T) {
		require.NotNil(t, gs.TrumpCandidate)
		assert.Equal(t, game.Rank7, gs.TrumpCandidate.Rank)
		assert.Equal(t, game.SuitHearts, gs.TrumpCandidate.Suit)
	})

	t.Run("variant is Bitola", func(t *testing.T) {
		assert.Equal(t, game.VariantBitola, gs.Variant)
	})

	t.Run("hand number is 1", func(t *testing.T) {
		assert.Equal(t, 1, gs.HandNumber)
	})

	t.Run("all players connected", func(t *testing.T) {
		for i, p := range gs.Players {
			assert.True(t, p.Connected, "player at seat %d should be connected", i)
		}
	})

	t.Run("deterministic hands for reproducibility", func(t *testing.T) {
		gs2 := testfixtures.NewGameJustDealt()
		for i := range gs.Players {
			assert.Equal(t, gs.Players[i].Hand, gs2.Players[i].Hand, "hands should be identical across calls")
		}
	})
}
