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

## Deferred from: code review of 1-3-user-login-and-session-persistence (2026-04-11)

- **D6: Logout fire-and-forget can orphan refresh cookie server-side** — `logout()` is fire-and-forget per spec. If the network call fails, the refresh cookie remains valid for up to 7 days. Requires server-side token revocation/blocklist to truly fix. Phase 1 design decision.
- **D7: Refresh tokens stateless with no server-side revocation** — No token blocklist or session store. Once issued, a refresh token is valid until expiry. Logout only clears the browser cookie. Requires DB session store or token-version column for Phase 2+.
- **D8: Same signing secret for access and refresh tokens** — Both token types use identical `jwtSecret`. Audience claim is the only differentiator. Separate keys would provide defense-in-depth. Phase 2+ improvement.
- **D9: Mutable `var` AppError sentinels shared across goroutines** — Pre-existing from Story 1.1. Sentinel errors are `var *AppError` pointers — any accidental mutation would affect all goroutines. Currently safe (nobody mutates), but latent.
- **D10: `apperr.Wrap()` wraps raw error instead of AppError** — Pre-existing from Story 1.2 (also tracked as W2). Still unused but still broken.
- **D11: Default JWT secret only warns, doesn't abort in production** — Pre-existing (D3). Config logs warning but continues with insecure default. Should fail hard when `BELOTE_ENV=production`.
- **D12: No Unicode normalization on email addresses** — `strings.ToLower` doesn't handle NFC/NFD normalization or locale-specific case folding (e.g., Turkish dotless i). Pre-existing, affects both registration and login.

## Deferred from: code review of 1-4-basic-player-profile-and-navigation-shell (2026-04-11)

- **D13: Duplicate `getUserID` helper diverges from `auth.GetUserID`** — `user/handler.go:32-42` duplicates the JWT extraction logic from `auth/middleware.go`. Intentional to avoid import cycle (`user -> auth -> user`). If the context key or type changes in auth middleware, this copy will silently break. Revisit if packages are restructured.
- **D14: `i18n.language` region subtag comparison** — `LanguageSelector.tsx:23` compares `lang === i18n.language` but `i18n.language` can include region subtags (e.g., `"en-US"`). Currently safe because the project configures only `"en"` and `"sr"` as supported locales. Revisit if locale detection plugins are added.
- **D15: Path parameter `:id` accepts 0 as valid user ID** — `handler.go:50` parses 0 without rejection. GORM `First(&u, 0)` may return an arbitrary first record instead of not-found. Mitigated by JWT IDs always starting at 1. Revisit if zero-ID edge cases become reachable.

## Deferred from: code review of 2-1-create-room-and-room-configuration (2026-04-11)

- **D16: FindByID returns (nil, nil) for missing rooms** — `gorm_repo.go:34-43` returns `(nil, nil)` when room not found. Callers must check `room == nil` after a nil-error return. Not called by any handler in this diff; follows established project pattern. Revisit when FindByID is first used in a handler.
- **D17: No rate limiting on room creation endpoint** — `POST /api/v1/rooms` has no per-user rate limit. An authenticated user can create rooms in a tight loop. Infrastructure-level concern, not story-scoped. Address when adding API gateway or rate-limiting middleware.
- **D18: No per-user active room count cap** — Handler does not check how many active rooms a user already owns. Business rule not specified in story requirements. Revisit if abuse becomes a concern or when product defines a limit.

## Deferred from: code review of 2-2-browse-and-search-rooms (2026-04-11)

- **D19: `handleWsMessage` uses unsafe `as` casts on raw `JSON.parse` output** — Violates project rule requiring typed WS dispatch function for all incoming WebSocket messages. Code is dormant (WS hub not wired). Deferred to Story 4-1 (WS Gateway) where the central typed dispatch + validation function will be built. Validation belongs at the dispatch layer, not in per-feature handlers.

## Deferred from: code review of 2-3-join-room-and-room-lobby (2026-04-11)

- **D20: WS events system:player_joined and system:player_left are TODO-only** — Event constants defined in both contract files but never broadcast. Requires WS hub infrastructure from Story 4-1. Real-time seat updates will not work until then.
- **D21: Copy Link copies room code, not a full URL** — Spec says "code/link" and user journeys describe sharing codes via WhatsApp/Viber. Current behavior matches spec intent. Revisit if URL sharing is needed.
- **D22: Orphan room_players rows for soft-deleted rooms** — GORM soft delete doesn't trigger FK CASCADE. room_players rows for soft-deleted rooms linger with no functional impact. Cleanup script for Phase 2.
- **D23: No unit test for useRoomLobbyUpdates handler logic** — WS not yet wired. Test when WS infrastructure lands (Story 4-1).

## Deferred from: code review of 2-4-team-assignment-and-game-start (2026-04-11)

