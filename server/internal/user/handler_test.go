package user_test

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
	"gorm.io/gorm"
	"github.com/stretchr/testify/require"

	"github.com/emilijan/belote/server/internal/apperr"
	"github.com/emilijan/belote/server/internal/auth"
	"github.com/emilijan/belote/server/internal/user"
)

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
	repo := newMockUserRepo()
	handler := user.NewUserHandler(repo)
	e := echo.New()
	e.HTTPErrorHandler = testErrorHandler

	api := e.Group("/api/v1", auth.AuthMiddleware(testJWTSecret))
	api.GET("/users/:id/profile", handler.GetProfile)
	api.PATCH("/users/:id/preferences", handler.UpdatePreferences)

	return repo, e
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
