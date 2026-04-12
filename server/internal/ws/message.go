package ws

import "encoding/json"

// WSMessage is the wire format for all WebSocket communication.
// Type uses prefix:event_name format (action:, event:, error:, system:).
// Payload is lazily parsed — the router only needs the type for dispatch.
type WSMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}
