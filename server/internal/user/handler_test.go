package user_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/emilijan/belote/server/internal/apperr"
	"github.com/emilijan/belote/server/internal/auth"
	"github.com/emilijan/belote/server/internal/match"
	"github.com/emilijan/belote/server/internal/user"
)

// --- Mock Match Repository (for user handler tests) ---

type mockMatchRepo struct {
	matches []match.Match // newest first (by completed_at); seeded in test order
	err     error

	// Stats-path overrides — when statsOverride is non-nil, GetStatsForUser
	// returns these values regardless of r.matches. This lets the handler
	// test drive the stats branch without seeding full Match rows.
	statsOverride   *struct{ wins, losses, abandoned int }
	statsErr        error
	getStatsCalls   int
	lastStatsUserID uint
}

func newMockMatchRepo() *mockMatchRepo {
	return &mockMatchRepo{}
}

func (r *mockMatchRepo) Create(*match.Match) error { return nil }

func (r *mockMatchRepo) CreateWithHands(*match.Match, []match.HandResult) error { return nil }

func (r *mockMatchRepo) GetMatchesForUser(userID uint, limit, offset int) ([]match.Match, int64, error) {
	if r.err != nil {
		return nil, 0, r.err
	}
	var filtered []match.Match
	for _, m := range r.matches {
		if m.Status != "completed" && m.Status != "abandoned" {
			continue
		}
		if m.Player1ID == userID || m.Player2ID == userID || m.Player3ID == userID || m.Player4ID == userID {
			filtered = append(filtered, m)
		}
	}
	// Mirror the production query's ORDER BY completed_at DESC, id DESC so
	// tests assert behaviour against the real ordering contract.
	sort.SliceStable(filtered, func(i, j int) bool {
		if !filtered[i].CompletedAt.Equal(filtered[j].CompletedAt) {
			return filtered[i].CompletedAt.After(filtered[j].CompletedAt)
		}
		return filtered[i].ID > filtered[j].ID
	})
	total := int64(len(filtered))
	if offset >= len(filtered) {
		return []match.Match{}, total, nil
	}
	end := offset + limit
	if end > len(filtered) {
		end = len(filtered)
	}
	return filtered[offset:end], total, nil
}

// GetStatsForUser returns the test-controlled stats override if set, else
// computes the four counts from seeded matches using the same predicate as
// the production SQL (participation by any seat; team derived from viewer's
// seat). Tracks call count + last userID so auth-failure tests can assert
// the stats path was NOT invoked.
func (r *mockMatchRepo) GetStatsForUser(userID uint) (int, int, int, error) {
	r.getStatsCalls++
	r.lastStatsUserID = userID
	if r.statsErr != nil {
		return 0, 0, 0, r.statsErr
	}
	if r.statsOverride != nil {
		return r.statsOverride.wins, r.statsOverride.losses, r.statsOverride.abandoned, nil
	}
	var wins, losses, abandoned int
	for _, m := range r.matches {
		seats := [4]uint{m.Player1ID, m.Player2ID, m.Player3ID, m.Player4ID}
		viewerSeat := -1
		for i, id := range seats {
			if id == userID {
				viewerSeat = i
				break
			}
		}
		if viewerSeat == -1 {
			continue
		}
		switch m.Status {
		case "abandoned":
			abandoned++
		case "completed":
			if m.WinnerTeam == viewerSeat%2 {
				wins++
			} else {
				losses++
			}
		}
	}
	return wins, losses, abandoned, nil
}

type mockUserRepo struct {
	users  []*user.User
	nextID uint
}

func newMockUserRepo() *mockUserRepo {
	return &mockUserRepo{nextID: 1}
}

func (m *mockUserRepo) Create(u *user.User) error {
	u.ID = m.nextID
	u.CreatedAt = time.Now()
	m.nextID++
	m.users = append(m.users, u)
	return nil
}

func (m *mockUserRepo) FindByEmail(email string) (*user.User, error) {
	for _, u := range m.users {
		if u.Email == email {
			return u, nil
		}
	}
	return nil, nil
}

func (m *mockUserRepo) FindByUsername(username string) (*user.User, error) {
	for _, u := range m.users {
		if u.Username == username {
			return u, nil
		}
	}
	return nil, nil
}

func (m *mockUserRepo) FindByID(id uint) (*user.User, error) {
	for _, u := range m.users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, nil
}

