package ws

// WebSocket event contract — keep in sync with client/src/shared/types/wsEvents.ts

// Event type prefixes:
// action: — client -> server
// event:  — server -> client (game state)
// error:  — server -> client (errors)
// system: — server -> client (platform events)

// --- Authentication events ---
const ActionAuthenticate = "action:authenticate"
const SystemAuthenticated = "system:authenticated"
const ErrorAuthFailed = "error:auth_failed"

// --- Game action events (client -> server) ---
const ActionPlayCard = "action:play_card"
const ActionPickTrump = "action:pick_trump"
const ActionPassTrump = "action:pass_trump"
const ActionDeclare = "action:declare"
const ActionSkipDeclare = "action:skip_declare"
const ActionAnnounceBelot = "action:announce_belot"
const ActionDeclineBelot = "action:decline_belot"
const ActionPause = "action:pause"
const ActionUnpause = "action:unpause"
const ActionOwnerUnpause = "action:owner_unpause"

// --- Game state events (server -> client) ---
const EventGameState = "event:game_state"
const EventCardPlayed = "event:card_played"
const EventTrickResolved = "event:trick_resolved"
const EventHandScored = "event:hand_scored"
const EventMatchEnd = "event:match_end"
const EventTrumpSelected = "event:trump_selected"
const EventDeclarationsResolved = "event:declarations_resolved"
const EventBelotAnnounced = "event:belot_announced"
const EventGamePaused = "event:game_paused"
const EventGameResumed = "event:game_resumed"

// --- Game event payload structs ---

// CardPlayedPayload is the typed payload for EventCardPlayed events.
type CardPlayedPayload struct {
	PlayerSeat int    `json:"playerSeat"`
	CardID     string `json:"cardId"`
	AutoPlayed bool   `json:"autoPlayed"`
}

// GamePausedPayload is the typed payload for EventGamePaused events.
type GamePausedPayload struct {
	PausedBy      int     `json:"pausedBy"`
	PausedPlayers [4]bool `json:"pausedPlayers"`
}

// GameResumedPayload is the typed payload for EventGameResumed events.
type GameResumedPayload struct {
	ResumedBy     int  `json:"resumedBy"`
	OwnerOverride bool `json:"ownerOverride"`
}

// --- Disconnect/reconnect events (server -> client) ---
const EventPlayerDisconnected = "event:player_disconnected"
const EventPlayerReconnected = "event:player_reconnected"
const EventMatchAbandoned = "event:match_abandoned"

// PlayerDisconnectedPayload is the typed payload for EventPlayerDisconnected events.
type PlayerDisconnectedPayload struct {
	PlayerSeat         int    `json:"playerSeat"`
	Username           string `json:"username"`
	ReconnectExpiresAt string `json:"reconnectExpiresAt"` // ISO 8601 timestamp
}

// PlayerReconnectedPayload is the typed payload for EventPlayerReconnected events.
type PlayerReconnectedPayload struct {
	PlayerSeat int `json:"playerSeat"`
}

// MatchAbandonedPayload is the typed payload for EventMatchAbandoned events.
type MatchAbandonedPayload struct {
	AbandonedByPlayer int `json:"abandonedByPlayer"`
	RedFinalScore     int `json:"redFinalScore"`
	BlueFinalScore    int `json:"blueFinalScore"`
	MatchDurationSec  int `json:"matchDurationSec"`
}

// --- Game error events (server -> client) ---
const ErrorInvalidAction = "error:invalid_action"
const ErrorNotYourTurn = "error:not_your_turn"
const ErrorWrongPhase = "error:wrong_phase"
const ErrorIllegalPlay = "error:illegal_play"
const ErrorPauseExhausted = "error:pause_exhausted"
const ErrorNoActivePause = "error:no_active_pause"
const ErrorNotRoomOwner = "error:not_room_owner"
const ErrorPlayerDisconnected = "error:player_disconnected"

// --- Room events ---
const SystemRoomCreated = "system:room_created"
const SystemRoomUpdated = "system:room_updated"

// --- Room player events ---
const SystemPlayerJoined = "system:player_joined"
const SystemPlayerLeft = "system:player_left"

// --- Seat and game events ---
const SystemSeatUpdated = "system:seat_updated"
const SystemGameStarted = "system:game_started"

// --- Chat events ---
const SystemChatMessage = "system:chat_message"

// --- General error events ---
const SystemError = "system:error"
const ErrorUnknownEvent = "error:unknown_event"
