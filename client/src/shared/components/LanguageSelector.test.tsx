import "@/shared/i18n/i18n";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/shared/i18n/i18n";
import { useAuthStore } from "@/shared/stores/authStore";

import { LanguageSelector } from "./LanguageSelector";

vi.mock("@/shared/api/auth", () => ({
  logout: vi.fn(),
}));

const mockUpdatePreferences = vi.fn();
vi.mock("@/shared/api/profile", () => ({
  updatePreferences: (...args: unknown[]) => mockUpdatePreferences(...args),
}));

function renderLanguageSelector() {
  return render(<LanguageSelector />);
}

describe("LanguageSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.changeLanguage("en");
    useAuthStore.setState({
      token: "test-token",
      user: {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        languagePreference: "en",
        createdAt: "2026-01-01T00:00:00Z",
      },
      isLoading: false,
    });
    mockUpdatePreferences.mockResolvedValue({ languagePreference: "sr" });
  });

  it("renders current language", () => {
    renderLanguageSelector();

    expect(screen.getByTestId("language-selector")).toHaveTextContent("EN");
  });

  it("calls i18n.changeLanguage on selection", async () => {
    const user = userEvent.setup();
    renderLanguageSelector();

    await user.click(screen.getByTestId("language-selector"));

    await waitFor(() => {
      expect(screen.getByTestId("language-option-sr")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("language-option-sr"));

    await waitFor(() => {
      expect(i18n.language).toBe("sr");
    });
  });

  it("calls API to persist language preference", async () => {
    const user = userEvent.setup();
    renderLanguageSelector();

    await user.click(screen.getByTestId("language-selector"));

    await waitFor(() => {
      expect(screen.getByTestId("language-option-sr")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("language-option-sr"));

    await waitFor(() => {
      expect(mockUpdatePreferences).toHaveBeenCalledWith(1, {
        languagePreference: "sr",
      });
    });
  });

  it("updates auth store with new language preference", async () => {
    const user = userEvent.setup();
    renderLanguageSelector();

    await user.click(screen.getByTestId("language-selector"));

    await waitFor(() => {
      expect(screen.getByTestId("language-option-sr")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("language-option-sr"));

    await waitFor(() => {
      expect(useAuthStore.getState().user?.languagePreference).toBe("sr");
    });
  });
});
