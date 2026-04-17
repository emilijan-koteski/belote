---
title: 'Belot / Re-belot: rank-specific prompt and seat-anchored card reveal'
type: 'feature'
created: '2026-04-17'
status: 'ready-for-dev'
context: ['spec-declaration-reveal-cards-and-timing.md']
baseline_commit: 'TBD (HEAD at implementation time)'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem (three parts):**
1. The Belot prompt currently reads a generic "Announce Belot?" regardless of whether the player is about to play the **Queen** or the **King** of trump. The rule distinguishes: playing the Queen first → "Belot"; playing the King first → "Re-belot".
2. The Belot announcement is silent client-side — [client/src/shared/hooks/useWsDispatch.ts:191-194](client/src/shared/hooks/useWsDispatch.ts#L191-L194) handles `event:belot_announced` as a no-op. Other players get no feedback about who just announced or which card triggered it.
3. The `event:belot_announced` payload ([server/internal/ws/events.go — BelotAnnouncedPayload](server/internal/ws/events.go)) carries only `{playerSeat, team}`. The card ID is needed to render the reveal; extend the event.

**Approach:**
1. **Prompt label:** the prompt title and button text must reflect the card being played. When the player is about to play the **Queen of trump**, prompt says "Announce Belot?". When about to play the **King of trump**, prompt says "Announce Re-belot?". Terminology is rank-bound, not play-order-bound.
2. **Server payload:** extend `event:belot_announced` to include `cardId` (the K or Q being announced). Session manager already knows — it fires off the `ActionAnnounceBelot` action, whose last-played card is the triggering card.
3. **Reveal:** mirror the declaration reveal from `spec-declaration-reveal-cards-and-timing.md` — a small panel anchored to the announcing player's seat, showing the single card (the K or Q of trump that triggered the announcement), with the text "Belot!" or "Re-belot!" above it. Auto-dismisses after 4s (1.5s reduced-motion). Non-blocking.

## Boundaries & Constraints

**Always:**
- Prompt for announce fires **only** on playing the first of K/Q of trump (existing `shouldPromptBelot` guard — `hasBelot(handBeforePlay)` requires both K+Q in hand before play). No prompt on the second card — already correct. Confirmed via [server/internal/game/declarations.go:294-310](server/internal/game/declarations.go#L294-L310).
- If the player skips the first K/Q prompt, they cannot announce later — already correct.
- The reveal shows **only the card that triggered the announcement**, not both K+Q. The other card is still in the announcer's hand and stays hidden until naturally played.
- Reveal is non-blocking: `pointer-events-none`, no modal, no focus trap.
- Reveal placement: same anchoring pattern as declaration reveal (seat-anchored via `compassOffset`). If both a declaration reveal and a belot reveal could theoretically overlap in time, they won't in practice — declarations resolve at trick 2 start, Belot announce fires mid-trick on a K/Q play. No z-index conflict expected.
- Points still flow through existing `handleAnnounceBelot` → `HandPoints[team] += 20`. The reveal is purely visual; does not mutate score paths. ScorePanel's "+X this hand" line reflects the pending +20 naturally.
- `prefers-reduced-motion` reduces the reveal duration to 1.5s and drops slide-in animation.

**Ask First:**
- Any change to the announce/skip action semantics (still the same two actions).
- Any change to the point value (+20 for K+Q of trump held by same player).
- Any change that would reveal the second K/Q before it's actually played.

## Rule Reference

- **Belot (bela):** announced when playing the **Queen** of trump, provided the player also holds the King of trump in hand. +20 to the announcer's team.
- **Re-belot (re-bela):** announced when playing the **King** of trump, provided the player also holds the Queen of trump in hand. +20 to the announcer's team.
- The player picks one moment to announce — whichever K/Q they play first. If they decline at that moment, the bonus is forfeit; they cannot re-claim it when playing the other card.
- Points remain pending until hand end (failed-contract rules can transfer them).
- **Both variants (Bitola + Croatian future) behave identically** for Belot / Re-belot.

## Implementation Outline

**Server — [server/internal/ws/events.go](server/internal/ws/events.go):**
- Extend `BelotAnnouncedPayload` to include `CardID string` (JSON: `cardId`).

**Server — [server/internal/session/manager.go](server/internal/session/manager.go):**
- In the `case game.ActionAnnounceBelot, game.ActionSkipBelot:` branch (around line 477), include the triggering card ID in the `belot` map. The card is the last entry of `oldState.CurrentTrick` immediately before the announce action (the K/Q that was just played and whose post-play flow was paused on the Belot prompt). Capture it from `oldState.CurrentTrick[len(oldState.CurrentTrick)-1].Card.String()`.

**Client — [client/src/features/game/components/BelotPrompt.tsx](client/src/features/game/components/BelotPrompt.tsx):**
- Accept a new prop `isKing: boolean` (or `cardRank: "Q" | "K"`). Switch title from a single i18n key to two: `game.belot.titleBelot` ("Announce Belot?") vs `game.belot.titleRebelot` ("Announce Re-belot?"). Do the same for the description/button label where it reads "Announce".
- Caller (GamePage) determines the rank from `state.currentTrick`'s last played card (the K/Q that triggered the prompt).

**Client — [client/src/features/game/GamePage.tsx](client/src/features/game/GamePage.tsx):**
- When `showBelotPrompt` is true, compute `isKing` from the last played card in the current trick. Pass to `BelotPrompt`.

**Client — NEW [client/src/features/game/components/BelotReveal.tsx](client/src/features/game/components/BelotReveal.tsx):**
- Pattern after `DeclarationReveal`: absolute-positioned panel anchored near the announcing seat via `compassOffset`.
- Props: `{ playerSeat: number, myPlayerSeat: number, cardId: string, isKing: boolean, onComplete: () => void }`.
- Shows a large label "Belot!" or "Re-belot!" plus one `<PlayingCard size="sm" state="default" />` rendered from the `cardId`.
- Auto-dismiss after 4s (1.5s reduced-motion). `pointer-events-none`.
- `data-testid="belot-reveal"`.

**Client — [client/src/features/game/components/BelotReveal.test.tsx](client/src/features/game/components/BelotReveal.test.tsx):** NEW FILE.
- Mirror `DeclarationReveal.test.tsx`: (a) renders label and card; (b) auto-dismisses at 4s; (c) prefers-reduced-motion shortens to 1.5s; (d) `onComplete` fires; (e) correct label for King vs Queen.

**Client — [client/src/shared/stores/gameStore.ts](client/src/shared/stores/gameStore.ts):**
- Add `belotReveal: BelotAnnouncedPayload | null` state and `setBelotReveal(payload)` setter. Pattern mirrors `declarationReveal`.

**Client — [client/src/shared/hooks/useWsDispatch.ts](client/src/shared/hooks/useWsDispatch.ts):**
- Replace the no-op `EVENT_BELOT_ANNOUNCED` branch with `store.setBelotReveal(message.payload as BelotAnnouncedPayload)`.

**Client — [client/src/features/game/GamePage.tsx](client/src/features/game/GamePage.tsx):**
- Render `<BelotReveal>` when `belotReveal` is set (similar to `declarationReveal`).

**Client — [client/src/shared/types/wsEvents.ts](client/src/shared/types/wsEvents.ts):**
- Extend `BelotAnnouncedPayload` with `cardId: string` to match the server.

**i18n:**
- `game.belot.titleBelot` / `game.belot.titleRebelot`.
- `game.belot.announceBelot` / `game.belot.announceRebelot`.
- `game.belot.reveal.belot` → "Belot!".
- `game.belot.reveal.rebelot` → "Re-belot!".
- Update EN and SR locale files.

## Files

**New:**
- `client/src/features/game/components/BelotReveal.tsx`.
- `client/src/features/game/components/BelotReveal.test.tsx`.

**Modified:**
- `server/internal/ws/events.go` — extend `BelotAnnouncedPayload`.
- `server/internal/session/manager.go` — include `cardId` in belot broadcast.
- `client/src/shared/types/wsEvents.ts` — extend type.
- `client/src/features/game/components/BelotPrompt.tsx` — rank-aware label.
- `client/src/features/game/components/BelotPrompt.test.tsx` — assert correct label per rank.
- `client/src/features/game/GamePage.tsx` — rank detection, mount `BelotReveal`.
- `client/src/shared/stores/gameStore.ts` — `belotReveal` state + setter.
- `client/src/shared/hooks/useWsDispatch.ts` — populate `belotReveal`.
- `client/src/shared/i18n/en.json`, `sr.json` — new keys.

## Acceptance

- **Given** the player holds K♣+Q♣ of trump and their turn comes to play the **Queen** first
  **When** they click Q♣
  **Then** the Belot prompt reads "Announce Belot?" with "Announce Belot" and "Skip" buttons.
  **And** on Announce, all four players see a small panel near the announcing seat showing "Belot!" and the Q♣ card. The panel auto-dismisses after 4s.
  **And** +20 is added to the announcing team's pending hand total.
  **And** when the announcer later plays K♣ in a subsequent trick, no prompt fires and no reveal appears.

- **Given** the player holds K♣+Q♣ and plays the **King** first
  **When** they click K♣
  **Then** the prompt reads "Announce Re-belot?" and the reveal shows "Re-belot!" with the K♣ card.

- **Given** the player skips the prompt on their first K/Q play
  **When** they later play the other K/Q
  **Then** no prompt appears and no Belot points are awarded.

- **Given** the announcer's contracting team later fails the hand
  **When** hand scoring runs
  **Then** the +20 is part of the "all points to opponent" transfer (already correct server-side; reveal has no effect on scoring path).

## Test Plan

- `go test ./server/internal/game/... ./server/internal/session/... ./server/internal/ws/...` — new payload field covered.
- `npx vitest run` — all existing + new tests green.
- `npx tsc --noEmit` — clean.
- Manual/Playwright: play through a hand where the dealer forces K+Q of trump to the human player. Announce Belot on Q-first play. Verify the prompt label, the reveal card, the auto-dismiss duration, the pending score bump, and the absence of any prompt/reveal on the second card. Repeat with K-first.

</frozen-after-approval>
