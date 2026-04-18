# Deferred Work

## Deferred from: code review of 1-1-project-scaffold-and-development-environment (2026-04-10)

- **W1: fetchClient 401 handler doesn't implement refresh-then-retry cycle** — **RESOLVED in Story 1.3** — fetchClient now implements 401 → refresh → retry with `_isRetry` guard and concurrent refresh deduplication.
- **W2: apperr.Wrap wraps raw error instead of AppError** — **RESOLVED in mid-Phase 1 cleanup** — `Wrap` now wraps the `appErr` (not raw `err`), so `errors.As` correctly matches the AppError after wrapping.
- **W3: ErrorBoundary "Try again" can loop on deterministic errors** — **RESOLVED in mid-Phase 1 cleanup** — "Try again" now calls `window.location.reload()` for a clean restart. Added `resetKey` prop for route-change auto-recovery.

## Deferred from: code review of 1-2-user-registration (2026-04-10)

- **D1: Token lost on page refresh** — **MITIGATED in Story 1.3** — No Zustand persist middleware, but `useAuthInit()` calls refresh endpoint on mount using httpOnly cookie. Session survives refresh with brief unauth flash. Design intent met.
- **D2: fetchClient hard redirect on 401 breaks SPA UX** — **RESOLVED in Story 1.3** — Uses `setAuthRedirect()` callback pattern with React Router `navigate("/login")` instead of `window.location.href`.
- **D3: Default JWT secret warning-only** — **RESOLVED in mid-Phase 1 cleanup** — Config now calls `os.Exit(1)` in non-development environments when JWT secret is default.
- **D4: No rate limiting on registration endpoint** — **ACCEPTED for Phase 1** — Infrastructure-level concern. Address when adding API gateway or rate-limiting middleware.
- **D5: Refresh token Secure:true hardcoded** — **RESOLVED in Story 1.3** — `Secure: h.env != "development"` in `auth/handler.go` makes it environment-aware.

## Deferred from: code review of 1-3-user-login-and-session-persistence (2026-04-11)

- **D6: Logout fire-and-forget can orphan refresh cookie server-side** — **ACCEPTED for Phase 1** — By-design fire-and-forget. Server-side revocation requires DB session store (Phase 2).
- **D7: Refresh tokens stateless with no server-side revocation** — **ACCEPTED for Phase 1** — Requires DB session store or token-version column. Planned for Phase 2.
- **D8: Same signing secret for access and refresh tokens** — **ACCEPTED for Phase 1** — Audience claim differentiates. Separate keys planned for Phase 2 defense-in-depth.
- **D9: Mutable `var` AppError sentinels shared across goroutines** — **ACCEPTED** — Go `var` pointer sentinels are idiomatic for `errors.Is` matching. No code path mutates them; enforced by code review convention. Changing to functions would break all `errors.Is` usage.
- **D10: `apperr.Wrap()` wraps raw error instead of AppError** — **RESOLVED in mid-Phase 1 cleanup** — Same as W2; `Wrap` now wraps the AppError.
- **D11: Default JWT secret only warns, doesn't abort in production** — **RESOLVED in mid-Phase 1 cleanup** — Same as D3; `os.Exit(1)` in non-development environments.
- **D12: No Unicode normalization on email addresses** — **RESOLVED in mid-Phase 1 cleanup** — Added `norm.NFC.String()` normalization in both login and registration email processing paths.

## Deferred from: code review of 1-4-basic-player-profile-and-navigation-shell (2026-04-11)

- **D13: Duplicate `getUserID` helper diverges from `auth.GetUserID`** — **ACCEPTED** — Import cycle (`auth` imports `user`) prevents `user` from importing `auth.GetUserID`. Duplication is intentional and idiomatic Go. Both implementations are identical.
- **D14: `i18n.language` region subtag comparison** — **ACCEPTED** — Project only configures `"en"` and `"sr"` as supported locales with no region subtags. Will only break if locale detection plugins are added.
- **D15: Path parameter `:id` accepts 0 as valid user ID** — **RESOLVED in mid-Phase 1 cleanup** — Both `GetProfile` and `UpdatePreferences` now reject `paramID == 0` as `ErrBadRequest`.

## Deferred from: code review of 2-1-create-room-and-room-configuration (2026-04-11)

