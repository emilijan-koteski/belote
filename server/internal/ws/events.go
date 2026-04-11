package ws

import _ "nhooyr.io/websocket" // Required dependency — anchored here for go.mod

// WebSocket event contract — keep in sync with client/src/shared/types/wsEvents.ts

// Event type prefixes:
// action: — client -> server
// event:  — server -> client (game state)
// error:  — server -> client (errors)
// system: — server -> client (platform events)

// Room events
const SystemRoomCreated = "system:room_created"
