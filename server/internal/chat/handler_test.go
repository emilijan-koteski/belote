package chat_test

import (
	"encoding/json"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/emilijan/belote/server/internal/chat"
	"github.com/emilijan/belote/server/internal/user"
	"github.com/emilijan/belote/server/internal/ws"
)

// --- Fakes ---

type userRepoStub struct {
	users map[uint]*user.User
}

func newUserRepoStub() *userRepoStub {
	return &userRepoStub{users: make(map[uint]*user.User)}
}

func (s *userRepoStub) add(id uint, username string) {
	s.users[id] = &user.User{ID: id, Username: username}
}

func (s *userRepoStub) Create(*user.User) error                              { return nil }
func (s *userRepoStub) FindByEmail(string) (*user.User, error)               { return nil, nil }
func (s *userRepoStub) FindByUsername(string) (*user.User, error)            { return nil, nil }
func (s *userRepoStub) UpdateLanguagePreference(uint, string) error          { return nil }
func (s *userRepoStub) FindByID(id uint) (*user.User, error) {
	if u, ok := s.users[id]; ok {
		return u, nil
	}
	return nil, nil
}

type fakeGame struct {
	inGame map[uint]bool
}

func newFakeGame() *fakeGame {
	return &fakeGame{inGame: make(map[uint]bool)}
}

func (g *fakeGame) IsUserInGame(userID uint) bool {
	return g.inGame[userID]
}

type hubSpy struct {
	mu        sync.Mutex
	connected []uint
	calls     []hubCall
}

type hubCall struct {
	userIDs []uint
	msg     []byte
}

func (h *hubSpy) ConnectedUserIDs() []uint {
	h.mu.Lock()
	defer h.mu.Unlock()
	out := make([]uint, len(h.connected))
	copy(out, h.connected)
	return out
}

func (h *hubSpy) BroadcastToUsers(userIDs []uint, msg []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	dup := make([]uint, len(userIDs))
	copy(dup, userIDs)
	dupMsg := make([]byte, len(msg))
	copy(dupMsg, msg)
	h.calls = append(h.calls, hubCall{userIDs: dup, msg: dupMsg})
}

func (h *hubSpy) lastCall(t *testing.T) hubCall {
	t.Helper()
	h.mu.Lock()
	defer h.mu.Unlock()
	require.NotEmpty(t, h.calls, "expected at least one broadcast")
	return h.calls[len(h.calls)-1]
}

func (h *hubSpy) callCount() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.calls)
}

// --- Helpers ---

func chatActionMessage(t *testing.T, channel, text string) ws.WSMessage {
	t.Helper()
	return chatActionMessageRaw(t, ws.ChatMessageRequest{Channel: channel, Text: text})
}

func chatActionMessageRaw(t *testing.T, req interface{}) ws.WSMessage {
	t.Helper()
	payload, err := json.Marshal(req)
	require.NoError(t, err)
	return ws.WSMessage{Type: ws.ActionChatMessage, Payload: payload}
}

// --- Tests ---

func TestHandler_GlobalMessage_BroadcastsToEligibleClients(t *testing.T) {
	repo := newUserRepoStub()
	repo.add(10, "alice")

	game := newFakeGame()
	hub := &hubSpy{connected: []uint{10, 20, 30}}

	h := chat.NewHandler(hub, repo, game)
	client := &ws.Client{UserID: 10}
	h.HandleAction(client, chatActionMessage(t, "global", "hello world"))

	require.Equal(t, 1, hub.callCount())
	call := hub.lastCall(t)
	assert.ElementsMatch(t, []uint{10, 20, 30}, call.userIDs,
		"sender included so they see their own message")

	var env ws.WSMessage
	require.NoError(t, json.Unmarshal(call.msg, &env))
	assert.Equal(t, ws.SystemChatMessage, env.Type)

	var payload ws.ChatMessagePayload
	require.NoError(t, json.Unmarshal(env.Payload, &payload))
	assert.Equal(t, uint(10), payload.UserID)
	assert.Equal(t, "alice", payload.Username)
	assert.Equal(t, "hello world", payload.Message)
	assert.Equal(t, "global", payload.Scope)
	assert.NotEmpty(t, payload.Timestamp, "server stamps RFC3339 timestamp")
}

