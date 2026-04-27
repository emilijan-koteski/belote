import "@/shared/i18n/i18n";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SurrenderOpponentBanner } from "./SurrenderOpponentBanner";

describe("SurrenderOpponentBanner", () => {
  it("renders with the proposer username and aria-live status", () => {
    render(<SurrenderOpponentBanner proposerUsername="alice" />);
    const banner = screen.getByTestId("surrender-opponent-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("role", "status");
    expect(banner).toHaveAttribute("aria-live", "polite");
    expect(banner).toHaveTextContent(/alice/);
  });

  it("is NOT a dialog (opponents must keep playing)", () => {
    render(<SurrenderOpponentBanner proposerUsername="alice" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
