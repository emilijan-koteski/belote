import { afterEach, describe, expect, it } from "vitest";

import { i18n } from "@/shared/i18n/i18n";

import { formatLocalizedDate } from "./formatDate";

describe("formatLocalizedDate", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("formats with the English template by default", () => {
    expect(formatLocalizedDate("2026-05-09T12:00:00Z", i18n.t)).toBe("May 9, 2026");
  });

  it("formats short variant in English", () => {
    expect(formatLocalizedDate("2026-01-03T12:00:00Z", i18n.t, "short")).toBe("Jan 3, 2026");
  });

  it("uses the locale template and month name when language is sr", async () => {
    await i18n.changeLanguage("sr");
    // SR template: "{{day}}. {{month}} {{year}}." with nominative month names.
    expect(formatLocalizedDate("2026-05-09T12:00:00Z", i18n.t)).toBe("9. maj 2026.");
  });

  it("uses the locale template and month name when language is mk", async () => {
    await i18n.changeLanguage("mk");
    // MK template is "{{day}} {{month}} {{year}}" (no periods, MK convention).
    expect(formatLocalizedDate("2026-05-09T12:00:00Z", i18n.t)).toBe("9 мај 2026");
  });

  it("uses the locale template and month name when language is hr", async () => {
    await i18n.changeLanguage("hr");
    expect(formatLocalizedDate("2026-05-09T12:00:00Z", i18n.t)).toBe("9. svibnja 2026.");
  });

  it("returns empty string for an unparseable date", () => {
    expect(formatLocalizedDate("not-a-date", i18n.t)).toBe("");
  });

  it("returns empty string for an empty input", () => {
    expect(formatLocalizedDate("", i18n.t)).toBe("");
  });

  it("falls back to short variant explicitly when requested", async () => {
    await i18n.changeLanguage("hr");
    // HR short month for May is "svi." (Croatian convention adds a trailing
    // period to month abbreviations).
    expect(formatLocalizedDate("2026-05-09T12:00:00Z", i18n.t, "short")).toBe("9. svi. 2026.");
  });
});
