import "@/shared/i18n/i18n";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { FetchError } from "@/shared/api/fetchClient";
import { useAuthStore } from "@/shared/stores/authStore";

import { LoginPage } from "./LoginPage";

const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockLogin = vi.fn();
vi.mock("@/shared/api/auth", () => ({
  login: (...args: unknown[]) => mockLogin(...args),
  logout: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

import { toast } from "sonner";

function renderLoginPage() {
  return render(
    <BrowserRouter>
      <LoginPage />
    </BrowserRouter>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: null, user: null, isLoading: false });
  });

  it("renders email and password fields with submit button", () => {
    renderLoginPage();

    expect(screen.getByTestId("email-input")).toBeInTheDocument();
    expect(screen.getByTestId("password-input")).toBeInTheDocument();
    expect(screen.getByTestId("submit-button")).toBeInTheDocument();
    expect(screen.getByTestId("login-title")).toHaveTextContent("Log In");
  });

  it("shows validation errors on blur for empty fields", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const emailInput = screen.getByTestId("email-input");
    const passwordInput = screen.getByTestId("password-input");

    await user.click(emailInput);
    await user.tab();

    expect(screen.getByTestId("email-error")).toHaveTextContent("Email is required");

    await user.click(passwordInput);
    await user.tab();

    expect(screen.getByTestId("password-error")).toHaveTextContent("Password is required");
  });

  it("navigates to /lobby on successful login", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce({
      token: "access-token",
      id: 1,
      username: "testuser",
      email: "test@example.com",
      languagePreference: "en",
      createdAt: "2026-01-01T00:00:00Z",
    });

    renderLoginPage();

    await user.type(screen.getByTestId("email-input"), "test@example.com");
    await user.type(screen.getByTestId("password-input"), "password123");
    await user.click(screen.getByTestId("submit-button"));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/lobby");
    });

    expect(useAuthStore.getState().token).toBe("access-token");
    expect(useAuthStore.getState().user?.username).toBe("testuser");
  });

  it("displays generic error for 401 response", async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValueOnce(
      new FetchError(401, "INVALID_CREDENTIALS", "invalid email or password"),
    );

    renderLoginPage();

    await user.type(screen.getByTestId("email-input"), "test@example.com");
    await user.type(screen.getByTestId("password-input"), "wrongpassword");
    await user.click(screen.getByTestId("submit-button"));

    await waitFor(() => {
      expect(screen.getByTestId("form-error")).toBeInTheDocument();
    });

    expect(screen.getByTestId("form-error")).toHaveTextContent("Invalid email or password");
  });

  it("shows toast for non-401 errors", async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValueOnce(
      new FetchError(500, "INTERNAL_ERROR", "Something went wrong"),
    );

    renderLoginPage();

    await user.type(screen.getByTestId("email-input"), "test@example.com");
    await user.type(screen.getByTestId("password-input"), "password123");
    await user.click(screen.getByTestId("submit-button"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it("disables submit button during loading", async () => {
    const user = userEvent.setup();
    let resolveLogin: (value: unknown) => void;
    mockLogin.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );

    renderLoginPage();

    await user.type(screen.getByTestId("email-input"), "test@example.com");
    await user.type(screen.getByTestId("password-input"), "password123");
    await user.click(screen.getByTestId("submit-button"));

    await waitFor(() => {
      expect(screen.getByTestId("submit-button")).toBeDisabled();
    });

    resolveLogin!({
      token: "t",
      id: 1,
      username: "u",
      email: "e@e.com",
      languagePreference: "en",
      createdAt: "2026-01-01",
    });

    await waitFor(() => {
      expect(screen.getByTestId("submit-button")).not.toBeDisabled();
    });
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const passwordInput = screen.getByTestId("password-input");
    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(screen.getByTestId("password-toggle"));
    expect(passwordInput).toHaveAttribute("type", "text");

    await user.click(screen.getByTestId("password-toggle"));
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("has link to register page", () => {
    renderLoginPage();

    const registerLink = screen.getByTestId("register-link");
    expect(registerLink).toBeInTheDocument();
    expect(registerLink).toHaveAttribute("href", "/register");
  });
});
