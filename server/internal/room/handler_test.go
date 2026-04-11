package room_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/emilijan/belote/server/internal/apperr"
	"github.com/emilijan/belote/server/internal/auth"
	"github.com/emilijan/belote/server/internal/room"
)

// --- Mock Repository ---

type mockRoomRepo struct {
	rooms      []*room.Room
	players    []*room.RoomPlayer
	nextID     uint
	nextPID    uint
}

func newMockRoomRepo() *mockRoomRepo {
	return &mockRoomRepo{nextID: 1, nextPID: 1}
}

func (m *mockRoomRepo) Create(r *room.Room) error {
	for _, existing := range m.rooms {
		if existing.Name == r.Name {
			return apperr.ErrRoomNameTaken
		}
	}
	r.ID = m.nextID
	r.CreatedAt = time.Now()
	r.UpdatedAt = time.Now()
	m.nextID++
	m.rooms = append(m.rooms, r)
	return nil
}

func (m *mockRoomRepo) Update(r *room.Room) error {
	for i, existing := range m.rooms {
		if existing.ID == r.ID {
			m.rooms[i] = r
			return nil
		}
	}
	return nil
}

func (m *mockRoomRepo) FindByID(id uint) (*room.Room, error) {
	for _, r := range m.rooms {
		if r.ID == id {
			return r, nil
		}
	}
	return nil, nil
}

func (m *mockRoomRepo) FindByStatus(status string) ([]room.Room, error) {
	var result []room.Room
	for _, r := range m.rooms {
		if r.Status == status {
			result = append(result, *r)
		}
	}
	if result == nil {
		result = []room.Room{}
	}
	return result, nil
}

func (m *mockRoomRepo) AddPlayer(p *room.RoomPlayer) error {
	for _, existing := range m.players {
		if existing.RoomID == p.RoomID && existing.UserID == p.UserID {
			return apperr.ErrAlreadyInRoom
		}
	}
	p.ID = m.nextPID
	p.CreatedAt = time.Now()
	m.nextPID++
	m.players = append(m.players, p)
	return nil
}

func (m *mockRoomRepo) RemovePlayer(roomID uint, userID uint) error {
	for i, p := range m.players {
		if p.RoomID == roomID && p.UserID == userID {
			m.players = append(m.players[:i], m.players[i+1:]...)
			return nil
		}
	}
	return apperr.ErrNotInRoom
}

func (m *mockRoomRepo) FindPlayersByRoomID(roomID uint) ([]room.RoomPlayer, error) {
	var result []room.RoomPlayer
	for _, p := range m.players {
		if p.RoomID == roomID {
			result = append(result, *p)
		}
	}
	if result == nil {
		result = []room.RoomPlayer{}
	}
	return result, nil
}

func (m *mockRoomRepo) FindPlayerRoom(userID uint) (*room.RoomPlayer, error) {
	for _, p := range m.players {
		for _, r := range m.rooms {
			if r.ID == p.RoomID && r.Status == "waiting" && p.UserID == userID {
				return p, nil
			}
		}
	}
	return nil, nil
}

func (m *mockRoomRepo) IncrementPlayerCount(roomID uint) error {
	for _, r := range m.rooms {
		if r.ID == roomID {
			r.PlayerCount++
			return nil
		}
	}
	return nil
}

func (m *mockRoomRepo) DecrementPlayerCount(roomID uint) error {
	for _, r := range m.rooms {
		if r.ID == roomID && r.PlayerCount > 0 {
			r.PlayerCount--
			return nil
		}
	}
	return nil
}

func (m *mockRoomRepo) UpdatePlayerSeat(roomID uint, userID uint, seat int, team string) error {
	for _, p := range m.players {
		if p.RoomID == roomID && p.UserID == userID {
			p.Seat = &seat
			p.Team = &team
			return nil
		}
	}
	return apperr.ErrNotInRoom
}

func (m *mockRoomRepo) ClearPlayerSeat(roomID uint, userID uint) error {
	for _, p := range m.players {
		if p.RoomID == roomID && p.UserID == userID {
			p.Seat = nil
			p.Team = nil
			return nil
		}
	}
	return apperr.ErrNotInRoom
}