func (m *mockUserRepo) FindManyByIDs(ids []uint) ([]user.User, error) {
	if len(ids) == 0 {
		return []user.User{}, nil
	}
	wanted := make(map[uint]struct{}, len(ids))
	for _, id := range ids {
		wanted[id] = struct{}{}
	}
	out := make([]user.User, 0, len(ids))
	for _, u := range m.users {
		if _, ok := wanted[u.ID]; ok {
			out = append(out, *u)
		}
	}
	return out, nil
}

func (m *mockUserRepo) UpdateLanguagePreference(id uint, lang string) error {
	for _, u := range m.users {
		if u.ID == id {
			u.LanguagePreference = lang
			return nil
		}
	}
	return gorm.ErrRecordNotFound
}

func (m *mockUserRepo) addUser(username, email, lang string) *user.User {
	u := &user.User{
		ID:                 m.nextID,
		Username:           username,
		Email:              email,
		LanguagePreference: lang,
		CreatedAt:          time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
	}
	m.nextID++
	m.users = append(m.users, u)
	return u
}

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

const testJWTSecret = "test-jwt-secret"

func setupUserHandler() (*mockUserRepo, *echo.Echo) {
	repo, _, e := setupUserHandlerWithMatches()
	return repo, e
}

func setupUserHandlerWithMatches() (*mockUserRepo, *mockMatchRepo, *echo.Echo) {
	repo := newMockUserRepo()
	matchRepo := newMockMatchRepo()
	handler := user.NewUserHandler(repo, matchRepo)
	e := echo.New()
	e.HTTPErrorHandler = testErrorHandler

	api := e.Group("/api/v1", auth.AuthMiddleware(testJWTSecret))
	api.GET("/users/:id/profile", handler.GetProfile)
	api.GET("/users/:id/matches", handler.ListMatches)
	api.PATCH("/users/:id/preferences", handler.UpdatePreferences)

	return repo, matchRepo, e
}

func doGetProfile(e *echo.Echo, userID string, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/"+userID+"/profile", nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func doUpdatePreferences(e *echo.Echo, userID string, body string, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPatch, "/api/v1/users/"+userID+"/preferences", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func TestGetProfile_Success(t *testing.T) {
	repo, e := setupUserHandler()
	u := repo.addUser("testuser", "test@example.com", "en")

	token, err := auth.GenerateAccessToken(u.ID, testJWTSecret)
	require.NoError(t, err)

	rec := doGetProfile(e, "1", token)
	assert.Equal(t, http.StatusOK, rec.Code)

	var resp map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))

	var data user.ProfileResponse
	require.NoError(t, json.Unmarshal(resp["data"], &data))

	assert.Equal(t, uint(1), data.ID)
	assert.Equal(t, "testuser", data.Username)
	assert.Equal(t, "en", data.LanguagePreference)
	assert.NotEmpty(t, data.CreatedAt)
}

func TestGetProfile_UserNotFound(t *testing.T) {
	_, e := setupUserHandler()

	token, err := auth.GenerateAccessToken(99, testJWTSecret)
	require.NoError(t, err)

	rec := doGetProfile(e, "99", token)
	assert.Equal(t, http.StatusNotFound, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "USER_NOT_FOUND", errResp["error"]["code"])
}

func TestGetProfile_Forbidden(t *testing.T) {
	repo, e := setupUserHandler()
	repo.addUser("testuser", "test@example.com", "en")
	repo.addUser("otheruser", "other@example.com", "en")

	token, err := auth.GenerateAccessToken(1, testJWTSecret)
	require.NoError(t, err)

	rec := doGetProfile(e, "2", token)
	assert.Equal(t, http.StatusForbidden, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "FORBIDDEN", errResp["error"]["code"])
}

func TestGetProfile_MissingAuth(t *testing.T) {
	_, e := setupUserHandler()

	rec := doGetProfile(e, "1", "")
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestUpdatePreferences_Success(t *testing.T) {
	repo, e := setupUserHandler()
	u := repo.addUser("testuser", "test@example.com", "en")

	token, err := auth.GenerateAccessToken(u.ID, testJWTSecret)
	require.NoError(t, err)

	rec := doUpdatePreferences(e, "1", `{"languagePreference":"sr"}`, token)
	assert.Equal(t, http.StatusOK, rec.Code)

	var resp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.Equal(t, "sr", resp["data"]["languagePreference"])

	assert.Equal(t, "sr", repo.users[0].LanguagePreference)
}

func TestUpdatePreferences_InvalidLanguage(t *testing.T) {
	repo, e := setupUserHandler()
	u := repo.addUser("testuser", "test@example.com", "en")

	token, err := auth.GenerateAccessToken(u.ID, testJWTSecret)
	require.NoError(t, err)

	rec := doUpdatePreferences(e, "1", `{"languagePreference":"fr"}`, token)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "INVALID_LANGUAGE", errResp["error"]["code"])
}