- **D16: FindByID returns (nil, nil) for missing rooms** — **ACCEPTED** — Established project pattern (FindByCode uses same convention). All callers check `room == nil` after nil-error return. Changing would break existing call sites.
- **D17: No rate limiting on room creation endpoint** — **ACCEPTED for Phase 1** — Infrastructure-level concern. Address when adding API gateway or rate-limiting middleware.
- **D18: No per-user active room count cap** — **ACCEPTED for Phase 1** — Business rule not specified. Address when product defines a limit.

## Deferred from: code review of 2-2-browse-and-search-rooms (2026-04-11)

- **D19: `handleWsMessage` uses unsafe `as` casts on raw `JSON.parse` output** — **RESOLVED in Story 4.1** — All `as` casts in `useWsDispatch.ts` are guarded by `if (type === CONSTANT)` discriminant checks.

## Deferred from: code review of 2-3-join-room-and-room-lobby (2026-04-11)

- **D20: WS events system:player_joined and system:player_left are TODO-only** — **RESOLVED in Story 4.7** — Server broadcasts both events in `room/handler.go`; client dispatches via `roomLobbyStore`.
- **D21: Copy Link copies room code, not a full URL** — **ACCEPTED** — Spec says "code/link"; current behavior matches intent for WhatsApp/Viber sharing.
- **D22: Orphan room_players rows for soft-deleted rooms** — **ACCEPTED for Phase 1** — No functional impact. Cleanup script planned for Phase 2.
- **D23: No unit test for useRoomLobbyUpdates handler logic** — **RESOLVED** — `useRoomLobbyUpdates.ts` superseded by `roomLobbyStore` + `useWsDispatch`; tests exist in `roomLobbyStore.test.ts` and `useWsDispatch.test.ts`. Dead file deleted in mid-Phase 1 cleanup.

## Deferred from: code review of 2-4-team-assignment-and-game-start (2026-04-11)

- **D24: `useRoomLobbyUpdates` hardcodes `id: 0` for joined players** — **RESOLVED** — Fixed in active code (`useWsDispatch.ts` uses `id: payload.userId`). Dead file `useRoomLobbyUpdates.ts` deleted in mid-Phase 1 cleanup.
- **D25: `onRoomUpdated` uses unsafe `as unknown as Room` cast** — **RESOLVED** — Dead file `useRoomLobbyUpdates.ts` deleted in mid-Phase 1 cleanup. Active code uses proper `roomLobbyStore` dispatch.

## Deferred from: code review of 2-5-quick-play-matchmaking (2026-04-11)

- **D26: TOCTOU race on FindPlayerRoom check before transaction** — **ACCEPTED for Phase 1** — Pre-existing pattern. Mitigated by low scale; DB unique constraints catch concurrent duplicates.
- **D27: Only 4th-seat player receives gameStarted notification** — **RESOLVED in Story 4.7** — Server broadcasts `system:game_started` via WS to all room participants. HTTP response `gameStarted: true` also returned to all.
- **D28: Client abort does not cancel server-side room join/creation** — **ACCEPTED for Phase 1** — Server completes the operation; user recovers via ALREADY_IN_ROOM on retry.
- **D29: player_count denormalized counter drift risk** — **ACCEPTED for Phase 1** — Counter tracked via atomic increment/decrement in transactions. Drift risk is low at Phase 1 scale; refactor to subquery count in Phase 2 if drift observed.
- **D30: No TTL/cleanup for abandoned Quick Play rooms** — **ACCEPTED for Phase 1** — Lobby disconnect handler marks empty rooms as "completed". Background cleanup job for stale rooms planned for Phase 2.
- **D31: RoomLobby has no real-time refresh for other players' actions** — **RESOLVED in Story 4.7** — RoomLobby now uses `roomLobbyStore` with real-time WS dispatch for `player_joined`, `player_left`, `seat_updated`, `game_started` events.

## Deferred from: code review of 3-1-game-state-types-card-encoding-and-deck (2026-04-12)

- **D32: Duplicate playerID validation missing in `NewGame`** — **ACCEPTED** — Validation at boundary: session manager receives players from room handler which enforces unique DB users in seated positions. Pure game layer stays validation-free by design.
- **D33: Zero UserID (uint 0) accepted silently in `NewGame`** — **ACCEPTED** — Same as D32; GORM auto-increment guarantees DB IDs start at 1. Room handler validates players before session creation.