func (m *mockRoomRepo) FindPlayerBySeat(roomID uint, seat int) (*room.RoomPlayer, error) {
	for _, p := range m.players {
		if p.RoomID == roomID && p.Seat != nil && *p.Seat == seat {
			return p, nil
		}
	}
	return nil, nil
}

func (m *mockRoomRepo) RunInTransaction(fn func(room.RoomRepository) error) error {
	return fn(m)
}

// --- Test Infrastructure ---

func testErrorHandler(err error, c echo.Context) {
	if c.Response().Committed {
		return
	}

	var appErr *apperr.AppError
	if errors.As(err, &appErr) {
		_ = c.JSON(appErr.Status, map[string]interface{}{
			"error": map[string]string{
				"code":    appErr.Code,
				"message": appErr.Message,
			},
		})
		return
	}

	_ = c.JSON(http.StatusInternalServerError, map[string]interface{}{
		"error": map[string]string{
			"code":    "INTERNAL_ERROR",
			"message": "An internal error occurred",
		},
	})
}

func setupTest() (*echo.Echo, *mockRoomRepo) {
	repo := newMockRoomRepo()
	handler := room.NewRoomHandler(repo)

	e := echo.New()
	e.HTTPErrorHandler = testErrorHandler
	api := e.Group("/api/v1", auth.AuthMiddleware("test-jwt-secret"))
	api.POST("/rooms", handler.CreateRoom)
	api.GET("/rooms", handler.ListRooms)
	api.GET("/rooms/:id", handler.GetRoom)
	api.POST("/rooms/:id/join", handler.JoinRoom)
	api.POST("/rooms/:id/leave", handler.LeaveRoom)
	api.POST("/rooms/:id/seat", handler.SelectSeat)
	api.POST("/rooms/:id/start", handler.StartGame)

	return e, repo
}

func doCreateRoom(e *echo.Echo, body string, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/rooms", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func validToken(userID uint) string {
	token, _ := auth.GenerateAccessToken(userID, "test-jwt-secret")
	return token
}

// --- Tests ---

func TestCreateRoom_Success(t *testing.T) {
	e, _ := setupTest()
	token := validToken(5)

	body := `{"name":"Zagreb Ekipa","variant":"bitola","matchMode":"1001","timerStyle":"relaxed"}`
	rec := doCreateRoom(e, body, token)

	assert.Equal(t, http.StatusCreated, rec.Code)

	var resp map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))

	var data room.Room
	require.NoError(t, json.Unmarshal(resp["data"], &data))

	assert.Equal(t, uint(1), data.ID)
	assert.Equal(t, "Zagreb Ekipa", data.Name)
	assert.Equal(t, uint(5), data.OwnerID)
	assert.Equal(t, "bitola", data.Variant)
	assert.Equal(t, "1001", data.MatchMode)
	assert.Equal(t, "relaxed", data.TimerStyle)
	assert.Nil(t, data.TimerDurationSeconds)
	assert.Equal(t, "waiting", data.Status)
	assert.Equal(t, 1, data.PlayerCount)
	assert.Len(t, data.Code, 6)
}

func TestCreateRoom_WithDefaults(t *testing.T) {
	e, _ := setupTest()
	token := validToken(1)

	body := `{"name":"My Room"}`
	rec := doCreateRoom(e, body, token)

	assert.Equal(t, http.StatusCreated, rec.Code)

	var resp map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))

	var data room.Room
	require.NoError(t, json.Unmarshal(resp["data"], &data))

	assert.Equal(t, "bitola", data.Variant)
	assert.Equal(t, "1001", data.MatchMode)
	assert.Equal(t, "relaxed", data.TimerStyle)
	assert.Nil(t, data.TimerDurationSeconds)
}

func TestCreateRoom_EmptyName(t *testing.T) {
	e, _ := setupTest()
	token := validToken(1)

	body := `{"name":""}`
	rec := doCreateRoom(e, body, token)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "ROOM_NAME_REQUIRED", errResp["error"]["code"])
}

