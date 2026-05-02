//go:build !amd64 && !arm64

package main

// Intentional compile error: 32-bit platforms not supported.
// userID comparisons in user/handler.go require uint == uint64 (D86).
var _ int = "32-bit build detected — see deferred-work.md D86"
