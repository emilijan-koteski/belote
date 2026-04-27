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

// --- Surrender actions (Story 8.2) ---
const ActionSurrenderRequest = "action:surrender_request"
const ActionSurrenderAccept = "action:surrender_accept"
const ActionSurrenderDecline = "action:surrender_decline"

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

// TrumpSelectedPayload is the typed payload for EventTrumpSelected events.
// CardID carries the originally face-up trumpCandidate the picker absorbed —
// the post-pick GameState clears trumpCandidate to nil, so this event is the
// only place clients can read it.
type TrumpSelectedPayload struct {
	PlayerSeat int    `json:"playerSeat"`
	TrumpSuit  string `json:"trumpSuit"`
	CardID     string `json:"cardId"`
}

// BelotAnnouncedPayload is the typed payload for EventBelotAnnounced events.
// CardID is the K/Q of trump that was just played and triggered the announcement.
type BelotAnnouncedPayload struct {
	PlayerSeat int    `json:"playerSeat"`
	Team       int    `json:"team"`
	CardID     string `json:"cardId"`
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

// MatchEndPayload is the typed payload for EventMatchEnd events.
// OutcomeReason and SurrenderedBySeat are additive fields — natural-end
// matches omit both via omitempty so the wire format is unchanged for
// existing clients. SurrenderedBySeat carries a seat index (0..3) when
// OutcomeReason == "surrender". The name disambiguates this seat-index
// field from the persistence column `match.SurrenderedBy` which holds a
// userID (uint).
type MatchEndPayload struct {
	WinnerTeam        int    `json:"winnerTeam"`
	RedFinalScore     int    `json:"redFinalScore"`
	BlueFinalScore    int    `json:"blueFinalScore"`
	MatchDurationSec  int    `json:"matchDurationSec"`
	OutcomeReason     string `json:"outcomeReason,omitempty"`     // "" (natural) | "surrender"
	SurrenderedBySeat *int   `json:"surrenderedBySeat,omitempty"` // seat index, only when outcomeReason == "surrender"
}

// --- Surrender events (Story 8.2) ---
const EventSurrenderProposed = "event:surrender_proposed"
const EventSurrenderDeclined = "event:surrender_declined"

// SurrenderProposedPayload is the typed payload for EventSurrenderProposed events.
// Sent to all four player WS connections when a player initiates surrender.
type SurrenderProposedPayload struct {
	ProposerSeat     int    `json:"proposerSeat"`
	ProposerTeam     int    `json:"proposerTeam"`
	ProposerUsername string `json:"proposerUsername"`
	PartnerSeat      int    `json:"partnerSeat"`
}

// SurrenderDeclinedPayload is the typed payload for EventSurrenderDeclined events.
// Sent to all four player WS connections when the partner declines.
type SurrenderDeclinedPayload struct {
	ProposerSeat  int `json:"proposerSeat"`
	DecliningSeat int `json:"decliningSeat"`
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
const ErrorSurrenderExhausted = "error:surrender_exhausted"

// --- Room events ---
const SystemRoomCreated = "system:room_created"
const SystemRoomUpdated = "system:room_updated"

// --- Room player events ---
const SystemPlayerJoined = "system:player_joined"
const SystemPlayerLeft = "system:player_left"
const SystemRoomKicked = "system:room_kicked"

// RoomKickedPayload is the typed payload for SystemRoomKicked events,
// sent only to the kicked user's WebSocket connection.
type RoomKickedPayload struct {
	RoomID uint   `json:"roomId"`
	Reason string `json:"reason"`
}

// --- Seat and game events ---
const SystemSeatUpdated = "system:seat_updated"
const SystemGameStarted = "system:game_started"

// --- Chat events ---
const ActionChatMessage = "action:chat_message"
const SystemChatMessage = "system:chat_message"

// ChatMessageRequest is the typed payload for ActionChatMessage (client → server).
type ChatMessageRequest struct {
	Channel string `json:"channel"`           // "global" | "match" | "room"
	MatchID *uint  `json:"matchId,omitempty"` // required when channel == "match"
	RoomID  *uint  `json:"roomId,omitempty"`  // required when channel == "room"
	Text    string `json:"text"`
}

// ChatMessagePayload is the typed payload for SystemChatMessage (server → client).
type ChatMessagePayload struct {
	UserID    uint   `json:"userId"`
	Username  string `json:"username"`
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"` // ISO 8601 (RFC3339) UTC
	Scope     string `json:"scope"`     // "global" | "match" | "room"
}

// --- General error events ---
const SystemError = "system:error"
const ErrorUnknownEvent = "error:unknown_event"