func TestCreateRoom_WhitespaceOnlyName(t *testing.T) {
	e, _ := setupTest()
	token := validToken(1)

	body := `{"name":"   "}`
	rec := doCreateRoom(e, body, token)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "ROOM_NAME_REQUIRED", errResp["error"]["code"])
}

func TestCreateRoom_DuplicateName(t *testing.T) {
	e, _ := setupTest()
	token := validToken(1)

	body := `{"name":"Duplicate Room"}`
	rec := doCreateRoom(e, body, token)
	assert.Equal(t, http.StatusCreated, rec.Code)

	rec2 := doCreateRoom(e, body, token)
	assert.Equal(t, http.StatusConflict, rec2.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec2.Body.Bytes(), &errResp))
	assert.Equal(t, "ROOM_NAME_TAKEN", errResp["error"]["code"])
}

func TestCreateRoom_OwnerIDFromAuth(t *testing.T) {
	e, repo := setupTest()
	token := validToken(42)

	body := `{"name":"Owner Test Room"}`
	rec := doCreateRoom(e, body, token)

	assert.Equal(t, http.StatusCreated, rec.Code)
	require.Len(t, repo.rooms, 1)
	assert.Equal(t, uint(42), repo.rooms[0].OwnerID)
}

func TestCreateRoom_CodeFormat(t *testing.T) {
	e, _ := setupTest()
	token := validToken(1)

	body := `{"name":"Code Test Room"}`
	rec := doCreateRoom(e, body, token)

	assert.Equal(t, http.StatusCreated, rec.Code)

	var resp map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))

	var data room.Room
	require.NoError(t, json.Unmarshal(resp["data"], &data))

	assert.Len(t, data.Code, 6)
	for _, ch := range data.Code {
		assert.Contains(t, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", string(ch),
			"room code should only contain allowed characters")
	}
}

func TestCreateRoom_Unauthorized(t *testing.T) {
	e, _ := setupTest()

	body := `{"name":"No Auth Room"}`
	rec := doCreateRoom(e, body, "")

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestCreateRoom_PerMoveTimerWithDuration(t *testing.T) {
	e, _ := setupTest()
	token := validToken(1)

	body := `{"name":"Timer Room","timerStyle":"per-move","timerDurationSeconds":45}`
	rec := doCreateRoom(e, body, token)

	assert.Equal(t, http.StatusCreated, rec.Code)

	var resp map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))

	var data room.Room
	require.NoError(t, json.Unmarshal(resp["data"], &data))

	assert.Equal(t, "per-move", data.TimerStyle)
	require.NotNil(t, data.TimerDurationSeconds)
	assert.Equal(t, 45, *data.TimerDurationSeconds)
}

func TestCreateRoom_RelaxedTimerNullsDuration(t *testing.T) {
	e, _ := setupTest()
	token := validToken(1)

	body := `{"name":"Relaxed Room","timerStyle":"relaxed","timerDurationSeconds":30}`
	rec := doCreateRoom(e, body, token)

	assert.Equal(t, http.StatusCreated, rec.Code)

	var resp map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))

	var data room.Room
	require.NoError(t, json.Unmarshal(resp["data"], &data))

	assert.Equal(t, "relaxed", data.TimerStyle)
	assert.Nil(t, data.TimerDurationSeconds)
}

func TestCreateRoom_NameTooLong(t *testing.T) {
	e, _ := setupTest()
	token := validToken(1)

	longName := strings.Repeat("a", 101)
	body := `{"name":"` + longName + `"}`
	rec := doCreateRoom(e, body, token)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "ROOM_NAME_TOO_LONG", errResp["error"]["code"])
}

func TestCreateRoom_InvalidVariant(t *testing.T) {
	e, _ := setupTest()
	token := validToken(1)

	body := `{"name":"Bad Variant","variant":"unknown"}`
	rec := doCreateRoom(e, body, token)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "INVALID_VARIANT", errResp["error"]["code"])
}

