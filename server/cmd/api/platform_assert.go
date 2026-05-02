//go:build amd64 || arm64

// Package main — this file is a compile-time guard that enforces 64-bit builds.
// On 32-bit platforms, platform_assert_unsupported.go provides a compile error.
// See deferred-work.md D86.
package main
