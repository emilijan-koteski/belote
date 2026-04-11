import { describe, expect, it } from "vitest";

import { i18n } from "./i18n";

describe("i18n", () => {
  it("returns English translation by default", () => {
    expect(i18n.t("common.appName")).toBe("Belote");
  });

  it("returns Serbian translation when language is changed", async () => {
    await i18n.changeLanguage("sr");
    expect(i18n.t("common.appName")).toBe("Belote");
    await i18n.changeLanguage("en");
  });
});