func TestCreateRoom_InvalidMatchMode(t *testing.T) {
	e, _ := setupTest()
	token := validToken(1)

	body := `{"name":"Bad Mode","matchMode":"999"}`
	rec := doCreateRoom(e, body, token)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "INVALID_MATCH_MODE", errResp["error"]["code"])
}

func TestCreateRoom_InvalidTimerStyle(t *testing.T) {
	e, _ := setupTest()
	token := validToken(1)

	body := `{"name":"Bad Timer","timerStyle":"turbo"}`
	rec := doCreateRoom(e, body, token)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "INVALID_TIMER_STYLE", errResp["error"]["code"])
}

func TestCreateRoom_PerMoveTimerWithoutDuration(t *testing.T) {
	e, _ := setupTest()
	token := validToken(1)

	body := `{"name":"No Duration","timerStyle":"per-move"}`
	rec := doCreateRoom(e, body, token)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "TIMER_DURATION_REQUIRED", errResp["error"]["code"])
}

func TestCreateRoom_TimerDurationTooLow(t *testing.T) {
	e, _ := setupTest()
	token := validToken(1)

	body := `{"name":"Low Timer","timerStyle":"per-move","timerDurationSeconds":5}`
	rec := doCreateRoom(e, body, token)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "TIMER_DURATION_OUT_OF_RANGE", errResp["error"]["code"])
}

func TestCreateRoom_TimerDurationTooHigh(t *testing.T) {
	e, _ := setupTest()
	token := validToken(1)

	body := `{"name":"High Timer","timerStyle":"per-move","timerDurationSeconds":999}`
	rec := doCreateRoom(e, body, token)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "TIMER_DURATION_OUT_OF_RANGE", errResp["error"]["code"])
}

// --- ListRooms Tests ---

func doListRooms(e *echo.Echo, query string, token string) *httptest.ResponseRecorder {
	url := "/api/v1/rooms"
	if query != "" {
		url += "?" + query
	}
	req := httptest.NewRequest(http.MethodGet, url, nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func seedRoom(repo *mockRoomRepo, name string, status string) {
	r := &room.Room{
		Name:        name,
		Code:        "ABC123",
		OwnerID:     1,
		Variant:     "bitola",
		MatchMode:   "1001",
		TimerStyle:  "relaxed",
		Status:      status,
		PlayerCount: 1,
	}
	r.ID = repo.nextID
	r.CreatedAt = time.Now()
	r.UpdatedAt = time.Now()
	repo.nextID++
	repo.rooms = append(repo.rooms, r)
}

func TestListRooms_DefaultsToWaiting(t *testing.T) {
	e, repo := setupTest()
	token := validToken(1)

	seedRoom(repo, "Open Room", "waiting")
	seedRoom(repo, "Full Room", "playing")

	rec := doListRooms(e, "", token)

	assert.Equal(t, http.StatusOK, rec.Code)

	var resp map[string][]room.Room
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))

	require.Len(t, resp["data"], 1)
	assert.Equal(t, "Open Room", resp["data"][0].Name)
}

func TestListRooms_RespectsStatusParam(t *testing.T) {
	e, repo := setupTest()
	token := validToken(1)

	seedRoom(repo, "Waiting Room", "waiting")
	seedRoom(repo, "Playing Room", "playing")

	rec := doListRooms(e, "status=playing", token)

	assert.Equal(t, http.StatusOK, rec.Code)

	var resp map[string][]room.Room
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))

	require.Len(t, resp["data"], 1)
	assert.Equal(t, "Playing Room", resp["data"][0].Name)
}

func TestListRooms_EmptyArrayNotNull(t *testing.T) {
	e, _ := setupTest()
	token := validToken(1)

	rec := doListRooms(e, "", token)

	assert.Equal(t, http.StatusOK, rec.Code)

	// Verify the raw JSON contains [] not null
	body := rec.Body.String()
	assert.Contains(t, body, `"data":[]`)
}

