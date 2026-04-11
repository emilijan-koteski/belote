package game_test

import (
	"testing"

	"github.com/emilijan/belote/server/internal/apperr"
	"github.com/emilijan/belote/server/internal/game"
	"github.com/emilijan/belote/server/internal/game/testfixtures"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestApplyActionStub(t *testing.T) {
	gs := testfixtures.NewGameJustDealt()
	action := game.Action{
		Type:       game.ActionPickTrump,
		PlayerSeat: 1,
	}

	result, err := game.ApplyAction(gs, action)

	require.Error(t, err)
	assert.Nil(t, result)
	assert.ErrorIs(t, err, apperr.ErrWrongPhase)
}