- **D24: `useRoomLobbyUpdates` hardcodes `id: 0` for joined players** — Pre-existing from Story 2.3. When constructing a RoomPlayer from PlayerJoinedPayload, `id` is hardcoded to 0. Multiple WS join events before a refresh would produce duplicate IDs. Fix when WS infrastructure lands (Story 4-1).
- **D25: `onRoomUpdated` uses unsafe `as unknown as Room` cast** — Pre-existing from Story 2.3. Bypasses TypeScript safety between RoomUpdatedPayload and Room types. Fix when WS typed dispatch is built (Story 4-1).

## Deferred from: code review of 2-5-quick-play-matchmaking (2026-04-11)

- **D26: TOCTOU race on FindPlayerRoom check before transaction** — FindPlayerRoom runs outside the transaction in QuickPlay handler (same pattern as JoinRoom). Two concurrent requests from the same user can both pass the check. Pre-existing architectural pattern; mitigated by low Phase 1 scale.
- **D27: Only 4th-seat player receives gameStarted notification** — SelectSeat auto-start returns gameStarted:true only to the triggering player. Other 3 players have no notification mechanism until WS hub is wired in Epic 4.
- **D28: Client abort does not cancel server-side room join/creation** — AbortController cancels the HTTP fetch but the server completes the operation. User gets ALREADY_IN_ROOM on next attempt with recovery via browse. Acceptable for Phase 1.
- **D29: player_count denormalized counter drift risk** — player_count is manually tracked via IncrementPlayerCount/DecrementPlayerCount. Any code path that adds/removes players without updating the counter causes drift. Pre-existing since Story 2.1.
- **D30: No TTL/cleanup for abandoned Quick Play rooms** — Quick Play rooms with no players persist in waiting status. LeaveRoom marks empty rooms as completed, but rooms where the last player disconnects without leaving may linger. Same concern applies to manual rooms.
- **D31: RoomLobby has no real-time refresh for other players' actions** — RoomLobby fetches room data once on mount with no polling or WS subscription. Other players' seat selections and joins are invisible until page refresh. Pre-existing, affects all rooms. WS solution in Epic 4.

## Deferred from: code review of 3-1-game-state-types-card-encoding-and-deck (2026-04-12)

- **D32: Duplicate playerID validation missing in `NewGame`** — `NewGame` accepts `[4]uint{10, 10, 20, 30}` silently. Validation is the session manager's responsibility (Epic 4), not the pure game layer. Pre-existing design pattern.
- **D33: Zero UserID (uint 0) accepted silently in `NewGame`** — GORM auto-increment starts at 1 so DB ID=0 is impossible, but the game layer doesn't enforce. Session manager will validate. Pre-existing pattern.

## Deferred from: code review of 3-2-trump-bidding-bitola-variant (2026-04-12)

- **D34: cloneGameState does not deep-copy pointer fields (TrumpCandidate, TrumpSuit, TrumpCallerSeat, etc.)** — After shallow struct copy, pointer fields like `*Card`, `*Suit`, `*int` are shared aliases between original and clone. Currently safe because code always assigns new pointers rather than writing through existing ones. Will become a real aliasing bug when play-phase handlers (Stories 3.3-3.6) are added if they write through pointer fields. Fix by deep-copying pointer fields in cloneGameState when adding card play logic. **RESOLVED in Story 3.3** — all 6 pointer fields now deep-copied.

## Deferred from: code review of 3-3-card-play-and-trick-resolution (2026-04-12)

- **D35: `legalCards` dereferences `TrumpSuit`/`LeadSuit` without nil guards** — `validation.go:18-19` dereferences both pointers unconditionally when `CurrentTrick` is non-empty. Current call chain is safe (`PhasePlaying` invariant guarantees `TrumpSuit` non-nil; `LeadSuit` set before trick cards accumulate). Latent panic risk on corrupted/deserialized state or if called from a future code path without the same preconditions. Fix when persistence/deserialization is added (Epic 4+).
- **D36: `currentTrickWinnerSeat` returns -1 for empty trick → `TeamForSeat(-1)` = -1 in Go** — `validation.go:108` returns -1 as sentinel for empty trick. Go's modulo of negative numbers produces -1, not 1. Unreachable through current call paths (`isOpponentWinning` only called when `CurrentTrick` is non-empty). Fix by adding guard or using unsigned seat type when `currentTrickWinnerSeat` gains callers in future stories.
- **D37: No bounds check on `action.PlayerSeat` before array index** — `playing.go` indexes `state.Players[action.PlayerSeat]` without validating range [0,3]. Session manager (Epic 4) validates seat range before calling rules engine. Add guard when session manager is implemented or if rules engine is exposed to untrusted input.

## Deferred from: code review of 3-6-match-completion-and-special-conditions (2026-04-12)

- **D38: Nil TrickWinnerSeat dereference in `scoreHand()`** — `scoring.go:9` dereferences `*state.TrickWinnerSeat` without nil guard. Safe through current call chain (`resolveTrick` always sets it at trick 8 before `scoreHand` runs). Pre-existing from Story 3.5, explicitly listed in story Dev Notes as deferred. Latent panic risk if `scoreHand` gains callers from paths where `TrickWinnerSeat` is unset.
