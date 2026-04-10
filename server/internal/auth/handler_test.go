package auth

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

func setupHandler() (*AuthHandler, *echo.Echo) {
	repo := newMockUserRepo()
	handler := NewAuthHandler(repo, "test-jwt-secret")
	e := echo.New()
	e.HTTPErrorHandler = testErrorHandler
	e.POST("/api/v1/auth/register", handler.Register)
	return handler, e
}

func doRegister(e *echo.Echo, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func TestRegister_Success(t *testing.T) {
	_, e := setupHandler()

	body := `{"email":"test@example.com","username":"testuser","password":"password123"}`
	rec := doRegister(e, body)

	assert.Equal(t, http.StatusCreated, rec.Code)

	var resp map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))

	var data RegisterResponseData
	require.NoError(t, json.Unmarshal(resp["data"], &data))

	assert.Equal(t, uint(1), data.ID)
	assert.Equal(t, "testuser", data.Username)
	assert.Equal(t, "test@example.com", data.Email)
	assert.Equal(t, "en", data.LanguagePreference)
	assert.NotEmpty(t, data.Token)
	assert.False(t, data.CreatedAt.IsZero(), "createdAt should be set")
}

func TestRegister_SetsRefreshCookie(t *testing.T) {
	_, e := setupHandler()

	body := `{"email":"test@example.com","username":"testuser","password":"password123"}`
	rec := doRegister(e, body)

	assert.Equal(t, http.StatusCreated, rec.Code)

	cookies := rec.Result().Cookies()
	var refreshCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == "refresh_token" {
			refreshCookie = c
			break
		}
	}

	require.NotNil(t, refreshCookie, "refresh_token cookie should be set")
	assert.True(t, refreshCookie.HttpOnly)
	assert.True(t, refreshCookie.Secure)
	assert.Equal(t, http.SameSiteStrictMode, refreshCookie.SameSite)
	assert.Equal(t, "/api/v1/auth", refreshCookie.Path)
	assert.Equal(t, 7*24*60*60, refreshCookie.MaxAge)
}

func TestRegister_DuplicateEmail(t *testing.T) {
	_, e := setupHandler()

	body := `{"email":"dup@example.com","username":"user1","password":"password123"}`
	rec := doRegister(e, body)
	assert.Equal(t, http.StatusCreated, rec.Code)

	body2 := `{"email":"dup@example.com","username":"user2","password":"password123"}`
	rec2 := doRegister(e, body2)
	assert.Equal(t, http.StatusConflict, rec2.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec2.Body.Bytes(), &errResp))
	assert.Equal(t, "EMAIL_TAKEN", errResp["error"]["code"])
}

func TestRegister_DuplicateUsername(t *testing.T) {
	_, e := setupHandler()

	body := `{"email":"user1@example.com","username":"sameuser","password":"password123"}`
	rec := doRegister(e, body)
	assert.Equal(t, http.StatusCreated, rec.Code)

	body2 := `{"email":"user2@example.com","username":"sameuser","password":"password123"}`
	rec2 := doRegister(e, body2)
	assert.Equal(t, http.StatusConflict, rec2.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec2.Body.Bytes(), &errResp))
	assert.Equal(t, "USERNAME_TAKEN", errResp["error"]["code"])
}

func TestRegister_InvalidEmail(t *testing.T) {
	_, e := setupHandler()

	body := `{"email":"not-an-email","username":"testuser","password":"password123"}`
	rec := doRegister(e, body)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "INVALID_EMAIL", errResp["error"]["code"])
}

func TestRegister_PasswordTooShort(t *testing.T) {
	_, e := setupHandler()

	body := `{"email":"test@example.com","username":"testuser","password":"short"}`
	rec := doRegister(e, body)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "PASSWORD_TOO_SHORT", errResp["error"]["code"])
}

func TestRegister_PasswordTooLong(t *testing.T) {
	_, e := setupHandler()

	longPassword := strings.Repeat("a", 73)
	body := `{"email":"test@example.com","username":"testuser","password":"` + longPassword + `"}`
	rec := doRegister(e, body)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "PASSWORD_TOO_LONG", errResp["error"]["code"])
}

func TestRegister_EmptyFields(t *testing.T) {
	_, e := setupHandler()

	body := `{"email":"","username":"","password":""}`
	rec := doRegister(e, body)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestRegister_UsernameTooShort(t *testing.T) {
	_, e := setupHandler()

	body := `{"email":"test@example.com","username":"ab","password":"password123"}`
	rec := doRegister(e, body)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "USERNAME_TOO_SHORT", errResp["error"]["code"])
}

func TestRegister_UsernameTooLong(t *testing.T) {
	_, e := setupHandler()

	body := `{"email":"test@example.com","username":"abcdefghijklmnopqrstu","password":"password123"}`
	rec := doRegister(e, body)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "USERNAME_TOO_LONG", errResp["error"]["code"])
}

func TestRegister_UsernameInvalidChars(t *testing.T) {
	_, e := setupHandler()

	body := `{"email":"test@example.com","username":"bad user!","password":"password123"}`
	rec := doRegister(e, body)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var errResp map[string]map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &errResp))
	assert.Equal(t, "USERNAME_INVALID_CHARS", errResp["error"]["code"])
}

func TestRegister_NormalizesEmail(t *testing.T) {
	_, e := setupHandler()

	body := `{"email":"  Test@Example.COM  ","username":"testuser","password":"password123"}`
	rec := doRegister(e, body)

	assert.Equal(t, http.StatusCreated, rec.Code)

	var resp map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))

	var data RegisterResponseData
	require.NoError(t, json.Unmarshal(resp["data"], &data))

	assert.Equal(t, "test@example.com", data.Email)
}
