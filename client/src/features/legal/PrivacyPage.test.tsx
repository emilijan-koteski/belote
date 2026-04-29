import "@/shared/i18n/i18n";

import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { PrivacyPage } from "./PrivacyPage";

function renderPrivacyPage() {
  return render(
    <BrowserRouter>
      <PrivacyPage />
    </BrowserRouter>,
  );
}

describe("PrivacyPage", () => {
  it("renders the title and a WIP notice", () => {
    renderPrivacyPage();

    expect(screen.getByTestId("privacy-title")).toHaveTextContent("Privacy Policy");
    expect(screen.getByTestId("privacy-wip-badge")).toHaveTextContent("Work in progress");
    expect(screen.getByTestId("privacy-wip-notice")).toHaveTextContent(
      "work-in-progress application used for testing",
    );
  });

  it("links back to the auth-aware root so authed and guest users land in the right place", () => {
    renderPrivacyPage();

    expect(screen.getByTestId("privacy-back-link")).toHaveAttribute("href", "/");
  });
});
