# Deferred Work

## Deferred from: code review of 1-1-project-scaffold-and-development-environment (2026-04-10)

- **W1: fetchClient 401 handler doesn't implement refresh-then-retry cycle** — The project-context.md specifies fetchClient owns the full 401 → refresh → retry cycle, but the current implementation immediately logs out and redirects. Explicitly scoped to Story 1.3 with a TODO comment in code.
- **W2: apperr.Wrap wraps raw error instead of AppError** — `Wrap(err, appErr)` uses `fmt.Errorf("%s: %w", appErr.Message, err)` which wraps the raw err, not the AppError. `errors.As` will never match the AppError after wrapping. Function is defined but never called yet — fix when first used.
- **W3: ErrorBoundary "Try again" can loop on deterministic errors** — Setting `hasError: false` re-renders the same broken children. Works for transient errors but deterministic errors cause an infinite loop. Proper fix needs router integration or a `resetKeys` mechanism.
