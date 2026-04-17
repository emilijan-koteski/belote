import type { Card, Declaration, Rank, Suit } from "@/shared/types/gameTypes";

// Natural rank order for sequences: 7 < 8 < 9 < T < J < Q < K < A.
const NATURAL_RANK_INDEX: Record<Rank, number> = {
  "7": 0,
  "8": 1,
  "9": 2,
  T: 3,
  J: 4,
  Q: 5,
  K: 6,
  A: 7,
};

const SEQUENCE_POINTS: Record<number, number> = {
  3: 20,
  4: 50,
  // 5+ = 100 (handled below)
};

// Only ranks with non-zero card points are declarable (no 4x7 or 4x8).
const FOUR_OF_A_KIND_POINTS: Partial<Record<Rank, number>> = {
  J: 200,
  "9": 150,
  A: 100,
  T: 100,
  K: 100,
  Q: 100,
};

/**
 * Mirror of server/internal/game/declarations.go `detectDeclarations`.
 * Scans a hand for sequences (3+ consecutive same-suit cards in natural order)
 * and four-of-a-kind (same rank across all 4 suits). Longer sequences subsume
 * shorter subsequences within them.
 */
export function detectDeclarations(hand: Card[]): Declaration[] {
  const decls: Declaration[] = [];

  // Sequences
  const bySuit: Record<Suit, Card[]> = { S: [], H: [], D: [], C: [] };
  for (const c of hand) {
    bySuit[c.suit].push(c);
  }

  for (const suit of Object.keys(bySuit) as Suit[]) {
    const cards = bySuit[suit];
    if (cards.length < 3) continue;
    cards.sort((a, b) => NATURAL_RANK_INDEX[a.rank] - NATURAL_RANK_INDEX[b.rank]);

    let seqStart = 0;
    for (let i = 1; i <= cards.length; i++) {
      const prev = cards[i - 1];
      const curr = cards[i];
      const consecutive =
        i < cards.length &&
        prev !== undefined &&
        curr !== undefined &&
        NATURAL_RANK_INDEX[curr.rank] === NATURAL_RANK_INDEX[prev.rank] + 1;
      if (!consecutive) {
        const seqLen = i - seqStart;
        if (seqLen >= 3) {
          const seqCards = cards.slice(seqStart, i);
          const pts = SEQUENCE_POINTS[seqLen] ?? 100;
          decls.push({
            type: "sequence",
            cards: seqCards,
            value: pts,
            playerSeat: -1,
          });
        }
        seqStart = i;
      }
    }
  }

  // Four-of-a-kind
  const byRank: Partial<Record<Rank, Card[]>> = {};
  for (const c of hand) {
    const arr = byRank[c.rank] ?? [];
    arr.push(c);
    byRank[c.rank] = arr;
  }
  for (const rank of Object.keys(byRank) as Rank[]) {
    const cards = byRank[rank];
    if (cards && cards.length === 4) {
      const pts = FOUR_OF_A_KIND_POINTS[rank];
      if (pts !== undefined) {
        decls.push({
          type: "four_of_a_kind",
          cards: cards.slice(),
          value: pts,
          playerSeat: -1,
        });
      }
    }
  }

  // TODO(croatian-variant): skip dedup for the Croatian variant when added —
  // there a card may participate in multiple declarations.
  return dedupBitola(decls);
}

/**
 * Applies the Bitola-variant rule: one card, one group. Among declarations
 * that share at least one card, the highest-value one is kept and the rest
 * are dropped. Stable — original order is preserved among survivors; for
 * equal-value ties, the earlier declaration wins.
 */
function dedupBitola(decls: Declaration[]): Declaration[] {
  if (decls.length <= 1) return decls;

  const order = decls.map((_, i) => i);
  // Stable sort by value descending (Array.sort in modern engines is stable).
  order.sort((a, b) => decls[b]!.value - decls[a]!.value);

  const used = new Set<string>();
  const keep = new Array<boolean>(decls.length).fill(false);
  for (const idx of order) {
    const d = decls[idx]!;
    let conflict = false;
    for (const c of d.cards) {
      if (used.has(`${c.rank}${c.suit}`)) {
        conflict = true;
        break;
      }
    }
    if (conflict) continue;
    for (const c of d.cards) {
      used.add(`${c.rank}${c.suit}`);
    }
    keep[idx] = true;
  }

  return decls.filter((_, i) => keep[i]);
}
