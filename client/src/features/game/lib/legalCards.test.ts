import { describe, expect, it } from "vitest";

import type { Card, GameState, PlayerState, Suit, TrickCard } from "@/shared/types/gameTypes";

import { legalCardIds, legalCards } from "./legalCards";

function card(id: string): Card {
  return { rank: id[0] as Card["rank"], suit: id[1] as Card["suit"] };
}

function hand(ids: string[]): Card[] {
  return ids.map(card);
}

function trickCard(id: string, seat: number): TrickCard {
  return { card: card(id), playerSeat: seat };
}

function player(seat: number, cards: Card[]): PlayerState {
  return {
    seat,
    hand: cards,
    userId: seat + 1,
    username: `p${seat}`,
    team: seat % 2 === 0 ? "red" : "blue",
    declarations: [],
    connected: true,
  };
}

function makeState(args: {
  mySeat: number;
  myHand: Card[];
  trumpSuit: Suit | null;
  leadSuit: Suit | null;
  currentTrick: TrickCard[];
}): GameState {
  const hands: Record<number, Card[]> = {
    0: [],
    1: [],
    2: [],
    3: [],
  };
  hands[args.mySeat] = args.myHand;
  return {
    id: 1,
    roomId: 1,
    variant: "bitola",
    matchMode: "1001",
    phase: "playing",
    ownerSeat: 0,
    handNumber: 1,
    dealerSeat: 0,
    trumpSuit: args.trumpSuit,
    trumpCallerSeat: null,
    trumpCandidate: null,
    biddingRound: 1,
    biddingPassCount: 0,
    deck: [],
    activePlayerSeat: args.mySeat,
    trickNumber: 1,
    currentTrick: args.currentTrick,
    leadSuit: args.leadSuit,
    trickWinnerSeat: null,
    awaitingDeclaration: false,
    declarationsResolved: false,
    players: [
      player(0, hands[0] ?? []),
      player(1, hands[1] ?? []),
      player(2, hands[2] ?? []),
      player(3, hands[3] ?? []),
    ],
    teamScores: [0, 0],
    handPoints: [0, 0],
    declarationPoints: [0, 0],
    tricksWon: [0, 0],
    pendingBelotSeat: null,
    belotAnnounced: false,
    winnerTeam: null,
    lastHandResult: null,
    turnExpiresAt: null,
    timerDurationSec: 30,
    previousPhase: "",
    pausedPlayers: [false, false, false, false],
    pauseUsed: [false, false, false, false],
    turnTimeRemaining: 30,
    disconnectedSeat: -1,
    reconnectExpiresAt: null,
  };
}

