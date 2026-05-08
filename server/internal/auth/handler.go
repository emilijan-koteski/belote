package auth

import (
	"fmt"
	"net/http"
	"net/mail"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"golang.org/x/text/unicode/norm"

	"github.com/emilijan/beljot/server/internal/apperr"
	"github.com/emilijan/beljot/server/internal/user"
)

var usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

type RegisterRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type RegisterResponseData struct {
	ID                 uint      `json:"id"`
	Username           string    `json:"username"`
	Email              string    `json:"email"`
	LanguagePreference string    `json:"languagePreference"`
	CreatedAt          time.Time `json:"createdAt"`
	Token              string    `json:"token"`
}

type AuthHandler struct {
	userRepo  user.UserRepository
	jwtSecret string
	env       string
}

func NewAuthHandler(userRepo user.UserRepository, jwtSecret string, env string) *AuthHandler {
	return &AuthHandler{
		userRepo:  userRepo,
		jwtSecret: jwtSecret,
		env:       env,
	}
}

func (h *AuthHandler) setRefreshCookie(c echo.Context, token string) {
	c.SetCookie(&http.Cookie{
		Name:     "refresh_token",
		Value:    token,
		Path:     "/api/v1/auth",
		HttpOnly: true,
		Secure:   h.env != "development",
		SameSite: http.SameSiteStrictMode,
		MaxAge:   7 * 24 * 60 * 60,
	})
}

func (h *AuthHandler) clearRefreshCookie(c echo.Context) {
	c.SetCookie(&http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Path:     "/api/v1/auth",
		HttpOnly: true,
		Secure:   h.env != "development",
		SameSite: http.SameSiteStrictMode,
		MaxAge:   -1,
	})
}

func (h *AuthHandler) Register(c echo.Context) error {
	var req RegisterRequest
	if err := c.Bind(&req); err != nil {
		return apperr.ErrBadRequest
	}

	if err := validateRegisterRequest(&req); err != nil {
		return err
	}

	existing, err := h.userRepo.FindByEmail(req.Email)
	if err != nil {
		return fmt.Errorf("checking email: %w", err)
	}
	if existing != nil {
		return apperr.ErrEmailTaken
	}

	existing, err = h.userRepo.FindByUsername(req.Username)
	if err != nil {
		return fmt.Errorf("checking username: %w", err)
	}
	if existing != nil {
		return apperr.ErrUsernameTaken
	}

	hash, err := HashPassword(req.Password)
	if err != nil {
		return fmt.Errorf("hashing password: %w", err)
	}

	u := &user.User{
		Email:              req.Email,
		Username:           req.Username,
		PasswordHash:       hash,
		LanguagePreference: "en",
	}

	if err := h.userRepo.Create(u); err != nil {
		return fmt.Errorf("creating user: %w", err)
	}

	accessToken, err := GenerateAccessToken(u.ID, h.jwtSecret)
	if err != nil {
		return fmt.Errorf("generating access token: %w", err)
	}

	refreshToken, err := GenerateRefreshToken(u.ID, h.jwtSecret)
	if err != nil {
		return fmt.Errorf("generating refresh token: %w", err)
	}

	h.setRefreshCookie(c, refreshToken)

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"data": RegisterResponseData{
			ID:                 u.ID,
			Username:           u.Username,
			Email:              u.Email,
			LanguagePreference: u.LanguagePreference,
			CreatedAt:          u.CreatedAt,
			Token:              accessToken,
		},
	})
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(c echo.Context) error {
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		return apperr.ErrBadRequest
	}

	email := strings.ToLower(norm.NFC.String(strings.TrimSpace(req.Email)))
	if email == "" || req.Password == "" {
		return apperr.ErrInvalidCredentials
	}
	addr, err := mail.ParseAddress(email)
	if err == nil {
		email = strings.ToLower(norm.NFC.String(addr.Address))
	}

	u, err := h.userRepo.FindByEmail(email)
	if err != nil {
		return fmt.Errorf("finding user: %w", err)
	}
	if u == nil {
		return apperr.ErrInvalidCredentials
	}

	if err := CheckPassword(u.PasswordHash, req.Password); err != nil {
		return apperr.ErrInvalidCredentials
	}

	accessToken, err := GenerateAccessToken(u.ID, h.jwtSecret)
	if err != nil {
		return fmt.Errorf("generating access token: %w", err)
	}

	refreshToken, err := GenerateRefreshToken(u.ID, h.jwtSecret)
	if err != nil {
		return fmt.Errorf("generating refresh token: %w", err)
	}

	h.setRefreshCookie(c, refreshToken)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": RegisterResponseData{
			ID:                 u.ID,
			Username:           u.Username,
			Email:              u.Email,
			LanguagePreference: u.LanguagePreference,
			CreatedAt:          u.CreatedAt,
			Token:              accessToken,
		},
	})
}

func (h *AuthHandler) Refresh(c echo.Context) error {
	cookie, err := c.Cookie("refresh_token")
	if err != nil {
		h.clearRefreshCookie(c)
		return apperr.ErrUnauthorized
	}

	claims, err := ValidateToken(cookie.Value, h.jwtSecret)
	if err != nil {
		h.clearRefreshCookie(c)
		return apperr.ErrUnauthorized
	}

	if !slices.Contains([]string(claims.Audience), "refresh") {
		h.clearRefreshCookie(c)
		return apperr.ErrUnauthorized
	}

	userID, err := strconv.ParseUint(claims.Subject, 10, 64)
	if err != nil {
		h.clearRefreshCookie(c)
		return apperr.ErrUnauthorized
	}

	u, err := h.userRepo.FindByID(uint(userID))
	if err != nil {
		return fmt.Errorf("finding user: %w", err)
	}
	if u == nil {
		h.clearRefreshCookie(c)
		return apperr.ErrUnauthorized
	}

	accessToken, err := GenerateAccessToken(u.ID, h.jwtSecret)
	if err != nil {
		return fmt.Errorf("generating access token: %w", err)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": RegisterResponseData{
			ID:                 u.ID,
			Username:           u.Username,
			Email:              u.Email,
			LanguagePreference: u.LanguagePreference,
			CreatedAt:          u.CreatedAt,
			Token:              accessToken,
		},
	})
}

func (h *AuthHandler) Logout(c echo.Context) error {
	h.clearRefreshCookie(c)
	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": map[string]string{
			"message": "logged out",
		},
	})
}

func validateRegisterRequest(req *RegisterRequest) error {
	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" {
		return apperr.ErrInvalidEmail
	}
	addr, err := mail.ParseAddress(req.Email)
	if err != nil {
		return apperr.ErrInvalidEmail
	}
	req.Email = strings.ToLower(norm.NFC.String(addr.Address))

	req.Username = strings.TrimSpace(req.Username)
	if len(req.Username) < 3 {
		return apperr.ErrUsernameTooShort
	}
	if len(req.Username) > 20 {
		return apperr.ErrUsernameTooLong
	}
	if !usernameRegex.MatchString(req.Username) {
		return apperr.ErrUsernameInvalidChars
	}

	if len(req.Password) < 8 {
		return apperr.ErrPasswordTooShort
	}
	if len(req.Password) > 72 {
		return apperr.ErrPasswordTooLong
	}

	return nil
}