func TestListRooms_Unauthorized(t *testing.T) {
	e, _ := setupTest()

	rec := doListRooms(e, "", "")

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestListRooms_InvalidStatus(t *testing.T) {
	e, _ := setupTest()
	token := validToken(1)

	rec := doListRooms(e, "status=invalid", token)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "INVALID_ROOM_STATUS", errResp["error"]["code"])
}

// --- GetRoom Tests ---

func doGetRoom(e *echo.Echo, id string, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/rooms/"+id, nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func TestGetRoom_Success(t *testing.T) {
	e, repo := setupTest()
	token := validToken(1)

	seedRoom(repo, "Test Room", "waiting")
	repo.players = append(repo.players, &room.RoomPlayer{
		ID: 1, RoomID: 1, UserID: 1, Username: "player1", CreatedAt: time.Now(),
	})

	rec := doGetRoom(e, "1", token)

	assert.Equal(t, http.StatusOK, rec.Code)

	var resp map[string]room.RoomDetailResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))

	assert.Equal(t, "Test Room", resp["data"].Room.Name)
	require.Len(t, resp["data"].Players, 1)
	assert.Equal(t, uint(1), resp["data"].Players[0].UserID)
}

func TestGetRoom_NotFound(t *testing.T) {
	e, _ := setupTest()
	token := validToken(1)

	rec := doGetRoom(e, "999", token)

	assert.Equal(t, http.StatusNotFound, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "ROOM_NOT_FOUND", errResp["error"]["code"])
}

func TestGetRoom_EmptyPlayersArray(t *testing.T) {
	e, repo := setupTest()
	token := validToken(1)

	seedRoom(repo, "Empty Room", "waiting")

	rec := doGetRoom(e, "1", token)

	assert.Equal(t, http.StatusOK, rec.Code)

	body := rec.Body.String()
	assert.Contains(t, body, `"players":[]`)
}