describe("legalCards", () => {
  it("returns full hand when leading", () => {
    const myHand = hand(["7S", "KD", "AC"]);
    const state = makeState({
      mySeat: 0,
      myHand,
      trumpSuit: "C",
      leadSuit: null,
      currentTrick: [],
    });
    expect(legalCards(state, 0)).toEqual(myHand);
  });

  it("must follow led suit and overplay highest non-trump led-suit card on the table", () => {
    // Trump is clubs; spades led with QS, then opponent KS (non-trump rank
    // order: K=5, Q=4). Hand has TS (6), 7S (0). Must overplay → only TS.
    const myHand = hand(["7S", "TS", "KD", "AC"]);
    const state = makeState({
      mySeat: 3,
      myHand,
      trumpSuit: "C",
      leadSuit: "S",
      currentTrick: [trickCard("QS", 0), trickCard("KS", 1), trickCard("7H", 2)],
    });
    expect(legalCards(state, 3).map((c) => `${c.rank}${c.suit}`)).toEqual(["TS"]);
  });

  it("falls back to all led non-trump suit cards when no overplay exists", () => {
    // Trump is diamonds; hearts led with KH. Hand: 7H (0), 8H (1) — both
    // below KH (5). No overplay possible → both 7H and 8H are legal (rule 2).
    const myHand = hand(["7H", "8H"]);
    const state = makeState({
      mySeat: 2,
      myHand,
      trumpSuit: "D",
      leadSuit: "H",
      currentTrick: [trickCard("KH", 1)],
    });
    expect(legalCards(state, 2).map((c) => `${c.rank}${c.suit}`)).toEqual(["7H", "8H"]);
  });

  it("must overplay led non-trump even when an opponent already trumped", () => {
    // Trump is diamonds. Hearts led with KH; seat 3 (opponent of seat 2)
    // trumped with 7D. Hand has 8H, AH. The trump in trick does not change
    // the led-suit overplay obligation: highest hearts on table is still KH,
    // so AH (7) must be played; 8H (1) is excluded.
    const myHand = hand(["8H", "AH", "KC"]);
    const state = makeState({
      mySeat: 2,
      myHand,
      trumpSuit: "D",
      leadSuit: "H",
      currentTrick: [trickCard("KH", 1), trickCard("7D", 3)],
    });
    expect(legalCards(state, 2).map((c) => `${c.rank}${c.suit}`)).toEqual(["AH"]);
  });

  it("multiple higher led-suit cards — all strictly higher are legal", () => {
    // Trump=diamonds. Hearts led with JH (non-trump rank 3). Hand has QH (4),
    // KH (5), AH (7) — all strictly higher than JH. The helper must return
    // every overplay, not just the maximum.
    const myHand = hand(["QH", "KH", "AH", "8C"]);
    const state = makeState({
      mySeat: 1,
      myHand,
      trumpSuit: "D",
      leadSuit: "H",
      currentTrick: [trickCard("JH", 0)],
    });
    expect(legalCards(state, 1).map((c) => `${c.rank}${c.suit}`)).toEqual(["QH", "KH", "AH"]);
  });

  it("must overplay led non-trump even when highest card on table came from partner", () => {
    // Partner exemption applies only to void-in-led-suit (rule 3). When the
    // player has led-suit cards, the overplay rule still applies regardless
    // of who played the current high card.
    // Trump=diamonds. Seat 2 (partner of seat 0) led KH; seat 1 (opp) plays 7H.
    // Seat 0's hand: 8H, AH. Must overplay → only AH.
    const myHand = hand(["8H", "AH"]);
    const state = makeState({
      mySeat: 0,
      myHand,
      trumpSuit: "D",
      leadSuit: "H",
      currentTrick: [trickCard("KH", 2), trickCard("7H", 1)],
    });
    expect(legalCards(state, 0).map((c) => `${c.rank}${c.suit}`)).toEqual(["AH"]);
  });

  it("must over-trump when led suit is trump and over-trump exists", () => {
    // Trump is spades, led spades with 9S (order 6). My hand has JS (7) and 7S (0).
    // Must play JS (only over-trump).
    const myHand = hand(["7S", "JS", "AH"]);
    const state = makeState({
      mySeat: 1,
      myHand,
      trumpSuit: "S",
      leadSuit: "S",
      currentTrick: [trickCard("9S", 0)],
    });
    expect(legalCards(state, 1).map((c) => `${c.rank}${c.suit}`)).toEqual(["JS"]);
  });

  it("falls back to any card of led trump suit when no over-trump", () => {
    // Trump is spades, led spades with JS (order 7, top). No over-trump possible.
    // Can play any spade.
    const myHand = hand(["7S", "9S", "AH"]);
    const state = makeState({
      mySeat: 1,
      myHand,
      trumpSuit: "S",
      leadSuit: "S",
      currentTrick: [trickCard("JS", 0)],
    });
    expect(legalCards(state, 1).map((c) => `${c.rank}${c.suit}`)).toEqual(["7S", "9S"]);
  });

  it("must trump when void in led suit and opponent is winning", () => {
    // Opponent (seat 0, Red) led 10D and is winning the trick.
    // I'm seat 1 (Blue), void in diamonds, holding two clubs (trump) and a heart.
    // Must trump.
    const myHand = hand(["8C", "9C", "AH"]);
    const state = makeState({
      mySeat: 1,
      myHand,
      trumpSuit: "C",
      leadSuit: "D",
      currentTrick: [trickCard("TD", 0)],
    });
    const ids = legalCards(state, 1).map((c) => `${c.rank}${c.suit}`);
    expect(ids.sort()).toEqual(["8C", "9C"]);
  });

  it("must over-trump when void and opponent has already trumped", () => {
    // Led diamonds. Seat 2 (opponent of seat 1) trumped with 8C (order 1).
    // I'm seat 1, void in diamonds. My trumps: 7C (order 0), JC (order 7).
    // Must over-trump → only JC.
    const myHand = hand(["7C", "JC", "AH"]);
    const state = makeState({
      mySeat: 1,
      myHand,
      trumpSuit: "C",
      leadSuit: "D",
      currentTrick: [trickCard("TD", 0), trickCard("8C", 2)],
    });
    expect(legalCards(state, 1).map((c) => `${c.rank}${c.suit}`)).toEqual(["JC"]);
  });

  it("partner exemption: void in led suit, partner winning → any card", () => {
    // Seat 0 led TD. Partner (seat 2) trumped with JC (winning).
    // I'm seat 0... wait — seat 0 led. Let me use seat 2 instead. Actually:
    // Seat 1 leads TD. Seat 2 (opponent of seat 1) takes with JC. Seat 3 (partner of seat 1).
    // For seat 3: partner would be seat 1, but seat 1 led and is losing. Let me re-pick.
    //
    // Cleaner: seat 0 leads. Seat 1 plays. Seat 2 (partner of 0) trumps. Seat 3's turn.
    // Seat 3 is partner of seat 1 (both Blue). But seat 2 is winning, so seat 3 must trump.
    //
    // Correct scenario: seat 0 leads TD. Seat 1 plays 7D. Seat 2 (partner of 0) trumps 8C.
    // Now seat 3 plays — seat 3 is opponent of seat 2, so opponent-winning check runs.
    // For partner-winning, I need winning seat's team == my team.
    //
    // Use: seat 1 leads TD. Seat 2 plays 7D. Seat 3 (partner of 1) trumps JC. Seat 0's turn.
    // Seat 0 is partner of seat 2 (both Red, seats 0+2). Winner is seat 3 (Blue) — opponent.
    // Wrong again. Let me be explicit:
    //   Team Red = seats 0, 2; Team Blue = seats 1, 3
    //   Partner of seat 0 = seat 2; partner of seat 1 = seat 3.
    //
    // Scenario for partner winning: seat 2 (Red) leads, seat 3 plays, seat 0 (partner of 2) plays.
    // Use: seat 2 leads TD. Seat 3 plays 7D. I'm seat 0 (partner of seat 2).
    // Winning seat = seat 2 (led TD, no trump played). Seat 2 team = 0 = my team → partner winning.
    // I'm void in diamonds, void or not of trump — any card legal.
    const myHand = hand(["8C", "9C", "AH"]);
    const state = makeState({
      mySeat: 0,
      myHand,
      trumpSuit: "C",
      leadSuit: "D",
      currentTrick: [trickCard("TD", 2), trickCard("7D", 3)],
    });
    const ids = legalCards(state, 0).map((c) => `${c.rank}${c.suit}`);
    expect(ids.sort()).toEqual(["8C", "9C", "AH"]);
  });

  it("void in led suit, no trump held → any card", () => {
    const myHand = hand(["AH", "KH", "7S"]);
    const state = makeState({
      mySeat: 1,
      myHand,
      trumpSuit: "C",
      leadSuit: "D",
      currentTrick: [trickCard("TD", 0)],
    });
    const ids = legalCards(state, 1).map((c) => `${c.rank}${c.suit}`);
    expect(ids.sort()).toEqual(["7S", "AH", "KH"]);
  });

  it("derives led suit from currentTrick[0] when leadSuit is stale/null (race between card_played and game_state)", () => {
    // Simulates the window after event:card_played has appended the opener to
    // currentTrick but the follow-up event:game_state hasn't synced leadSuit yet.
    // Without deriving from currentTrick, the leadSuit===null fallback would
    // return the full hand and all cards would flash as legal.
    const myHand = hand(["7S", "KS", "AH", "9D"]);
    const state = makeState({
      mySeat: 0,
      myHand,
      trumpSuit: "C",
      leadSuit: null,
      currentTrick: [trickCard("KD", 3)],
    });
    expect(legalCards(state, 0).map((c) => `${c.rank}${c.suit}`)).toEqual(["9D"]);
  });

  it("tolerates currentTrick === null on the wire (server emits nil between tricks)", () => {
    const myHand = hand(["7S", "KD", "AC"]);
    const state = makeState({
      mySeat: 0,
      myHand,
      trumpSuit: "C",
      leadSuit: null,
      currentTrick: [],
    });
    // Simulate server sending null instead of [] — cast to bypass the type lie.
    (state as unknown as { currentTrick: TrickCard[] | null }).currentTrick = null;
    expect(legalCards(state, 0)).toEqual(myHand);
  });

  it("legalCardIds returns the string-id form", () => {
    const myHand = hand(["7S", "KD"]);
    const state = makeState({
      mySeat: 0,
      myHand,
      trumpSuit: "C",
      leadSuit: null,
      currentTrick: [],
    });
    expect(legalCardIds(state, 0).sort()).toEqual(["7S", "KD"]);
  });
});