func TestUpdatePreferences_Forbidden(t *testing.T) {
	repo, e := setupUserHandler()
	repo.addUser("testuser", "test@example.com", "en")
	repo.addUser("otheruser", "other@example.com", "en")

	token, err := auth.GenerateAccessToken(1, testJWTSecret)
	require.NoError(t, err)

	rec := doUpdatePreferences(e, "2", `{"languagePreference":"sr"}`, token)
	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestUpdatePreferences_MissingAuth(t *testing.T) {
	_, e := setupUserHandler()

	rec := doUpdatePreferences(e, "1", `{"languagePreference":"sr"}`, "")
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// --- ListMatches tests (Story 7.1) ---

func doListMatches(e *echo.Echo, userID, query, token string) *httptest.ResponseRecorder {
	path := "/api/v1/users/" + userID + "/matches"
	if query != "" {
		path += "?" + query
	}
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func seedMatch(id uint, started, completed time.Time, seats [4]uint, status string, winnerTeam int, abandonedBy *uint, variant, mode string, a, b int, hands []match.HandResult) match.Match {
	return match.Match{
		ID:          id,
		RoomID:      id,
		Player1ID:   seats[0],
		Player2ID:   seats[1],
		Player3ID:   seats[2],
		Player4ID:   seats[3],
		TeamAScore:  a,
		TeamBScore:  b,
		WinnerTeam:  winnerTeam,
		Variant:     variant,
		MatchMode:   mode,
		StartedAt:   started,
		CompletedAt: completed,
		Status:      status,
		AbandonedBy: abandonedBy,
		Hands:       hands,
	}
}

func decodeMatchesResponse(t *testing.T, body []byte) user.MatchesListResponse {
	t.Helper()
	var resp struct {
		Data user.MatchesListResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(body, &resp))
	return resp.Data
}

func TestListMatches_EmptyList(t *testing.T) {
	repo, _, e := setupUserHandlerWithMatches()
	u := repo.addUser("alice", "alice@example.com", "en")

	token, err := auth.GenerateAccessToken(u.ID, testJWTSecret)
	require.NoError(t, err)

	rec := doListMatches(e, "1", "", token)
	assert.Equal(t, http.StatusOK, rec.Code)

	resp := decodeMatchesResponse(t, rec.Body.Bytes())
	assert.NotNil(t, resp.Items, "items must be an empty slice, not nil")
	assert.Len(t, resp.Items, 0)
	assert.Equal(t, int64(0), resp.Total)
	assert.Equal(t, 20, resp.Limit)
	assert.Equal(t, 0, resp.Offset)
}

func TestListMatches_WinLossAbandonedOutcomes(t *testing.T) {
	repo, matchRepo, e := setupUserHandlerWithMatches()
	viewer := repo.addUser("viewer", "v@example.com", "en")
	mate := repo.addUser("mate", "m@example.com", "en")
	opp1 := repo.addUser("opp1", "o1@example.com", "en")
	opp2 := repo.addUser("opp2", "o2@example.com", "en")

	// Viewer sits at seat 0 (team A). seats: [viewer, opp1, mate, opp2].
	seats := [4]uint{viewer.ID, opp1.ID, mate.ID, opp2.ID}
	base := time.Date(2026, 4, 1, 12, 0, 0, 0, time.UTC)

	// Completed, team A wins -> outcome "win".
	// Completed, team B wins -> outcome "loss".
	// Abandoned (regardless of winnerTeam) -> outcome "abandoned".
	abandoner := opp1.ID
	matchRepo.matches = []match.Match{
		seedMatch(1, base, base.Add(25*time.Minute), seats, "completed", 0, nil, "bitola", "1001", 1010, 640, nil),
		seedMatch(2, base.Add(-24*time.Hour), base.Add(-24*time.Hour).Add(31*time.Minute), seats, "completed", 1, nil, "bitola", "1001", 820, 1020, nil),
		seedMatch(3, base.Add(-48*time.Hour), base.Add(-48*time.Hour).Add(9*time.Minute), seats, "abandoned", 0, &abandoner, "bitola", "1001", 320, 410, nil),
	}

	token, err := auth.GenerateAccessToken(viewer.ID, testJWTSecret)
	require.NoError(t, err)

	rec := doListMatches(e, strconvUint(viewer.ID), "", token)
	assert.Equal(t, http.StatusOK, rec.Code)

	resp := decodeMatchesResponse(t, rec.Body.Bytes())
	require.Len(t, resp.Items, 3)
	assert.Equal(t, int64(3), resp.Total)

	// Outcomes ordered as seeded (mock returns insertion order).
	assert.Equal(t, "win", resp.Items[0].Outcome)
	assert.Equal(t, "loss", resp.Items[1].Outcome)
	assert.Equal(t, "abandoned", resp.Items[2].Outcome)

	// Viewer seat is always 0 in this setup.
	for _, item := range resp.Items {
		assert.Equal(t, 0, item.ViewerSeat)
		require.Len(t, item.Players, 4)
		// Seat-ordered 0..3.
		assert.Equal(t, 0, item.Players[0].Seat)
		assert.Equal(t, viewer.ID, item.Players[0].UserID)
		assert.Equal(t, "viewer", item.Players[0].Username)
		assert.Equal(t, "opp1", item.Players[1].Username)
		assert.Equal(t, "mate", item.Players[2].Username)
		assert.Equal(t, "opp2", item.Players[3].Username)
	}

	// Abandoned row carries abandonedBy.
	require.NotNil(t, resp.Items[2].AbandonedBy)
	assert.Equal(t, opp1.ID, *resp.Items[2].AbandonedBy)
}

func TestListMatches_PaginationBounds(t *testing.T) {
	repo, matchRepo, e := setupUserHandlerWithMatches()
	viewer := repo.addUser("viewer", "v@example.com", "en")
	_ = repo.addUser("p2", "p2@example.com", "en")
	_ = repo.addUser("p3", "p3@example.com", "en")
	_ = repo.addUser("p4", "p4@example.com", "en")

	seats := [4]uint{viewer.ID, 2, 3, 4}
	base := time.Date(2026, 4, 1, 12, 0, 0, 0, time.UTC)
	// Seed so completedAt descends as IDs ascend — the mock sorts by
	// completed_at DESC, id DESC (matching production), so after sorting the
	// page order is [1, 2, 3, 4, 5].
	for i := 1; i <= 5; i++ {
		completed := base.Add(time.Duration(60-10*i) * time.Minute)
		matchRepo.matches = append(matchRepo.matches, seedMatch(
			uint(i), base, completed, seats, "completed", 0, nil, "bitola", "1001", 1001, 500, nil,
		))
	}

	token, err := auth.GenerateAccessToken(viewer.ID, testJWTSecret)
	require.NoError(t, err)

	// total=5, limit=2, offset=2 -> items[2..3] (IDs 3, 4)
	rec := doListMatches(e, strconvUint(viewer.ID), "limit=2&offset=2", token)
	assert.Equal(t, http.StatusOK, rec.Code)
	resp := decodeMatchesResponse(t, rec.Body.Bytes())
	require.Len(t, resp.Items, 2)
	assert.Equal(t, int64(5), resp.Total)
	assert.Equal(t, 2, resp.Limit)
	assert.Equal(t, 2, resp.Offset)
	assert.Equal(t, uint(3), resp.Items[0].ID)
	assert.Equal(t, uint(4), resp.Items[1].ID)

	// offset past end -> empty items, total still 5
	rec = doListMatches(e, strconvUint(viewer.ID), "limit=2&offset=100", token)
	assert.Equal(t, http.StatusOK, rec.Code)
	resp = decodeMatchesResponse(t, rec.Body.Bytes())
	assert.Len(t, resp.Items, 0)
	assert.Equal(t, int64(5), resp.Total)
}

func TestListMatches_OrdersByCompletedAtDesc(t *testing.T) {
	repo, matchRepo, e := setupUserHandlerWithMatches()
	viewer := repo.addUser("viewer", "v@example.com", "en")
	_ = repo.addUser("p2", "p2@example.com", "en")
	_ = repo.addUser("p3", "p3@example.com", "en")
	_ = repo.addUser("p4", "p4@example.com", "en")

	seats := [4]uint{viewer.ID, 2, 3, 4}
	base := time.Date(2026, 4, 1, 12, 0, 0, 0, time.UTC)
	// Seed oldest first; the repo must reorder newest first.
	matchRepo.matches = []match.Match{
		seedMatch(10, base, base.Add(5*time.Minute), seats, "completed", 0, nil, "bitola", "1001", 1001, 500, nil),
		seedMatch(11, base.Add(1*time.Hour), base.Add(1*time.Hour+5*time.Minute), seats, "completed", 0, nil, "bitola", "1001", 1001, 500, nil),
		seedMatch(12, base.Add(2*time.Hour), base.Add(2*time.Hour+5*time.Minute), seats, "completed", 0, nil, "bitola", "1001", 1001, 500, nil),
	}

	token, err := auth.GenerateAccessToken(viewer.ID, testJWTSecret)
	require.NoError(t, err)

	rec := doListMatches(e, strconvUint(viewer.ID), "", token)
	assert.Equal(t, http.StatusOK, rec.Code)
	resp := decodeMatchesResponse(t, rec.Body.Bytes())
	require.Len(t, resp.Items, 3)
	// Newest completedAt first: 12, 11, 10.
	assert.Equal(t, uint(12), resp.Items[0].ID)
	assert.Equal(t, uint(11), resp.Items[1].ID)
	assert.Equal(t, uint(10), resp.Items[2].ID)
}

func TestListMatches_HandsEmbedded(t *testing.T) {
	repo, matchRepo, e := setupUserHandlerWithMatches()
	viewer := repo.addUser("viewer", "v@example.com", "en")
	_ = repo.addUser("p2", "p2@example.com", "en")
	_ = repo.addUser("p3", "p3@example.com", "en")
	_ = repo.addUser("p4", "p4@example.com", "en")

	seats := [4]uint{viewer.ID, 2, 3, 4}
	base := time.Date(2026, 4, 1, 12, 0, 0, 0, time.UTC)
	capotTeam := 1
	hands := []match.HandResult{
		{HandNumber: 1, TeamACardPoints: 60, TeamBCardPoints: 102, TeamADeclPoints: 20, TeamBDeclPoints: 0,
			LastTrickTeam: 1, LastTrickBonus: 10, Capot: false, CapotTeam: nil, CapotBonus: 0,
			FailedContract: false, ContractingTeam: 0, TeamAHandTotal: 80, TeamBHandTotal: 112},
		{HandNumber: 2, TeamACardPoints: 0, TeamBCardPoints: 162, TeamADeclPoints: 0, TeamBDeclPoints: 50,
			LastTrickTeam: 1, LastTrickBonus: 0, Capot: true, CapotTeam: &capotTeam, CapotBonus: 100,
			FailedContract: false, ContractingTeam: 1, TeamAHandTotal: 0, TeamBHandTotal: 312},
	}
	matchRepo.matches = []match.Match{
		seedMatch(1, base, base.Add(20*time.Minute), seats, "completed", 1, nil, "bitola", "1001", 80, 424, hands),
	}

	token, err := auth.GenerateAccessToken(viewer.ID, testJWTSecret)
	require.NoError(t, err)

	rec := doListMatches(e, strconvUint(viewer.ID), "", token)
	assert.Equal(t, http.StatusOK, rec.Code)
	resp := decodeMatchesResponse(t, rec.Body.Bytes())
	require.Len(t, resp.Items, 1)
	require.Len(t, resp.Items[0].Hands, 2)
	assert.Equal(t, 1, resp.Items[0].Hands[0].HandNumber)
	assert.False(t, resp.Items[0].Hands[0].Capot)
	assert.Equal(t, 2, resp.Items[0].Hands[1].HandNumber)
	assert.True(t, resp.Items[0].Hands[1].Capot)
	require.NotNil(t, resp.Items[0].Hands[1].CapotTeam)
	assert.Equal(t, 1, *resp.Items[0].Hands[1].CapotTeam)
	assert.Equal(t, "loss", resp.Items[0].Outcome, "viewer is team A, winner is team B -> loss")
}

func TestListMatches_Forbidden_ForeignUserID(t *testing.T) {
	repo, _, e := setupUserHandlerWithMatches()
	u := repo.addUser("alice", "alice@example.com", "en")

	token, err := auth.GenerateAccessToken(u.ID, testJWTSecret)
	require.NoError(t, err)

	rec := doListMatches(e, "999", "", token)
	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestListMatches_Unauthorized_NoToken(t *testing.T) {
	_, _, e := setupUserHandlerWithMatches()

	rec := doListMatches(e, "1", "", "")
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestListMatches_BadRequest_InvalidID(t *testing.T) {
	repo, _, e := setupUserHandlerWithMatches()
	u := repo.addUser("alice", "alice@example.com", "en")

	token, err := auth.GenerateAccessToken(u.ID, testJWTSecret)
	require.NoError(t, err)

	for _, pathID := range []string{"abc", "0"} {
		rec := doListMatches(e, pathID, "", token)
		assert.Equal(t, http.StatusBadRequest, rec.Code, "pathID %q should be 400", pathID)
	}
}

func TestListMatches_BadRequest_InvalidPagination(t *testing.T) {
	repo, _, e := setupUserHandlerWithMatches()
	u := repo.addUser("alice", "alice@example.com", "en")

	token, err := auth.GenerateAccessToken(u.ID, testJWTSecret)
	require.NoError(t, err)

	cases := []string{
		"limit=0",
		"limit=51",
		"limit=abc",
		"offset=-1",
		"offset=abc",
	}
	for _, q := range cases {
		rec := doListMatches(e, strconvUint(u.ID), q, token)
		assert.Equal(t, http.StatusBadRequest, rec.Code, "query %q should be 400", q)
	}
}

func TestListMatches_NoPIILeak(t *testing.T) {
	repo, matchRepo, e := setupUserHandlerWithMatches()
	viewer := repo.addUser("viewer", "viewer@example.com", "en")
	_ = repo.addUser("p2", "secret-email@example.com", "en")
	_ = repo.addUser("p3", "p3@example.com", "sr")
	_ = repo.addUser("p4", "p4@example.com", "en")

	seats := [4]uint{viewer.ID, 2, 3, 4}
	base := time.Date(2026, 4, 1, 12, 0, 0, 0, time.UTC)
	matchRepo.matches = []match.Match{
		seedMatch(1, base, base.Add(10*time.Minute), seats, "completed", 0, nil, "bitola", "1001", 1001, 500, nil),
	}

	token, err := auth.GenerateAccessToken(viewer.ID, testJWTSecret)
	require.NoError(t, err)

	rec := doListMatches(e, strconvUint(viewer.ID), "", token)
	assert.Equal(t, http.StatusOK, rec.Code)

	body := rec.Body.String()
	assert.NotContains(t, body, "secret-email@example.com", "email must never be in the matches response")
	assert.NotContains(t, body, "passwordHash")
	assert.NotContains(t, body, "languagePreference", "language preference must not leak into matches response")
}

func strconvUint(u uint) string { return strconv.FormatUint(uint64(u), 10) }

// --- Extended GetProfile with aggregate stats (Story 7.2) ---

func TestGetProfile_WithStats(t *testing.T) {
	cases := []struct {
		name     string
		wins     int
		losses   int
		aband    int
		expected int // totalGamesPlayed
	}{
		{"zero games", 0, 0, 0, 0},
		{"mixed outcomes", 7, 3, 1, 11},
		{"wins only", 4, 0, 0, 4},
		{"abandoned only", 0, 0, 2, 2},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo, matchRepo, e := setupUserHandlerWithMatches()
			u := repo.addUser("alice", "alice@example.com", "en")
			matchRepo.statsOverride = &struct{ wins, losses, abandoned int }{tc.wins, tc.losses, tc.aband}

			token, err := auth.GenerateAccessToken(u.ID, testJWTSecret)
			require.NoError(t, err)

			rec := doGetProfile(e, strconvUint(u.ID), token)
			require.Equal(t, http.StatusOK, rec.Code)

			var resp map[string]json.RawMessage
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
			var data user.ProfileResponse
			require.NoError(t, json.Unmarshal(resp["data"], &data))

			assert.Equal(t, tc.wins, data.Wins)
			assert.Equal(t, tc.losses, data.Losses)
			assert.Equal(t, tc.aband, data.Abandoned)
			assert.Equal(t, tc.expected, data.TotalGamesPlayed)
			// Invariant: total == wins + losses + abandoned.
			assert.Equal(t, data.Wins+data.Losses+data.Abandoned, data.TotalGamesPlayed,
				"totalGamesPlayed invariant")
			// Identity fields preserved.
			assert.Equal(t, u.ID, data.ID)
			assert.Equal(t, "alice", data.Username)
			assert.Equal(t, "en", data.LanguagePreference)
		})
	}
}

func TestGetProfile_StatsDBError(t *testing.T) {
	repo, matchRepo, e := setupUserHandlerWithMatches()
	// Distinctive email so any partial-payload leak is obvious in the 500 body.
	u := repo.addUser("alice", "alice-err-probe@example.com", "en")
	matchRepo.statsErr = errors.New("db boom")

	token, err := auth.GenerateAccessToken(u.ID, testJWTSecret)
	require.NoError(t, err)

	rec := doGetProfile(e, strconvUint(u.ID), token)
	assert.Equal(t, http.StatusInternalServerError, rec.Code,
		"DB error must surface as 500, not silently zeroed")

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "INTERNAL_ERROR", errResp["error"]["code"])

	// PII guard: the error-branch response body must not leak user fields either.
	body := rec.Body.String()
	assert.NotContains(t, body, "alice-err-probe@example.com", "email must never leak on 500")
	assert.NotContains(t, body, "\"email\"", "email field must not appear on 500")
	assert.NotContains(t, body, "passwordHash")
	assert.NotContains(t, body, "password_hash")
}

func TestGetProfile_NeverLeaksPII(t *testing.T) {
	repo, matchRepo, e := setupUserHandlerWithMatches()
	// Use a distinctive email so any leak is obvious in the response body.
	u := repo.addUser("alice", "alice-leak-probe@example.com", "en")
	matchRepo.statsOverride = &struct{ wins, losses, abandoned int }{3, 1, 0}

	token, err := auth.GenerateAccessToken(u.ID, testJWTSecret)
	require.NoError(t, err)

	rec := doGetProfile(e, strconvUint(u.ID), token)
	require.Equal(t, http.StatusOK, rec.Code)

	body := rec.Body.String()
	assert.NotContains(t, body, "alice-leak-probe@example.com", "email must never leak")
	assert.NotContains(t, body, "\"email\"", "email field must not appear")
	assert.NotContains(t, body, "passwordHash")
	assert.NotContains(t, body, "password_hash")
	assert.NotContains(t, body, "deletedAt")
}

func TestGetProfile_AuthFailures_DoNotCallStats(t *testing.T) {
	// 400 on bad id, 401 on missing token, 403 on foreign id — stats repo must
	// not be invoked because the auth check rejects before the stats call.
	t.Run("bad path id", func(t *testing.T) {
		repo, matchRepo, e := setupUserHandlerWithMatches()
		u := repo.addUser("alice", "alice@example.com", "en")
		token, err := auth.GenerateAccessToken(u.ID, testJWTSecret)
		require.NoError(t, err)

		rec := doGetProfile(e, "abc", token)
		assert.Equal(t, http.StatusBadRequest, rec.Code)
		assert.Zero(t, matchRepo.getStatsCalls, "stats must not be queried on 400")
	})

	t.Run("missing token", func(t *testing.T) {
		_, matchRepo, e := setupUserHandlerWithMatches()
		rec := doGetProfile(e, "1", "")
		assert.Equal(t, http.StatusUnauthorized, rec.Code)
		assert.Zero(t, matchRepo.getStatsCalls, "stats must not be queried on 401")
	})

	t.Run("foreign id", func(t *testing.T) {
		repo, matchRepo, e := setupUserHandlerWithMatches()
		repo.addUser("alice", "alice@example.com", "en")
		repo.addUser("bob", "bob@example.com", "en")
		token, err := auth.GenerateAccessToken(1, testJWTSecret)
		require.NoError(t, err)

		rec := doGetProfile(e, "2", token)
		assert.Equal(t, http.StatusForbidden, rec.Code)
		assert.Zero(t, matchRepo.getStatsCalls, "stats must not be queried on 403")
	})
}

// TestGetProfile_StatsMatchListTotal verifies the invariant from AC #2: the
// sum wins+losses+abandoned computed by GetStatsForUser matches the total
// returned by GetMatchesForUser for the same user, across a realistic seed.
// Uses the mock's seed-driven stats path (statsOverride not set) so both
// code paths exercise the same participation predicate.
func TestGetProfile_StatsMatchListTotal(t *testing.T) {
	repo, matchRepo, e := setupUserHandlerWithMatches()
	viewer := repo.addUser("viewer", "v@example.com", "en")
	p2 := repo.addUser("p2", "p2@example.com", "en")
	p3 := repo.addUser("p3", "p3@example.com", "en")
	p4 := repo.addUser("p4", "p4@example.com", "en")
	bystander := repo.addUser("bystander", "b@example.com", "en")

	// Viewer across multiple seats + team outcomes:
	//  - seat 0 (team A), completed, team A wins -> win
	//  - seat 0 (team A), completed, team B wins -> loss
	//  - seat 3 (team B), completed, team B wins -> win (exercises CASE at seat 3)
	//  - seat 2 (team A), abandoned -> abandoned
	//  - match not involving viewer (bystander-only) -> ignored in both paths
	base := time.Date(2026, 4, 10, 12, 0, 0, 0, time.UTC)
	abandoner := viewer.ID
	matchRepo.matches = []match.Match{
		seedMatch(1, base, base.Add(25*time.Minute),
			[4]uint{viewer.ID, p2.ID, p3.ID, p4.ID},
			"completed", 0, nil, "bitola", "1001", 1020, 640, nil),
		seedMatch(2, base.Add(-time.Hour), base.Add(-time.Hour+25*time.Minute),
			[4]uint{viewer.ID, p2.ID, p3.ID, p4.ID},
			"completed", 1, nil, "bitola", "1001", 500, 1020, nil),
		seedMatch(3, base.Add(-2*time.Hour), base.Add(-2*time.Hour+30*time.Minute),
			[4]uint{p2.ID, p3.ID, p4.ID, viewer.ID},
			"completed", 1, nil, "bitola", "1001", 600, 1050, nil),
		seedMatch(4, base.Add(-3*time.Hour), base.Add(-3*time.Hour+10*time.Minute),
			[4]uint{p2.ID, p3.ID, viewer.ID, p4.ID},
			"abandoned", 0, &abandoner, "bitola", "1001", 300, 400, nil),
		seedMatch(5, base.Add(-4*time.Hour), base.Add(-4*time.Hour+20*time.Minute),
			[4]uint{bystander.ID, p2.ID, p3.ID, p4.ID},
			"completed", 0, nil, "bitola", "1001", 1001, 500, nil),
	}

	token, err := auth.GenerateAccessToken(viewer.ID, testJWTSecret)
	require.NoError(t, err)

	// Hit /profile — drives GetStatsForUser and returns aggregate counts.
	profRec := doGetProfile(e, strconvUint(viewer.ID), token)
	require.Equal(t, http.StatusOK, profRec.Code)
	var resp map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(profRec.Body.Bytes(), &resp))
	var prof user.ProfileResponse
	require.NoError(t, json.Unmarshal(resp["data"], &prof))

	// Hit /matches — drives GetMatchesForUser and returns total count.
	matchRec := doListMatches(e, strconvUint(viewer.ID), "limit=50", token)
	require.Equal(t, http.StatusOK, matchRec.Code)
	matchResp := decodeMatchesResponse(t, matchRec.Body.Bytes())

	// AC #2 invariant: aggregate sum must equal matches total.
	assert.Equal(t, int64(prof.TotalGamesPlayed), matchResp.Total,
		"totalGamesPlayed must equal /matches total for same user")
	assert.Equal(t, prof.Wins+prof.Losses+prof.Abandoned, prof.TotalGamesPlayed)

	// Expected by construction: 2 wins, 1 loss, 1 abandoned, bystander ignored.
	assert.Equal(t, 2, prof.Wins)
	assert.Equal(t, 1, prof.Losses)
	assert.Equal(t, 1, prof.Abandoned)

	// Bystander's profile: sees only their one match (a win — seat 0 team A, team A wins).
	byToken, err := auth.GenerateAccessToken(bystander.ID, testJWTSecret)
	require.NoError(t, err)
	byRec := doGetProfile(e, strconvUint(bystander.ID), byToken)
	require.Equal(t, http.StatusOK, byRec.Code)
	var byResp map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(byRec.Body.Bytes(), &byResp))
	var byProf user.ProfileResponse
	require.NoError(t, json.Unmarshal(byResp["data"], &byProf))
	assert.Equal(t, 1, byProf.Wins)
	assert.Equal(t, 0, byProf.Losses)
	assert.Equal(t, 0, byProf.Abandoned)
	assert.Equal(t, 1, byProf.TotalGamesPlayed)
}

func TestGetProfile_Forbidden_WraparoundID(t *testing.T) {
	repo, e := setupUserHandler()
	repo.addUser("alice", "alice@example.com", "en") // gets ID=1

	token, err := auth.GenerateAccessToken(1, testJWTSecret)
	require.NoError(t, err)

	// 4294967297 = 2^32 + 1; on 32-bit uint it would truncate to 1 == userID.
	// On 64-bit with the fixed uint64 comparison, this must return 403.
	rec := doGetProfile(e, "4294967297", token)
	assert.Equal(t, http.StatusForbidden, rec.Code,
		"wraparound ID must not bypass auth check (D86)")
}