func TestGetRoom_Unauthorized(t *testing.T) {
	e, _ := setupTest()

	rec := doGetRoom(e, "1", "")

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// --- JoinRoom Tests ---

func doJoinRoom(e *echo.Echo, id string, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/rooms/"+id+"/join", nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func TestJoinRoom_Success(t *testing.T) {
	e, repo := setupTest()
	token := validToken(10)

	seedRoom(repo, "Join Test", "waiting")

	rec := doJoinRoom(e, "1", token)

	assert.Equal(t, http.StatusOK, rec.Code)

	var resp map[string]room.Room
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.Equal(t, 2, resp["data"].PlayerCount)

	// Verify player was added
	require.Len(t, repo.players, 1)
	assert.Equal(t, uint(10), repo.players[0].UserID)
}

func TestJoinRoom_NotFound(t *testing.T) {
	e, _ := setupTest()
	token := validToken(1)

	rec := doJoinRoom(e, "999", token)

	assert.Equal(t, http.StatusNotFound, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "ROOM_NOT_FOUND", errResp["error"]["code"])
}

func TestJoinRoom_Full(t *testing.T) {
	e, repo := setupTest()
	token := validToken(10)

	seedRoom(repo, "Full Room", "waiting")
	repo.rooms[0].PlayerCount = 4

	rec := doJoinRoom(e, "1", token)

	assert.Equal(t, http.StatusConflict, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "ROOM_FULL", errResp["error"]["code"])
}

func TestJoinRoom_AlreadyInRoom(t *testing.T) {
	e, repo := setupTest()
	token := validToken(10)

	seedRoom(repo, "Room A", "waiting")
	repo.players = append(repo.players, &room.RoomPlayer{
		ID: 1, RoomID: 1, UserID: 10, CreatedAt: time.Now(),
	})

	seedRoom(repo, "Room B", "waiting")

	rec := doJoinRoom(e, "2", token)

	assert.Equal(t, http.StatusConflict, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "ALREADY_IN_ROOM", errResp["error"]["code"])
}

func TestJoinRoom_NotWaitingStatus(t *testing.T) {
	e, repo := setupTest()
	token := validToken(10)

	seedRoom(repo, "Playing Room", "playing")

	rec := doJoinRoom(e, "1", token)

	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestJoinRoom_Unauthorized(t *testing.T) {
	e, _ := setupTest()

	rec := doJoinRoom(e, "1", "")

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// --- LeaveRoom Tests ---

func doLeaveRoom(e *echo.Echo, id string, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/rooms/"+id+"/leave", nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func TestLeaveRoom_Success(t *testing.T) {
	e, repo := setupTest()
	token := validToken(10)

	seedRoom(repo, "Leave Test", "waiting")
	repo.rooms[0].PlayerCount = 2
	repo.players = append(repo.players,
		&room.RoomPlayer{ID: 1, RoomID: 1, UserID: 1, CreatedAt: time.Now()},
		&room.RoomPlayer{ID: 2, RoomID: 1, UserID: 10, CreatedAt: time.Now()},
	)

	rec := doLeaveRoom(e, "1", token)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, 1, repo.rooms[0].PlayerCount)
	require.Len(t, repo.players, 1)
}

func TestLeaveRoom_NotInRoom(t *testing.T) {
	e, repo := setupTest()
	token := validToken(10)

	seedRoom(repo, "Not In Room", "waiting")

	rec := doLeaveRoom(e, "1", token)

	assert.Equal(t, http.StatusNotFound, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "NOT_IN_ROOM", errResp["error"]["code"])
}

func TestLeaveRoom_OwnerTransfersOwnership(t *testing.T) {
	e, repo := setupTest()
	token := validToken(1) // user 1 is the owner (seedRoom sets OwnerID=1)

	seedRoom(repo, "Owner Leave", "waiting")
	repo.rooms[0].PlayerCount = 2
	repo.players = append(repo.players,
		&room.RoomPlayer{ID: 1, RoomID: 1, UserID: 1, CreatedAt: time.Now()},
		&room.RoomPlayer{ID: 2, RoomID: 1, UserID: 20, CreatedAt: time.Now().Add(time.Second)},
	)

	rec := doLeaveRoom(e, "1", token)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, uint(20), repo.rooms[0].OwnerID)
}

func TestLeaveRoom_OwnerAloneClosesRoom(t *testing.T) {
	e, repo := setupTest()
	token := validToken(1)

	seedRoom(repo, "Solo Owner", "waiting")
	repo.players = append(repo.players,
		&room.RoomPlayer{ID: 1, RoomID: 1, UserID: 1, CreatedAt: time.Now()},
	)

	rec := doLeaveRoom(e, "1", token)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "completed", repo.rooms[0].Status)
}