## Deferred from: code review of 3-2-trump-bidding-bitola-variant (2026-04-12)

- **D34: cloneGameState does not deep-copy pointer fields (TrumpCandidate, TrumpSuit, TrumpCallerSeat, etc.)** — After shallow struct copy, pointer fields like `*Card`, `*Suit`, `*int` are shared aliases between original and clone. Currently safe because code always assigns new pointers rather than writing through existing ones. Will become a real aliasing bug when play-phase handlers (Stories 3.3-3.6) are added if they write through pointer fields. Fix by deep-copying pointer fields in cloneGameState when adding card play logic. **RESOLVED in Story 3.3** — all 6 pointer fields now deep-copied.

## Deferred from: code review of 3-3-card-play-and-trick-resolution (2026-04-12)

- **D35: `legalCards` dereferences `TrumpSuit`/`LeadSuit` without nil guards** — **RESOLVED in mid-Phase 1 cleanup** — Added nil guard returning full hand if `TrumpSuit` or `LeadSuit` is nil.
- **D36: `currentTrickWinnerSeat` returns -1 for empty trick → `TeamForSeat(-1)` = -1 in Go** — **RESOLVED in mid-Phase 1 cleanup** — `isOpponentWinning` now returns `false` for empty trick or nil TrumpSuit, preventing the -1 sentinel from reaching `TeamForSeat`.
- **D37: No bounds check on `action.PlayerSeat` before array index** — **RESOLVED in mid-Phase 1 cleanup** — `handlePlayCard` now validates `action.PlayerSeat` is in range [0,3] before any array access.

## Deferred from: code review of 3-6-match-completion-and-special-conditions (2026-04-12)

- **D38: Nil TrickWinnerSeat dereference in `scoreHand()`** — **RESOLVED in mid-Phase 1 cleanup** — Added nil guard with early return in `scoreHand()` before dereferencing `TrickWinnerSeat`.

## Deferred from: nav bar user avatar addition (2026-04-12)

- **D39: AppLayout tests use `className` string-contains assertions for active tab styling** — **RESOLVED in mid-Phase 1 cleanup** — Tests now use `toHaveAttribute("aria-current", "page")` instead of `className.toContain("border-accent")`.
- **D40: No `afterEach` store reset in AppLayout tests** — **RESOLVED in mid-Phase 1 cleanup** — Added `afterEach` that resets `useAuthStore` to initial state.

## Deferred from: code review of 4-3-game-table-ui-layout-seats-and-cards (2026-04-12)

- **D41: EVENT_CARD_PLAYED cardId[0]/[1] parsing assumes 2-char format** — **RESOLVED in mid-Phase 1 cleanup** — Added bounds check: `if (!payload.cardId || payload.cardId.length < 2) return;` before accessing indices.

## Deferred from: code review of 4-4-trump-bidding-and-declaration-ui (2026-04-12)

- **D42: `playableCardIds` includes ALL hand cards with no legal-move filtering** — **ACCEPTED for Phase 1** — Server rejects illegal plays with clear error toast. Adding server-side `legalMoves` to GameState is a Phase 2 UX enhancement.
- **D43: `PlayerState.username` missing from server Go `PlayerState` struct** — **RESOLVED in mid-Phase 1 cleanup** — Added `Username string` to `PlayerState`, `PlayerSeatInfo`, and `NewGame()`. Server now populates username from room player data.
- **D44: `TrumpSelectedPayload.trumpSuit` unsafe `as` cast from `string` to `Suit | null`** — **ACCEPTED** — Handler returns early without processing the payload; cast is unreachable. The full authoritative state follows via `event:game_state`.
- **D45: `window.confirm()` for back-button interception** — **ACCEPTED for Phase 1** — Standard browser API, works across platforms. Custom modal replacement planned for Phase 2 UX polish.

## Deferred from: code review of 4-5-per-move-timer-and-auto-play (2026-04-12)

