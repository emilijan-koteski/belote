# Deferred Work

## Deferred from: code review of 1-1-project-scaffold-and-development-environment (2026-04-10)

- **W1: fetchClient 401 handler doesn't implement refresh-then-retry cycle** — The project-context.md specifies fetchClient owns the full 401 → refresh → retry cycle, but the current implementation immediately logs out and redirects. Explicitly scoped to Story 1.3 with a TODO comment in code.
- **W2: apperr.Wrap wraps raw error instead of AppError** — `Wrap(err, appErr)` uses `fmt.Errorf("%s: %w", appErr.Message, err)` which wraps the raw err, not the AppError. `errors.As` will never match the AppError after wrapping. Function is defined but never called yet — fix when first used.
- **W3: ErrorBoundary "Try again" can loop on deterministic errors** — Setting `hasError: false` re-renders the same broken children. Works for transient errors but deterministic errors cause an infinite loop. Proper fix needs router integration or a `resetKeys` mechanism.

## Deferred from: code review of 1-2-user-registration (2026-04-10)

- **D1: Token lost on page refresh** — Access token stored in Zustand memory only (no persist middleware). Refresh token endpoint not implemented yet. User session lost on any full page reload. Deferred to Story 1.3 (refresh token cycle).
- **D2: fetchClient hard redirect on 401 breaks SPA UX** — Uses `window.location.href = "/login"` instead of React Router navigation, destroying all in-memory state. Pre-existing from Story 1.1, deferred to Story 1.3.
- **D3: Default JWT secret warning-only** — Config logs `slog.Warn` but continues with insecure default `"change-me-in-production"`. Acknowledged in Story 1.1 review (P1 RESOLVED). Should fail hard in production mode.
- **D4: No rate limiting on registration endpoint** — bcrypt cost makes registration a CPU DoS vector. Infrastructure-level concern, not story-scoped. Address when adding API gateway or middleware.
- **D5: Refresh token Secure:true hardcoded** — Cookie `Secure: true` prevents sending over HTTP in dev. Moot until refresh endpoint exists in Story 1.3. Make configurable by environment then.
