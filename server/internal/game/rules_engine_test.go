package game_test

import (
	"testing"

	"github.com/emilijan/beljot/server/internal/apperr"
	"github.com/emilijan/beljot/server/internal/game"
	"github.com/emilijan/beljot/server/internal/game/testfixtures"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestApplyActionPhaseBidding(t *testing.T) {
	t.Run("valid pick_trump in bidding phase succeeds", func(t *testing.T) {
		gs := testfixtures.NewGameJustDealt()
		action := game.Action{
			Type:       game.ActionPickTrump,
			PlayerSeat: 1,
		}

		result, err := game.ApplyAction(gs, action)

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Equal(t, game.PhasePlaying, result.Phase)
	})

	t.Run("unhandled phase returns ErrWrongPhase", func(t *testing.T) {
		gs := testfixtures.NewGameJustDealt()
		gs.Phase = game.Phase("unknown_phase")
		action := game.Action{
			Type:       game.ActionPlayCard,
			PlayerSeat: 1,
		}

		result, err := game.ApplyAction(gs, action)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.ErrorIs(t, err, apperr.ErrWrongPhase)
	})
}

func TestApplyAction_MatchEndPhase_ReturnsErrWrongPhase(t *testing.T) {
	actions := []game.Action{
		{Type: game.ActionPlayCard, PlayerSeat: 0, Card: &game.Card{Rank: game.RankAce, Suit: game.SuitSpades}},
		{Type: game.ActionPickTrump, PlayerSeat: 0},
		{Type: game.ActionPassTrump, PlayerSeat: 0},
		{Type: game.ActionDeclare, PlayerSeat: 0},
		{Type: game.ActionSkipDeclare, PlayerSeat: 0},
	}

	for _, action := range actions {
		t.Run(action.Type, func(t *testing.T) {
			gs := testfixtures.NewGameJustDealt()
			gs.Phase = game.PhaseMatchEnd

			result, err := game.ApplyAction(gs, action)

			require.Error(t, err)
			assert.Nil(t, result)
			assert.ErrorIs(t, err, apperr.ErrWrongPhase)
		})
	}
}

func TestApplyAction_PausedPhase_ReturnsErrGamePaused(t *testing.T) {
	actions := []game.Action{
		{Type: game.ActionPlayCard, PlayerSeat: 0, Card: &game.Card{Rank: game.RankAce, Suit: game.SuitSpades}},
		{Type: game.ActionPickTrump, PlayerSeat: 0},
		{Type: game.ActionPassTrump, PlayerSeat: 0},
	}

	for _, action := range actions {
		t.Run(action.Type, func(t *testing.T) {
			gs := testfixtures.NewGameJustDealt()
			gs.Phase = game.PhasePaused

			result, err := game.ApplyAction(gs, action)

			require.Error(t, err)
			assert.Nil(t, result)
			assert.ErrorIs(t, err, apperr.ErrGamePaused)
		})
	}
}
