package ws_test

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/emilijan/beljot/server/internal/ws"
)

// TestTrumpSelectedPayload_JSONContract locks the wire-format field names so
// the frontend's TrumpSelectedPayload type stays in sync. Renaming any field
// here without updating client/src/shared/types/wsEvents.ts breaks the
// reveal-dialog dispatch silently — this test surfaces the drift.
func TestTrumpSelectedPayload_JSONContract(t *testing.T) {
	p := ws.TrumpSelectedPayload{
		PlayerSeat: 2,
		TrumpSuit:  "S",
		CardID:     "7S",
	}
	data, err := json.Marshal(p)
	assert.NoError(t, err)

	var decoded map[string]any
	assert.NoError(t, json.Unmarshal(data, &decoded))

	assert.Equal(t, float64(2), decoded["playerSeat"])
	assert.Equal(t, "S", decoded["trumpSuit"])
	assert.Equal(t, "7S", decoded["cardId"])
	assert.Len(t, decoded, 3, "payload should have exactly playerSeat, trumpSuit, cardId")
}
