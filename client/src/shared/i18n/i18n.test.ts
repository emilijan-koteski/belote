import { describe, expect, it } from "vitest";

import en from "./en.json";
import { i18n } from "./i18n";
import sr from "./sr.json";

function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object") {
      out.push(...flattenKeys(v, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

describe("i18n", () => {
  it("returns English translation by default", () => {
    expect(i18n.t("common.appName")).toBe("Belote");
  });

  it("returns Serbian translation when language is changed", async () => {
    await i18n.changeLanguage("sr");
    expect(i18n.t("common.appName")).toBe("Belote");
    await i18n.changeLanguage("en");
  });

  it("en.json and sr.json have identical key sets", () => {
    const enKeys = flattenKeys(en).sort();
    const srKeys = flattenKeys(sr).sort();
    const missingInSr = enKeys.filter((k) => !srKeys.includes(k));
    const missingInEn = srKeys.filter((k) => !enKeys.includes(k));
    expect(missingInSr, `keys missing in sr.json: ${missingInSr.join(", ")}`).toEqual([]);
    expect(missingInEn, `keys missing in en.json: ${missingInEn.join(", ")}`).toEqual([]);
  });
});
