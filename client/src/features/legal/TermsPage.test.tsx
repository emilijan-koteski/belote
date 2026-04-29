import "@/shared/i18n/i18n";

import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { TermsPage } from "./TermsPage";

function renderTermsPage() {
  return render(
    <BrowserRouter>
      <TermsPage />
    </BrowserRouter>,
  );
}

describe("TermsPage", () => {
  it("renders the title and a WIP notice", () => {
    renderTermsPage();

    expect(screen.getByTestId("terms-title")).toHaveTextContent("Terms of Service");
    expect(screen.getByTestId("terms-wip-badge")).toHaveTextContent("Work in progress");
    expect(screen.getByTestId("terms-wip-notice")).toHaveTextContent(
      "work-in-progress application used for testing",
    );
  });

  it("links back to the auth-aware root so authed and guest users land in the right place", () => {
    renderTermsPage();

    expect(screen.getByTestId("terms-back-link")).toHaveAttribute("href", "/");
  });
});
