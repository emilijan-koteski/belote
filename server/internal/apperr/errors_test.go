package apperr

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAppError(t *testing.T) {
	err := NewAppError("TEST_ERROR", "test message", http.StatusBadRequest)

	assert.Equal(t, "TEST_ERROR", err.Code)
	assert.Equal(t, "test message", err.Message)
	assert.Equal(t, http.StatusBadRequest, err.Status)
	assert.Equal(t, "test message", err.Error())
}

func TestPredefinedErrors(t *testing.T) {
	tests := []struct {
		name   string
		err    *AppError
		code   string
		status int
	}{
		{"ErrInternal", ErrInternal, "INTERNAL_ERROR", http.StatusInternalServerError},
		{"ErrNotFound", ErrNotFound, "NOT_FOUND", http.StatusNotFound},
		{"ErrUnauthorized", ErrUnauthorized, "UNAUTHORIZED", http.StatusUnauthorized},
		{"ErrForbidden", ErrForbidden, "FORBIDDEN", http.StatusForbidden},
		{"ErrBadRequest", ErrBadRequest, "BAD_REQUEST", http.StatusBadRequest},
		{"ErrConflict", ErrConflict, "CONFLICT", http.StatusConflict},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.code, tc.err.Code)
			assert.Equal(t, tc.status, tc.err.Status)
		})
	}
}