func TestLeaveRoom_Unauthorized(t *testing.T) {
	e, _ := setupTest()

	rec := doLeaveRoom(e, "1", "")

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// --- SelectSeat Tests ---

func doSelectSeat(e *echo.Echo, id string, body string, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/rooms/"+id+"/seat", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func intPtr(v int) *int { return &v }

func strPtr(v string) *string { return &v }

func seedRoomWithPlayers(repo *mockRoomRepo, name string, ownerID uint, playerIDs ...uint) *room.Room {
	r := &room.Room{
		Name:        name,
		Code:        "TEST01",
		OwnerID:     ownerID,
		Variant:     "bitola",
		MatchMode:   "1001",
		TimerStyle:  "relaxed",
		Status:      "waiting",
		PlayerCount: len(playerIDs),
	}
	r.ID = repo.nextID
	r.CreatedAt = time.Now()
	r.UpdatedAt = time.Now()
	repo.nextID++
	repo.rooms = append(repo.rooms, r)

	for _, uid := range playerIDs {
		p := &room.RoomPlayer{
			ID:        repo.nextPID,
			RoomID:    r.ID,
			UserID:    uid,
			Username:  "user" + string(rune('0'+uid%10)),
			CreatedAt: time.Now(),
		}
		repo.nextPID++
		repo.players = append(repo.players, p)
	}

	return r
}

func TestSelectSeat_Success(t *testing.T) {
	e, repo := setupTest()
	token := validToken(10)

	seedRoomWithPlayers(repo, "Seat Test", 1, 1, 10)

	rec := doSelectSeat(e, "1", `{"seat":0}`, token)

	assert.Equal(t, http.StatusOK, rec.Code)

	// Find the player and verify seat assignment
	for _, p := range repo.players {
		if p.UserID == 10 {
			require.NotNil(t, p.Seat)
			assert.Equal(t, 0, *p.Seat)
			require.NotNil(t, p.Team)
			assert.Equal(t, "red", *p.Team)
		}
	}
}

func TestSelectSeat_TeamDerivation(t *testing.T) {
	tests := []struct {
		seat int
		team string
	}{
		{0, "red"},
		{1, "blue"},
		{2, "red"},
		{3, "blue"},
	}

	for _, tc := range tests {
		t.Run("seat_"+string(rune('0'+tc.seat)), func(t *testing.T) {
			e, repo := setupTest()
			token := validToken(10)

			seedRoomWithPlayers(repo, "Team Test", 1, 1, 10)

			body := `{"seat":` + string(rune('0'+tc.seat)) + `}`
			rec := doSelectSeat(e, "1", body, token)

			assert.Equal(t, http.StatusOK, rec.Code)

			for _, p := range repo.players {
				if p.UserID == 10 && p.Team != nil {
					assert.Equal(t, tc.team, *p.Team)
				}
			}
		})
	}
}

func TestSelectSeat_Switching(t *testing.T) {
	e, repo := setupTest()
	token := validToken(10)

	seedRoomWithPlayers(repo, "Switch Test", 1, 1, 10)
	// Pre-assign player 10 to seat 0
	for _, p := range repo.players {
		if p.UserID == 10 {
			p.Seat = intPtr(0)
			p.Team = strPtr("red")
		}
	}

	rec := doSelectSeat(e, "1", `{"seat":3}`, token)

	assert.Equal(t, http.StatusOK, rec.Code)

	for _, p := range repo.players {
		if p.UserID == 10 {
			require.NotNil(t, p.Seat)
			assert.Equal(t, 3, *p.Seat)
			require.NotNil(t, p.Team)
			assert.Equal(t, "blue", *p.Team)
		}
	}
}

func TestSelectSeat_Taken(t *testing.T) {
	e, repo := setupTest()
	token := validToken(10)

	seedRoomWithPlayers(repo, "Taken Test", 1, 1, 10)
	// Player 1 already in seat 0
	for _, p := range repo.players {
		if p.UserID == 1 {
			p.Seat = intPtr(0)
			p.Team = strPtr("red")
		}
	}

	rec := doSelectSeat(e, "1", `{"seat":0}`, token)

	assert.Equal(t, http.StatusConflict, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "SEAT_TAKEN", errResp["error"]["code"])
}

func TestSelectSeat_InvalidSeatNumber(t *testing.T) {
	e, repo := setupTest()
	token := validToken(10)

	seedRoomWithPlayers(repo, "Invalid Seat", 1, 1, 10)

	rec := doSelectSeat(e, "1", `{"seat":5}`, token)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "INVALID_SEAT", errResp["error"]["code"])
}

func TestSelectSeat_NegativeSeat(t *testing.T) {
	e, repo := setupTest()
	token := validToken(10)

	seedRoomWithPlayers(repo, "Neg Seat", 1, 1, 10)

	rec := doSelectSeat(e, "1", `{"seat":-1}`, token)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "INVALID_SEAT", errResp["error"]["code"])
}

func TestSelectSeat_MissingSeat(t *testing.T) {
	e, repo := setupTest()
	token := validToken(10)

	seedRoomWithPlayers(repo, "Missing Seat", 1, 1, 10)

	rec := doSelectSeat(e, "1", `{}`, token)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "INVALID_SEAT", errResp["error"]["code"])
}

func TestSelectSeat_NotInRoom(t *testing.T) {
	e, repo := setupTest()
	token := validToken(99) // user 99 not in room

	seedRoomWithPlayers(repo, "Not In Room", 1, 1, 10)

	rec := doSelectSeat(e, "1", `{"seat":0}`, token)

	assert.Equal(t, http.StatusNotFound, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "NOT_IN_ROOM", errResp["error"]["code"])
}

