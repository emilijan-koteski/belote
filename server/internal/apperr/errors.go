package apperr

import (
	"fmt"
	"net/http"
)

type AppError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Status  int    `json:"-"`
}

func (e *AppError) Error() string {
	return e.Message
}

func NewAppError(code string, message string, status int) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Status:  status,
	}
}

func Wrap(err error, appErr *AppError) error {
	return fmt.Errorf("%s: %w", appErr.Message, err)
}

// Centralized application errors
var (
	ErrInternal     = NewAppError("INTERNAL_ERROR", "An internal error occurred", http.StatusInternalServerError)
	ErrNotFound     = NewAppError("NOT_FOUND", "Resource not found", http.StatusNotFound)
	ErrUnauthorized = NewAppError("UNAUTHORIZED", "Authentication required", http.StatusUnauthorized)
	ErrForbidden    = NewAppError("FORBIDDEN", "Access denied", http.StatusForbidden)
	ErrBadRequest   = NewAppError("BAD_REQUEST", "Invalid request", http.StatusBadRequest)
	ErrConflict     = NewAppError("CONFLICT", "Resource conflict", http.StatusConflict)
)
