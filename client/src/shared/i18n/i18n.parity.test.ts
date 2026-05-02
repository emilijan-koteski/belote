// i18n parity test. The existing `i18n.test.ts` already runs an equivalent
// assertion bundled with other i18n smoke checks; this file isolates the
// parity gate per the spec (AC-007) so a single dedicated failure points
// directly at translation drift without unrelated i18n behaviour mixed in.
//
// Approach: deep-flatten both en.json and sr.json into dotted key paths
// (e.g. "lobby.roomLobby.startGame", "team.us") and assert the two sets
// are identical. Sorted arrays make the failure diff readable in CI logs.

import { describe, expect, it } from "vitest";

import en from "./en.json";
import sr from "./sr.json";

// flattenKeys walks an arbitrary JSON object and returns the dotted path of
// every leaf. Arrays inside translation files would be flattened too, but
// the project's i18n files contain only nested string maps; the recursion
// handles either shape defensively.
function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") {
    return prefix === "" ? [] : [prefix];
  }
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix === "" ? k : `${prefix}.${k}`;
    if (v !== null && typeof v === "object") {
      out.push(...flattenKeys(v, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

describe("i18n parity", () => {
  it("every key in en.json exists in sr.json (and vice versa)", () => {
    const enKeys = flattenKeys(en).sort();
    const srKeys = flattenKeys(sr).sort();

    const missingInSr = enKeys.filter((k) => !srKeys.includes(k));
    const missingInEn = srKeys.filter((k) => !enKeys.includes(k));

    expect(
      missingInSr,
      `Keys present in en.json but missing in sr.json: ${missingInSr.join(", ")}`,
    ).toEqual([]);
    expect(
      missingInEn,
      `Keys present in sr.json but missing in en.json: ${missingInEn.join(", ")}`,
    ).toEqual([]);
    // Belt-and-suspenders: explicit set equality so a failure shows the
    // sorted full key list in the CI log, not just the first diff.
    expect(srKeys).toEqual(enKeys);
  });
});