- **D46: GetStateSnapshot returns mutable pointer** — **RESOLVED in mid-Phase 1 cleanup** — Now returns a shallow copy (`snapshot := *session.gameState; return &snapshot`) so callers cannot observe concurrent mutations.
- **D47: legalCards dereferences TrumpSuit without nil check** — **RESOLVED in mid-Phase 1 cleanup** — Same as D35; nil guard added.
- **D48: Client clock skew — no server-client time sync** — **ACCEPTED for Phase 1** — Spec accepts ±1s tolerance. Server-client time sync via `serverTimeMs` field planned for Phase 2.

## Deferred from: code review of 5-1-player-pause-system (2026-04-13)

- **D53: `sendGameError` routes ALL game errors as `error:invalid_action`** — **RESOLVED in mid-Phase 1 cleanup** — `sendGameError` now uses `errors.Is` dispatch to map `apperr` sentinels to typed WS error events (`error:not_your_turn`, `error:wrong_phase`, `error:illegal_play`, `error:pause_exhausted`, `error:no_active_pause`, `error:not_room_owner`, `error:player_disconnected`).
- **D54: Disconnect while paused leaves game frozen** — **RESOLVED in Story 5.3** — `HandleDisconnect()` in `reconnect.go` auto-clears disconnected player's pause and resumes game if no other pauses remain.

## Deferred from: code review of 4-6-score-panel-score-reveal-and-match-flow (2026-04-13)

- **D49: LastHandResult not cleared in startNewHand()** — **ACCEPTED** — `LastHandResult` intentionally persists through `startNewHand()` so the session manager can broadcast it. Overwritten by the next `scoreHand()` call. Client ignores it outside score reveal flow.
- **D50: cloneGameState shallow-copies LastHandResult pointer** — **RESOLVED in mid-Phase 1 cleanup** — `cloneGameState` now deep-copies `LastHandResult` pointer field.
- **D51: matchDurationSec includes session setup time** — **ACCEPTED for Phase 1** — Overstates actual play time by including lobby/deal/bidding. Acceptable approximation.
- **D52: Second hand_scored during reconnect while overlay active loses that hand's score reveal** — **ACCEPTED for Phase 1** — Edge case only during reconnection. The overlay guard prevents UI glitches; the missed score data is cosmetic (match scores are correct). Overlay queue for Phase 2.

## Deferred from: code review of 4-7-room-lobby-websocket-wiring (2026-04-13)

- **D53: `userId` used as `RoomPlayer.id` field in WS dispatch** — **ACCEPTED** — DB row ID not available from WS event; `userId` serves as a unique client-side identifier. No API calls use this `id` field.
- **D54: Dead code `useRoomLobbyUpdates.ts` with known bugs** — **RESOLVED in mid-Phase 1 cleanup** — File deleted. Active code in `useWsDispatch.ts` + `roomLobbyStore` has no known bugs.
- **D55: `project-context.md` not updated for 5th Zustand store** — **RESOLVED in mid-Phase 1 cleanup** — Updated to list 5 partitioned stores including `roomLobbyStore`.

## Deferred from: code review of 5-2-room-owner-pause-override (2026-04-13)

- **D56: Room ownership transfer during active game not synced to session** — **ACCEPTED for Phase 1** — OwnerSeat fixed at game start by design. Owner must be seated to start game, and leaving during game is not a normal flow.
- **D57: No integration test for broadcast `OwnerOverride: true`** — **ACCEPTED** — Low priority test gap. Broadcast code is straightforward and covered by manual testing.
- **D58: No WS-layer test for `error:not_room_owner` event delivery** — **ACCEPTED** — D53 fix enables proper dispatch. Integration test is low priority.

## Deferred from: code review of 5-3-disconnect-detection-and-reconnect-countdown (2026-04-13)

- **D59: `username` field in `PlayerDisconnectedPayload` is always empty** — **RESOLVED in mid-Phase 1 cleanup** — `HandleDisconnect` now reads `gs.Players[seat].Username` (populated via D43 fix).
- **D60: `ERROR_PLAYER_DISCONNECTED` unreachable on wire** — **RESOLVED** — D53 fix dispatches `error:player_disconnected` via `errors.Is(err, apperr.ErrPlayerDisconnected)`.
- **D61: `startNewHand` does not reset disconnect fields** — **RESOLVED in mid-Phase 1 cleanup** — `startNewHand()` now resets `DisconnectedSeat = -1` and `ReconnectExpiresAt = nil`. `HandleReconnect()` also clears on reconnect.