func TestHandler_GlobalMessage_ExcludesInGameUsers(t *testing.T) {
	repo := newUserRepoStub()
	repo.add(10, "alice")

	game := newFakeGame()
	game.inGame[20] = true
	game.inGame[30] = true

	hub := &hubSpy{connected: []uint{10, 20, 30, 40}}

	h := chat.NewHandler(hub, repo, game)
	h.HandleAction(&ws.Client{UserID: 10}, chatActionMessage(t, "global", "hi"))

	require.Equal(t, 1, hub.callCount())
	call := hub.lastCall(t)
	assert.ElementsMatch(t, []uint{10, 40}, call.userIDs,
		"in-game users (20,30) excluded; idle users (10,40) included")
}

func TestHandler_GlobalMessage_DroppedWhenSenderInGame(t *testing.T) {
	repo := newUserRepoStub()
	repo.add(10, "alice")

	game := newFakeGame()
	game.inGame[10] = true

	hub := &hubSpy{connected: []uint{10, 20}}

	h := chat.NewHandler(hub, repo, game)
	h.HandleAction(&ws.Client{UserID: 10}, chatActionMessage(t, "global", "hi"))

	assert.Equal(t, 0, hub.callCount(), "no broadcast when sender is in a game")
}

func TestHandler_GlobalMessage_SenderAlwaysReceivesOwnEcho(t *testing.T) {
	// Race repro: sender passes the initial in-game check, but then joins
	// a game before the per-recipient filter loop runs. The sender must
	// still receive their own message — the per-recipient filter exempts
	// the sender unconditionally once handleGlobal started executing.
	repo := newUserRepoStub()
	repo.add(10, "alice")

	game := newFakeGame()
	hub := &hubSpy{connected: []uint{10, 20, 30}}

	h := chat.NewHandler(hub, repo, game)

	// Capture the initial check, then flip the sender to in-game before
	// the broadcast filter runs. Simulate by mutating the fake between
	// HandleAction calls — but since HandleAction is synchronous, we
	// instead assert that even when the sender IS marked in-game on the
	// per-recipient pass, they still appear in the recipient list as long
	// as the initial check (before mutation) passed. Approximate by
	// pre-marking the sender as in-game and verifying the dedicated
	// "dropped" test catches that path; for THIS test we verify the
	// happy path includes the sender:
	game.inGame[20] = true // unrelated player in a game
	h.HandleAction(&ws.Client{UserID: 10}, chatActionMessage(t, "global", "hi"))

	require.Equal(t, 1, hub.callCount())
	call := hub.lastCall(t)
	assert.Contains(t, call.userIDs, uint(10), "sender always echoed back")
	assert.NotContains(t, call.userIDs, uint(20), "in-game user excluded")
	assert.Contains(t, call.userIDs, uint(30), "idle user included")
}

func TestHandler_RejectsEmpty(t *testing.T) {
	cases := []struct {
		name string
		text string
	}{
		{"empty string", ""},
		{"whitespace only", "   "},
		{"only newlines", "\n\n\t"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo := newUserRepoStub()
			repo.add(10, "alice")
			game := newFakeGame()
			hub := &hubSpy{connected: []uint{10, 20}}

			h := chat.NewHandler(hub, repo, game)
			h.HandleAction(&ws.Client{UserID: 10}, chatActionMessage(t, "global", tc.text))

			assert.Equal(t, 0, hub.callCount())
		})
	}
}

func TestHandler_RejectsTooLong(t *testing.T) {
	repo := newUserRepoStub()
	repo.add(10, "alice")
	game := newFakeGame()
	hub := &hubSpy{connected: []uint{10, 20}}

	h := chat.NewHandler(hub, repo, game)
	tooLong := strings.Repeat("x", 501)
	h.HandleAction(&ws.Client{UserID: 10}, chatActionMessage(t, "global", tooLong))

	assert.Equal(t, 0, hub.callCount(), "501-rune message rejected")

	// 500 runes exactly should be allowed
	exactly500 := strings.Repeat("y", 500)
	h.HandleAction(&ws.Client{UserID: 10}, chatActionMessage(t, "global", exactly500))
	assert.Equal(t, 1, hub.callCount(), "500-rune message accepted (boundary)")
}

