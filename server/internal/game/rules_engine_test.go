package game_test

import (
	"testing"

	"github.com/emilijan/belote/server/internal/apperr"
	"github.com/emilijan/belote/server/internal/game"
	"github.com/emilijan/belote/server/internal/game/testfixtures"
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
		gs.Phase = game.PhaseMatchEnd
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