## Deferred from: code review of 5-4-reconnection-and-state-restoration (2026-04-13)

- **D62: `handleReconnectTimeout` stub leaves game in PhaseDisconnected after window expires** — RESOLVED in Story 5.5: `handleReconnectTimeout` now fully implements match abandonment (transition to `PhaseMatchEnd`, persist match record, broadcast `event:match_abandoned`, remove session).

## Deferred from: code review of 5-5-match-abandonment-on-timeout (2026-04-14)

- **D63: Page refresh during/after abandonment shows blank game page** — **RESOLVED in mid-Phase 1 cleanup** — Added `useEffect` in `GamePage.tsx` that detects stale `match_end` phase with no overlay data and redirects to lobby.

## Deferred from: auth init bug fix (2026-04-14)

- **D64: `doRefresh()` in fetchClient does not pass AbortSignal to `refresh()`** — Pre-existing. The 401 retry path in `fetchClient` calls `refresh()` without an AbortSignal. Not related to StrictMode double-mount fix. Low risk at current scale.
- **D65: GORM logger uses `log.New` (plain text) while app uses `slog` (JSON)** — Pre-existing. GORM's default logger already output plain text before configuration change. Creating a proper slog adapter is a Phase 2 observability improvement.

## Deferred from: code review of fix-auth-routing-and-refresh (2026-04-16)

- **D66: Stale `gameState` in gameStore on re-login after session expiry** — Pre-existing. When 401 interceptor calls `authStore.logout()`, it clears token and user but does not reset `gameStore`. If the user logs in again, `useReconnectionRedirect` sees stale game state and may redirect to a game page for a game that has ended server-side. Low risk: server will reject actions on ended games.

## Deferred from: code review of declaration-reveal-cards-and-timing (2026-04-17)

