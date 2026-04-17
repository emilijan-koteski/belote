import type { Card, GameState, Rank, Suit, TrickCard } from "@/shared/types/gameTypes";

const TRUMP_RANK_ORDER: Record<Rank, number> = {
  J: 7,
  "9": 6,
  A: 5,
  T: 4,
  K: 3,
  Q: 2,
  "8": 1,
  "7": 0,
};

const NON_TRUMP_RANK_ORDER: Record<Rank, number> = {
  A: 7,
  T: 6,
  K: 5,
  Q: 4,
  J: 3,
  "9": 2,
  "8": 1,
  "7": 0,
};

function teamForSeat(seat: number): number {
  return seat % 2;
}

function filterBySuit(hand: Card[], suit: Suit): Card[] {
  return hand.filter((c) => c.suit === suit);
}

function cardStrength(card: Card, trumpSuit: Suit): number {
  return card.suit === trumpSuit ? TRUMP_RANK_ORDER[card.rank] : NON_TRUMP_RANK_ORDER[card.rank];
}

function highestTrumpInTrick(trick: TrickCard[], trumpSuit: Suit): Rank | null {
  let best: Rank | null = null;
  let bestOrder = -1;
  for (const tc of trick) {
    if (tc.card.suit === trumpSuit) {
      const order = TRUMP_RANK_ORDER[tc.card.rank];
      if (order > bestOrder) {
        bestOrder = order;
        best = tc.card.rank;
      }
    }
  }
  return best;
}

function applyOverTrump(trumpCards: Card[], trick: TrickCard[], trumpSuit: Suit): Card[] {
  const highest = highestTrumpInTrick(trick, trumpSuit);
  if (highest === null) return [];
  const highestOrder = TRUMP_RANK_ORDER[highest];
  return trumpCards.filter((c) => TRUMP_RANK_ORDER[c.rank] > highestOrder);
}

function currentTrickWinnerSeat(trick: TrickCard[], trumpSuit: Suit): number {
  const first = trick[0];
  if (!first) return -1;
  const ledSuit = first.card.suit;
  let bestSeat = first.playerSeat;
  let bestIsTrump = first.card.suit === trumpSuit;
  let bestOrder = cardStrength(first.card, trumpSuit);

  for (let i = 1; i < trick.length; i++) {
    const tc = trick[i];
    if (!tc) continue;
    const isTrump = tc.card.suit === trumpSuit;
    const isLed = tc.card.suit === ledSuit;
    const order = cardStrength(tc.card, trumpSuit);

    if (isTrump && !bestIsTrump) {
      bestSeat = tc.playerSeat;
      bestIsTrump = true;
      bestOrder = order;
    } else if (isTrump && bestIsTrump && order > bestOrder) {
      bestSeat = tc.playerSeat;
      bestOrder = order;
    } else if (!isTrump && !bestIsTrump && isLed && order > bestOrder) {
      bestSeat = tc.playerSeat;
      bestOrder = order;
    }
  }
  return bestSeat;
}

function isOpponentWinning(state: GameState, seat: number): boolean {
  const currentTrick = state.currentTrick ?? [];
  if (currentTrick.length === 0 || state.trumpSuit === null) return false;
  const winnerSeat = currentTrickWinnerSeat(currentTrick, state.trumpSuit);
  return teamForSeat(winnerSeat) !== teamForSeat(seat);
}

/**
 * Mirror of server/internal/game/validation.go `legalCards`. Returns the subset
 * of the seat's hand that is legal to play given the current trick state.
 * Bitola variant: follow suit, over-trump when led suit is trump, trump
 * obligation when void in led suit and opponent is winning, partner exemption.
 */
export function legalCards(state: GameState, seat: number): Card[] {
  const player = state.players[seat];
  if (!player) return [];
  const hand = player.hand ?? [];

  // currentTrick can be null on the wire during trick resolution (server emits
  // nil between tricks, which JSON-serializes to null). Treat null/empty as
  // "leading the next trick" → any card is legal.
  const currentTrick = state.currentTrick ?? [];
  if (currentTrick.length === 0) return hand;
  if (state.trumpSuit === null) return hand;

  const trumpSuit = state.trumpSuit;
  // Derive the led suit from the first card in the trick rather than
  // state.leadSuit. The server sends event:card_played and event:game_state
  // as separate messages; between them the client briefly has currentTrick
  // populated but leadSuit still stale from the previous trick's cleanup.
  // currentTrick[0] is atomically consistent with the current trick, so
  // using it closes that race — no "all cards legal" flash.
  const first = currentTrick[0];
  if (!first) return hand;
  const ledSuit = first.card.suit;
  const suitCards = filterBySuit(hand, ledSuit);

  if (suitCards.length > 0) {
    if (ledSuit === trumpSuit) {
      const overTrumps = applyOverTrump(suitCards, currentTrick, trumpSuit);
      if (overTrumps.length > 0) return overTrumps;
    }
    return suitCards;
  }

  const trumpCards = filterBySuit(hand, trumpSuit);
  if (isOpponentWinning(state, seat) && trumpCards.length > 0) {
    const overTrumps = applyOverTrump(trumpCards, currentTrick, trumpSuit);
    if (overTrumps.length > 0) return overTrumps;
    return trumpCards;
  }

  return hand;
}

export function legalCardIds(state: GameState, seat: number): string[] {
  return legalCards(state, seat).map((c) => `${c.rank}${c.suit}`);
}
