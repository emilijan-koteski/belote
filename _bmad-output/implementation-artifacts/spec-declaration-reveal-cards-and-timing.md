---
title: 'Declaration reveal: winning cards shown at start of trick 2, seat-anchored'
type: 'feature'
created: '2026-04-17'
status: 'ready-for-dev'
context: ['spec-declaration-prompt-sum-and-bitola-dedup.md']
baseline_commit: 'TBD (HEAD at implementation time)'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The `event:declarations_resolved` broadcast already carries the winning team's full card data (see [server/internal/session/manager.go:446-475](server/internal/session/manager.go#L446-L475)), but [client/src/features/game/components/DeclarationReveal.tsx](client/src/features/game/components/DeclarationReveal.tsx) renders only "+{totalValue}" and a team label. Other players never see which cards won. Worse, the large "+100" implies points are locked in, but the contracting team can still fail the hand and transfer everything.

**Approach:**
1. Rework DeclarationReveal from a centered overlay to a **small panel anchored to the winning player's seat** (option b from the requirements).
2. Render the **actual cards** of the winning declaration(s) — using the existing `PlayingCard` component, size `sm`. Multiple declarations from the same team stack vertically.
3. Drop the big "+100" number from the reveal. The ScorePanel's existing "+X this hand" line is the authoritative pending-points surface.
4. **Auto-dismiss after 4 seconds**, no click-to-dismiss (auto-only per requirement #6). Use an un-screenshottable duration: long enough to read 4 cards, short enough to prevent precise memorization of 8.
5. **Trigger timing:** the reveal fires when trick 2 begins and the first player is about to play. The server already broadcasts `event:declarations_resolved` immediately after trick 1 resolution (which is when trick 2 begins). Current client logic stores this payload and renders the overlay immediately — that matches the requirement. No server change needed for timing.

## Boundaries & Constraints

**Always:**
- The reveal is non-blocking: turn continues normally after auto-dismiss. It must NOT be a modal (no backdrop, no focus trap).
- `pointer-events-none` on the wrapper so it cannot intercept card clicks if the reveal duration overlaps with the first player's turn.
- Anchoring: positioned absolute relative to the game-table container, offset near the winning player's seat based on `compassOffset(winnerSeat, myPlayerSeat)` (same pattern used by PlayerSeat placement in [GamePage.tsx:39-41](client/src/features/game/GamePage.tsx#L39-L41)). A small visual connector (a line or a subtle arrow) points from the panel toward the seat — optional, implement only if layout permits.
- Shows the winning team's **every** declaration the winner had (the server already sends all surviving winning-team declarations; there may be more than one if the winner happens to have both a sequence and a FoaK post-dedup — rare but possible).
- Losing team's declarations are never broadcast (server clears them in `resolveDeclarationsForHand`), never rendered. Confirmed in spec goal 2 AC #7.
- When no team declared, no reveal fires (`winnerTeam === null`). Existing early-return preserved.
- `prefers-reduced-motion` reduces the 4s duration to 1.5s (was 2s/500ms; keep ratio sane) and drops slide-in animation.

**Ask First:**
- Any change to the server's `event:declarations_resolved` payload shape (already carries everything needed).
- Any change to *when* the reveal fires (requirement #2 is explicit: start of trick 2 before first card).
- Any change to the ScorePanel's pending-points treatment (covered by the existing `spec-score-panel-hand-potential.md` — this spec does NOT modify ScorePanel).

## Rule Reference

- **Bitola:** declaration prompt per-player during trick 1, reveal at start of trick 2. Current behavior, unchanged.
- **Croatian (deferred):** declaration is its own phase between bidding and trick 1 — all players click yes/no — reveal at start of trick 1. Documented in [project-context.md](_bmad-output/project-context.md) variant differences section. Not implemented.
- Reveal shows only the winning team's declarations. Points become real only at hand-end scoring (failed contract can transfer everything).

## Implementation Outline

**Client — [client/src/features/game/components/DeclarationReveal.tsx](client/src/features/game/components/DeclarationReveal.tsx):**
- Change the root container from centered overlay to absolute-positioned panel anchored off the winning player's seat (use the `compassOffset` helper exported from GamePage, or duplicate the small function here).
- New props needed: `myPlayerSeat: number`. Update the caller in GamePage.
- Parse each declaration's `cards: string[]` (card-ID strings like `"JD"`) into `Card` objects via the existing `parseCard`-equivalent — there is no client `parseCard` today, so write a small inline parser: `{ rank: id[0] as Rank, suit: id[1] as Suit }`.
- Render layout:
  ```
  <small-panel>
    <label>{winnerTeamName}</label>   ← e.g. "Blue Team declared"
    {declarations.map(d => (
      <row>
        <group-label>{type+length}</group-label>
        <cards>{d.cards.map(c => <PlayingCard card={parse(c)} state="default" size="sm" withTransition={false} />)}</cards>
      </row>
    ))}
  </small-panel>
  ```
- Drop the `+{totalValue}` `<p>` entirely.
- Duration: `const duration = prefersReducedMotion ? 1500 : 4000;`.
- Keep `data-testid="declaration-reveal"` unchanged.

**Client — [client/src/features/game/GamePage.tsx](client/src/features/game/GamePage.tsx):**
- Pass `myPlayerSeat` prop to `<DeclarationReveal>`.

**Client — [client/src/features/game/components/DeclarationReveal.test.tsx](client/src/features/game/components/DeclarationReveal.test.tsx):**
- Update existing tests that assert `+{total}` text — remove those assertions.
- Add tests: (a) cards are rendered (query for each card's testid `playing-card-{id}`); (b) winner team label renders; (c) auto-dismisses after 4s via `vi.useFakeTimers()`; (d) `winnerTeam === null` → nothing renders; (e) multiple declarations stack.

**i18n — [client/src/shared/i18n/en.json](client/src/shared/i18n/en.json), sr.json:**
- Replace the bare `game.declaration.resolved` ("Declarations") with a team-scoped string. Add `game.declaration.teamDeclared` → "{{team}} declared" (e.g. "Blue Team declared"). Keep `game.declaration.teamRed`/`teamBlue` for the team name interpolation.

## Files

**New:** none.

**Modified:**
- `client/src/features/game/components/DeclarationReveal.tsx` — rewrite layout + card rendering.
- `client/src/features/game/components/DeclarationReveal.test.tsx` — update assertions, add card-render and duration tests.
- `client/src/features/game/GamePage.tsx` — pass `myPlayerSeat` prop.
- `client/src/shared/i18n/en.json`, `sr.json` — `game.declaration.teamDeclared` key.

## Acceptance

- **Given** trick 1 ends with Blue Team's best = FoaK Queens (4 cards)
  **When** the reveal fires
  **Then** a small panel appears near the winning player's seat with the label "Blue Team declared" and 4 playing cards rendered (Q♣ Q♦ Q♠ Q♥) with full suit colors.
  **And** no "+100" number is shown in the reveal itself.
  **And** after 4 seconds the panel disappears automatically.
  **And** the panel never intercepts card clicks during its lifetime.

- **Given** both teams declared but Red's tierce (20) loses to Blue's FoaK (100)
  **When** the reveal fires
  **Then** only Blue's FoaK cards appear. Red's tierce is not shown.

- **Given** `winnerTeam === null` (nobody declared)
  **When** the game reaches trick 2
  **Then** no reveal overlay is rendered.

- **Given** the failed-contract scenario (Blue declares 100, Blue later fails the hand)
  **When** hand scoring runs
  **Then** the points transfer to Red per existing logic; the reveal had already expired and is not re-shown. ScorePanel's "+X this hand" line reflects the final transfer at hand end.

## Test Plan

- `npx vitest run src/features/game/components/DeclarationReveal.test.tsx` — updated suite green.
- Full `npx vitest run` — no regressions.
- `npx tsc --noEmit` — clean.
- Manual/Playwright: deal a hand with a declaration winner, verify reveal location (seat-anchored), cards visible with correct suit colors, 4s duration, no click-blocking.

</frozen-after-approval>