- **D67: DeclarationReveal anchors panel to `declarations[0].playerSeat`** — If the server ever broadcasts declarations from two teammates on the winning team (e.g. seat 0 has a tierce and seat 2 has a different sequence), the panel anchors to the first entry only. Current spec and bitola dedup rules imply a single declarer wins the clash, so this is theoretical. Revisit if multi-teammate broadcasts become possible (e.g. Croatian variant where both teammates' declarations can survive).

## Deferred from: code review of belot-rebelot-prompt-and-reveal (2026-04-17)

- **D68: `prefersReducedMotion` snapshotted once via `useMemo`, not reactive** — `BelotReveal.tsx` and `DeclarationReveal.tsx` both read `window.matchMedia('(prefers-reduced-motion: reduce)').matches` once at mount and never subscribe to the `change` event. If a user toggles the OS-level reduce-motion setting mid-session, subsequent reveals use the stale value until the next page load. Shared pattern — fix once by introducing a `useReducedMotion` hook that subscribes to media-query changes.
- **D69: Belot reveal lost on reconnect during the 4s window** — Server's `event:belot_announced` fires once on announcement. On reconnect, the server sends `event:game_state` (which carries `belotAnnounced: true`) but does not replay the cardId-bearing reveal event. A user refreshing during the 4s reveal window — or a late-joining spectator — never sees the overlay. Spec treats the reveal as purely visual so the gap is acceptable; revisit if spectators are added or if reveal persistence becomes important (would need `belotAnnouncedCardId` carried in `GameState`).

## Deferred from: code review of fix-declaration-reveal-broadcast-missing (2026-04-17)

- **D70: Tie-bias in declaration-winner derivation** — `manager.go`'s `broadcastDeclarationsResolvedIfTransition` (and the original inline block it replaced) reports the winner by `DeclarationPoints[Red] > 0 ? Red : (Blue > 0 ? Blue : null)`. If both teams somehow have declaration points simultaneously, Red wins silently. Pre-existing bias; the game-layer `resolveDeclarations` is supposed to zero the losing team, so this is defensive only. Revisit if game-layer invariants weaken.
- **D71: Stale `declarationReveal` surviving a mid-animation reconnect** — `useWsDispatch.ts` `setGameState` does not reset `declarationReveal`. If a client disconnects during the 4s reveal window and reconnects quickly, the store still holds the prior payload and the overlay re-renders on top of the reconnected game state. Low-severity UX edge. Fix by resetting reveal fields inside `setGameState` on reconnect, or by clearing them in the reconnect flow specifically.

## Deferred from: code review of 6-1-global-lobby-chat (2026-04-18)

- **D72: Server-side sanitization of chat text + username** — control characters, RTL overrides, and zero-width joiners are broadcast verbatim. JSX auto-escapes XSS, but malicious unicode can disrupt the chat list rendering. Phase 1 chat is intentionally unmoderated per Dev Notes; revisit when chat moderation lands in Phase 2. [server/internal/chat/handler.go:96-107]
- **D73: WS router dispatches actions via `go r.ActionHandler(...)` without per-client serialization** — two concurrent chat messages from the same client can be processed out of submission order, producing out-of-order timestamps. UI renders by append order. Pre-existing pattern affecting all action handlers; not introduced by Story 6.1. [server/internal/ws/router.go:19]
- **D74: Lobby right-column `min-h-150` (≈600px) forces page-level scroll on viewports below 600px tall** — breaks the nested chat auto-scroll because `scrollIntoView` scrolls the page instead of the chat list. UX spec targets 1280×720 minimum viewport, so out of scope; revisit if mobile/small-viewport support is added. [client/src/features/lobby/LobbyPage.tsx:169]
- **D75: `chat.handleGlobal` collapses transient DB error and "user deleted" into the same silent drop** — sender gets no feedback in either case, so a transient failure permanently loses the message with no retry. Asymmetric log payload (`error=<nil>` vs real error). Phase 1 chat has no retry/error UX surface; revisit alongside moderation work. [server/internal/chat/handler.go:96-100]
- **D76: `i18n.test.ts` does not assert key parity between `en.json` and `sr.json`** — `chat.*` keys are in parity manually but adding a key to one file but not the other would not fail any test. Pre-existing infrastructure gap not introduced by this story. [client/src/shared/i18n/i18n.test.ts]
- **D77: No end-to-end test covering sender's own-message echo through a real `*ws.Hub`** — handler tests use a hub spy; the real `*ws.Hub.BroadcastToUsers` path is exercised by `ws_test.go` but not in conjunction with the chat handler. Unit coverage is comprehensive (11 handler tests); integration test would duplicate `ws_test.go` machinery. [server/internal/chat/handler_test.go]

## Deferred from: code review of 6-2-match-scoped-chat (2026-04-18)

- **D78: Race between `session.Manager.MatchParticipants` and `Hub.BroadcastToUsers`** — Participants are read under `RLock` and released before broadcast. If `RemoveSession` runs between the read and the broadcast (e.g. match-end teardown racing with an in-flight match chat send), the broadcast fans out to player IDs whose session is already gone. Consequence is mild: a late match chat reaches players who just returned to the lobby, reseeding their (already cleared) `matchMessages`. Fix requires the session manager to own the broadcast atomically under the write lock — architectural change. Systemic concurrency concern shared with other session broadcasts; revisit alongside chat moderation work in Phase 2. [server/internal/chat/handler.go:130-178]
- **D79: No rate limiting on match chat** — a participant can flood the 3 other players' client queues at WS ingress rate. No per-user cooldown, token bucket, or flood check. Same pre-existing gap as D72 for global chat; Phase 1 chat is intentionally unmoderated. Revisit when chat moderation lands in Phase 2. [server/internal/chat/handler.go:130-178]
- **D80: `RFC3339Nano` server timestamps provide nanosecond precision but no monotonic ordering guarantee under NTP clock corrections** — messages sorted by timestamp may misorder on backward clock jumps. Systemic across all server-stamped events (timers, disconnects, declarations), not specific to chat. Fix would require a monotonic per-session sequence number carried alongside the timestamp. Project-wide concern not introduced by this story; out of scope. [server/internal/chat/handler.go:161]
- **D81: Concurrent `action:chat_message` goroutines per client can interleave** — same pre-existing router pattern that Story 6.1 deferred as D73. A sender's two rapid-fire messages may reach peers out of submission order. Fix would be a per-client serialization layer at the router. Router-level change out of scope for a chat story. [server/internal/ws/router.go:19]
