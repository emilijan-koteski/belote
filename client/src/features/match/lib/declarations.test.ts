import { describe, expect, it } from "vitest";

import type { Card } from "@/shared/types/matchTypes";

import { detectDeclarations } from "./declarations";

function card(id: string): Card {
  return { rank: id[0] as Card["rank"], suit: id[1] as Card["suit"] };
}

function hand(ids: string[]): Card[] {
  return ids.map(card);
}

describe("detectDeclarations", () => {
  it("returns empty when no combinations exist", () => {
    expect(detectDeclarations(hand(["7S", "TD", "JH", "KC", "AS"]))).toEqual([]);
  });

  it("detects a tierce (3-card sequence = 20)", () => {
    const decls = detectDeclarations(hand(["7S", "8S", "9S", "TD", "JH"]));
    expect(decls).toHaveLength(1);
    expect(decls[0]?.type).toBe("sequence");
    expect(decls[0]?.value).toBe(20);
    expect(decls[0]?.cards).toHaveLength(3);
  });

  it("detects a quarte (4-card sequence = 50)", () => {
    const decls = detectDeclarations(hand(["JD", "QD", "KD", "AD", "7C", "8C"]));
    expect(decls).toHaveLength(1);
    expect(decls[0]?.value).toBe(50);
    expect(decls[0]?.cards).toHaveLength(4);
  });

  it("detects a 5+ sequence as 100pts", () => {
    const decls = detectDeclarations(hand(["7S", "8S", "9S", "TS", "JS", "7C"]));
    expect(decls).toHaveLength(1);
    expect(decls[0]?.value).toBe(100);
    expect(decls[0]?.cards).toHaveLength(5);
  });

  it("detects FoaK of jacks = 200", () => {
    const decls = detectDeclarations(hand(["JS", "JH", "JD", "JC", "7S"]));
    expect(decls).toHaveLength(1);
    expect(decls[0]?.type).toBe("four_of_a_kind");
    expect(decls[0]?.value).toBe(200);
  });

  it("does not detect four 8s (no point value)", () => {
    expect(detectDeclarations(hand(["8S", "8H", "8D", "8C", "7S"]))).toEqual([]);
  });

  describe("Bitola dedup", () => {
    it("drops tierce sharing a card with higher-value FoaK", () => {
      // 7S-8S-9S tierce (20) + 4x9 FoaK (150) — share 9S
      const decls = detectDeclarations(hand(["7S", "8S", "9S", "9D", "9H", "9C", "JD", "QC"]));
      expect(decls).toHaveLength(1);
      expect(decls[0]?.type).toBe("four_of_a_kind");
      expect(decls[0]?.value).toBe(150);
    });

    it("drops quarte sharing a card with higher-value FoaK of jacks", () => {
      // 9S-TS-JS-QS quarte (50) + 4xJ FoaK (200) — share JS
      const decls = detectDeclarations(hand(["9S", "TS", "JS", "QS", "JH", "JD", "JC", "7C"]));
      expect(decls).toHaveLength(1);
      expect(decls[0]?.type).toBe("four_of_a_kind");
      expect(decls[0]?.value).toBe(200);
    });

    it("keeps two non-overlapping FoaKs", () => {
      const decls = detectDeclarations(hand(["9S", "9H", "9D", "9C", "AS", "AH", "AD", "AC"]));
      expect(decls).toHaveLength(2);
    });

    it("keeps non-overlapping tierce and FoaK", () => {
      // 7S-8S-9S tierce + 4xJ FoaK. Spade run stops at 9 (9→J not consecutive).
      const decls = detectDeclarations(hand(["7S", "8S", "9S", "JS", "JH", "JD", "JC", "7C"]));
      expect(decls).toHaveLength(2);
    });

    it("quarte subsumes tierce in detection — single declaration emitted", () => {
      // Pre-dedup sanity: a 4-card run produces only the maximal quarte.
      const decls = detectDeclarations(hand(["JD", "QD", "KD", "AD", "7S", "8S", "7C", "8C"]));
      expect(decls).toHaveLength(1);
      expect(decls[0]?.value).toBe(50);
      expect(decls[0]?.cards).toHaveLength(4);
    });
  });
});
