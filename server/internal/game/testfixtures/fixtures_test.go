package testfixtures_test

import (
	"testing"

	"github.com/emilijan/belote/server/internal/game"
	"github.com/emilijan/belote/server/internal/game/testfixtures"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewGameMidBidding(t *testing.T) {
	tests := []struct {
		name              string
		passCount         int
		expectedRound     int
		expectedPassCount int
		expectedActive    int
	}{
		{
			name:              "passCount 0 matches NewGameJustDealt",
			passCount:         0,
			expectedRound:     1,
			expectedPassCount: 0,
			expectedActive:    1,
		},
		{
			name:              "passCount 1 - round 1 with 1 pass",
			passCount:         1,
			expectedRound:     1,
			expectedPassCount: 1,
			expectedActive:    2,
		},
		{
			name:              "passCount 3 - round 1 with 3 passes",
			passCount:         3,
			expectedRound:     1,
			expectedPassCount: 3,
			expectedActive:    0,
		},
		{
			name:              "passCount 4 - round 2 just started",
			passCount:         4,
			expectedRound:     2,
			expectedPassCount: 0,
			expectedActive:    1,
		},
		{
			name:              "passCount 5 - round 2 with 1 pass",
			passCount:         5,
			expectedRound:     2,
			expectedPassCount: 1,
			expectedActive:    2,
		},
		{
			name:              "passCount 7 - round 2 with 3 passes",
			passCount:         7,
			expectedRound:     2,
			expectedPassCount: 3,
			expectedActive:    0,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gs := testfixtures.NewGameMidBidding(tc.passCount)

			assert.Equal(t, game.PhaseBidding, gs.Phase)
			assert.Equal(t, tc.expectedRound, gs.BiddingRound, "BiddingRound")
			assert.Equal(t, tc.expectedPassCount, gs.BiddingPassCount, "BiddingPassCount")
			assert.Equal(t, tc.expectedActive, gs.ActivePlayerSeat, "ActivePlayerSeat")
			assert.Equal(t, 0, gs.DealerSeat, "DealerSeat should always be 0")

			// Every fixture should have valid card distribution
			for i, p := range gs.Players {
				assert.Len(t, p.Hand, 8, "player at seat %d should have 8 cards", i)
			}
			require.NotNil(t, gs.TrumpCandidate)
		})
	}

	t.Run("passCount 0 equals NewGameJustDealt", func(t *testing.T) {
		mid := testfixtures.NewGameMidBidding(0)
		fresh := testfixtures.NewGameJustDealt()
		assert.Equal(t, fresh.BiddingRound, mid.BiddingRound)
		assert.Equal(t, fresh.BiddingPassCount, mid.BiddingPassCount)
		assert.Equal(t, fresh.ActivePlayerSeat, mid.ActivePlayerSeat)
		assert.Equal(t, fresh.DealerSeat, mid.DealerSeat)
		assert.Equal(t, fresh.Phase, mid.Phase)
	})
}

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