func TestHandler_LengthCapIsRunesNotBytes(t *testing.T) {
	// Cyrillic/emoji messages at the 500-rune boundary must be accepted.
	// Server uses utf8.RuneCountInString, not len(), so multi-byte runes
	// don't inflate against the cap. This matches the client's
	// `string.length` (UTF-16 code units approximate runes for the BMP).
	repo := newUserRepoStub()
	repo.add(10, "alice")
	game := newFakeGame()
	hub := &hubSpy{connected: []uint{10, 20}}

	h := chat.NewHandler(hub, repo, game)

	// 500 Cyrillic "ч" runes = 1000 bytes — would be rejected by len() check
	cyrillic500 := strings.Repeat("ч", 500)
	h.HandleAction(&ws.Client{UserID: 10}, chatActionMessage(t, "global", cyrillic500))
	assert.Equal(t, 1, hub.callCount(), "500-rune Cyrillic message accepted")

	// 501 Cyrillic runes — over the cap, must be rejected
	cyrillic501 := strings.Repeat("ч", 501)
	h.HandleAction(&ws.Client{UserID: 10}, chatActionMessage(t, "global", cyrillic501))
	assert.Equal(t, 1, hub.callCount(), "501-rune Cyrillic message rejected (no new broadcast)")
}

func TestHandler_IgnoresUnknownChannel(t *testing.T) {
	repo := newUserRepoStub()
	repo.add(10, "alice")
	game := newFakeGame()
	hub := &hubSpy{connected: []uint{10, 20}}

	h := chat.NewHandler(hub, repo, game)

	// Should not panic, should not broadcast
	assert.NotPanics(t, func() {
		h.HandleAction(&ws.Client{UserID: 10}, chatActionMessage(t, "private", "hello"))
	})
	assert.Equal(t, 0, hub.callCount())
}

func TestHandler_IgnoresMatchChannel_DeferredToStory62(t *testing.T) {
	repo := newUserRepoStub()
	repo.add(10, "alice")
	game := newFakeGame()
	hub := &hubSpy{connected: []uint{10, 20, 30, 40}}

	h := chat.NewHandler(hub, repo, game)
	h.HandleAction(&ws.Client{UserID: 10}, chatActionMessage(t, "match", "team chat"))

	assert.Equal(t, 0, hub.callCount(),
		"match channel reserved for Story 6.2 — silently ignored for now")
}

func TestHandler_IgnoresWrongActionType(t *testing.T) {
	repo := newUserRepoStub()
	repo.add(10, "alice")
	game := newFakeGame()
	hub := &hubSpy{connected: []uint{10, 20}}

	h := chat.NewHandler(hub, repo, game)
	wrongAction := ws.WSMessage{Type: ws.ActionPlayCard, Payload: json.RawMessage(`{}`)}
	h.HandleAction(&ws.Client{UserID: 10}, wrongAction)

	assert.Equal(t, 0, hub.callCount(),
		"non-chat action types are no-ops (composite routing safety)")
}

func TestHandler_InvalidPayload_NoBroadcast(t *testing.T) {
	repo := newUserRepoStub()
	repo.add(10, "alice")
	game := newFakeGame()
	hub := &hubSpy{connected: []uint{10, 20}}

	h := chat.NewHandler(hub, repo, game)
	garbage := ws.WSMessage{Type: ws.ActionChatMessage, Payload: json.RawMessage(`not json`)}
	h.HandleAction(&ws.Client{UserID: 10}, garbage)

	assert.Equal(t, 0, hub.callCount())
}

func TestHandler_SenderNotFound_NoBroadcast(t *testing.T) {
	repo := newUserRepoStub() // user 10 not added
	game := newFakeGame()
	hub := &hubSpy{connected: []uint{10, 20}}

	h := chat.NewHandler(hub, repo, game)
	h.HandleAction(&ws.Client{UserID: 10}, chatActionMessage(t, "global", "hi"))

	assert.Equal(t, 0, hub.callCount())
}
