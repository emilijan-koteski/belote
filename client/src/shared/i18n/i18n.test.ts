import { afterEach, describe, expect, it } from "vitest";

import en from "./en.json";
import hr from "./hr.json";
import { i18n } from "./i18n";
import mk from "./mk.json";
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
  afterEach(async () => {
    // Reset to default so test ordering can't leak language state between
    // unrelated suites (Vitest shares module state across files in a worker).
    await i18n.changeLanguage("en");
  });

  it("returns English translation by default", () => {
    expect(i18n.t("common.appName")).toBe("Beljot");
  });

  it("returns Serbian when language is sr", async () => {
    await i18n.changeLanguage("sr");
    expect(i18n.t("common.appName")).toBe("Beljot");
    expect(i18n.t("nav.play")).toBe("Igraj");
    // Discriminator vs HR (where chat.title is "Chat lobija"): proves the
    // SR bundle is loaded, not HR with the same `nav.play` value.
    expect(i18n.t("chat.title")).toBe("Lobi chat");
  });

  it("returns Macedonian when language is mk", async () => {
    await i18n.changeLanguage("mk");
    expect(i18n.t("common.appName")).toBe("Beljot");
    expect(i18n.t("nav.play")).toBe("Играј");
  });

  it("returns Croatian when language is hr", async () => {
    await i18n.changeLanguage("hr");
    expect(i18n.t("common.appName")).toBe("Beljot");
    expect(i18n.t("nav.play")).toBe("Igraj");
    // Discriminator vs SR (where chat.title is "Lobi chat"): catches a bug
    // where the HR resource bundle is wired to the SR slot in i18n.ts.
    expect(i18n.t("chat.title")).toBe("Chat lobija");
  });

  it("en.json, sr.json, mk.json, hr.json have identical key sets", () => {
    const enKeys = flattenKeys(en).sort();
    for (const [name, locale] of [
      ["sr", sr],
      ["mk", mk],
      ["hr", hr],
    ] as const) {
      const localeKeys = flattenKeys(locale).sort();
      const missing = enKeys.filter((k) => !localeKeys.includes(k));
      const extra = localeKeys.filter((k) => !enKeys.includes(k));
      expect(missing, `keys missing in ${name}.json: ${missing.join(", ")}`).toEqual([]);
      expect(extra, `keys missing in en.json (extra in ${name}.json): ${extra.join(", ")}`).toEqual(
        [],
      );
    }
  });
});