func TestSelectSeat_RoomNotWaiting(t *testing.T) {
	e, repo := setupTest()
	token := validToken(10)

	seedRoomWithPlayers(repo, "In Progress", 1, 1, 10)
	repo.rooms[0].Status = "in_progress"

	rec := doSelectSeat(e, "1", `{"seat":0}`, token)

	assert.Equal(t, http.StatusConflict, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "GAME_NOT_STARTABLE", errResp["error"]["code"])
}

func TestSelectSeat_OwnCurrentSeat(t *testing.T) {
	e, repo := setupTest()
	token := validToken(10)

	seedRoomWithPlayers(repo, "No-op Test", 1, 1, 10)
	// Player 10 already in seat 2
	for _, p := range repo.players {
		if p.UserID == 10 {
			p.Seat = intPtr(2)
			p.Team = strPtr("red")
		}
	}

	rec := doSelectSeat(e, "1", `{"seat":2}`, token)

	assert.Equal(t, http.StatusOK, rec.Code)

	// Seat should remain unchanged
	for _, p := range repo.players {
		if p.UserID == 10 {
			require.NotNil(t, p.Seat)
			assert.Equal(t, 2, *p.Seat)
		}
	}
}

func TestSelectSeat_Unauthorized(t *testing.T) {
	e, _ := setupTest()

	rec := doSelectSeat(e, "1", `{"seat":0}`, "")

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// --- StartGame Tests ---

func doStartGame(e *echo.Echo, id string, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/rooms/"+id+"/start", nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func TestStartGame_Success(t *testing.T) {
	e, repo := setupTest()
	token := validToken(1) // owner

	seedRoomWithPlayers(repo, "Start Test", 1, 1, 2, 3, 4)
	// Seat all 4 players
	seats := []int{0, 1, 2, 3}
	teams := []string{"red", "blue", "red", "blue"}
	for i, p := range repo.players {
		p.Seat = intPtr(seats[i])
		p.Team = strPtr(teams[i])
	}

	rec := doStartGame(e, "1", token)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "playing", repo.rooms[0].Status)

	var resp map[string]room.Room
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.Equal(t, "playing", resp["data"].Status)
}

func TestStartGame_NotOwner(t *testing.T) {
	e, repo := setupTest()
	token := validToken(10) // not the owner

	seedRoomWithPlayers(repo, "Not Owner", 1, 1, 10, 3, 4)
	for i, p := range repo.players {
		p.Seat = intPtr(i)
		teams := []string{"red", "blue", "red", "blue"}
		p.Team = strPtr(teams[i])
	}

	rec := doStartGame(e, "1", token)

	assert.Equal(t, http.StatusForbidden, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "NOT_ROOM_OWNER", errResp["error"]["code"])
}

func TestStartGame_NotAllSeated(t *testing.T) {
	e, repo := setupTest()
	token := validToken(1)

	seedRoomWithPlayers(repo, "Not All Seated", 1, 1, 2, 3, 4)
	// Only seat 2 out of 4
	repo.players[0].Seat = intPtr(0)
	repo.players[0].Team = strPtr("red")
	repo.players[1].Seat = intPtr(1)
	repo.players[1].Team = strPtr("blue")

	rec := doStartGame(e, "1", token)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "NOT_ALL_SEATED", errResp["error"]["code"])
}

func TestStartGame_RoomNotWaiting(t *testing.T) {
	e, repo := setupTest()
	token := validToken(1)

	seedRoomWithPlayers(repo, "Already Started", 1, 1, 2, 3, 4)
	repo.rooms[0].Status = "in_progress"

	rec := doStartGame(e, "1", token)

	assert.Equal(t, http.StatusConflict, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "GAME_NOT_STARTABLE", errResp["error"]["code"])
}

func TestStartGame_RoomNotFound(t *testing.T) {
	e, _ := setupTest()
	token := validToken(1)

	rec := doStartGame(e, "999", token)

	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestStartGame_Unauthorized(t *testing.T) {
	e, _ := setupTest()

	rec := doStartGame(e, "1", "")

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}
