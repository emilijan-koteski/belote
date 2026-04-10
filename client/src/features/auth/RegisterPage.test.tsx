import "@/shared/i18n/i18n";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FetchError } from "@/shared/api/fetchClient";

import { RegisterPage } from "./RegisterPage";

const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockRegister = vi.fn();
vi.mock("@/shared/api/auth", () => ({
  register: (...args: unknown[]) => mockRegister(...args),
}));

function renderRegisterPage() {
  return render(
    <BrowserRouter>
      <RegisterPage />
    </BrowserRouter>,
  );
}

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email, username, password fields and submit button", () => {
    renderRegisterPage();

    expect(screen.getByTestId("email-input")).toBeInTheDocument();
    expect(screen.getByTestId("username-input")).toBeInTheDocument();
    expect(screen.getByTestId("password-input")).toBeInTheDocument();
    expect(screen.getByTestId("submit-button")).toBeInTheDocument();
    expect(screen.getByTestId("login-link")).toBeInTheDocument();
  });

  it("shows validation error on blur for empty email", async () => {
    renderRegisterPage();

    const emailInput = screen.getByTestId("email-input");
    fireEvent.focus(emailInput);
    fireEvent.blur(emailInput);

    await waitFor(() => {
      expect(screen.getByTestId("email-error")).toHaveTextContent("Email is required");
    });
  });

  it("shows validation error on blur for invalid email", async () => {
    renderRegisterPage();
    const user = userEvent.setup();

    const emailInput = screen.getByTestId("email-input");
    await user.type(emailInput, "not-an-email");
    fireEvent.blur(emailInput);

    await waitFor(() => {
      expect(screen.getByTestId("email-error")).toHaveTextContent("Enter a valid email address");
    });
  });

  it("shows validation error on blur for short username", async () => {
    renderRegisterPage();
    const user = userEvent.setup();

    const usernameInput = screen.getByTestId("username-input");
    await user.type(usernameInput, "ab");
    fireEvent.blur(usernameInput);

    await waitFor(() => {
      expect(screen.getByTestId("username-error")).toHaveTextContent(
        "Username must be at least 3 characters",
      );
    });
  });

  it("shows validation error on blur for short password", async () => {
    renderRegisterPage();
    const user = userEvent.setup();

    const passwordInput = screen.getByTestId("password-input");
    await user.type(passwordInput, "short");
    fireEvent.blur(passwordInput);

    await waitFor(() => {
      expect(screen.getByTestId("password-error")).toHaveTextContent(
        "Password must be at least 8 characters",
      );
    });
  });

  it("navigates to /lobby on successful registration", async () => {
    mockRegister.mockResolvedValueOnce({
      token: "mock-token",
      id: 1,
      username: "testuser",
      email: "test@example.com",
      languagePreference: "en",
      createdAt: "2026-04-10T00:00:00Z",
    });

    renderRegisterPage();
    const user = userEvent.setup();

    await user.type(screen.getByTestId("email-input"), "test@example.com");
    await user.type(screen.getByTestId("username-input"), "testuser");
    await user.type(screen.getByTestId("password-input"), "password123");
    await user.click(screen.getByTestId("submit-button"));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/lobby");
    });
  });

  it("displays inline error for EMAIL_TAKEN server response", async () => {
    mockRegister.mockRejectedValueOnce(
      new FetchError(409, "EMAIL_TAKEN", "email is already registered"),
    );

    renderRegisterPage();
    const user = userEvent.setup();

    await user.type(screen.getByTestId("email-input"), "taken@example.com");
    await user.type(screen.getByTestId("username-input"), "testuser");
    await user.type(screen.getByTestId("password-input"), "password123");
    await user.click(screen.getByTestId("submit-button"));

    await waitFor(() => {
      expect(screen.getByTestId("email-error")).toHaveTextContent(
        "This email is already registered",
      );
    });
  });

  it("displays inline error for USERNAME_TAKEN server response", async () => {
    mockRegister.mockRejectedValueOnce(
      new FetchError(409, "USERNAME_TAKEN", "username is already taken"),
    );

    renderRegisterPage();
    const user = userEvent.setup();

    await user.type(screen.getByTestId("email-input"), "test@example.com");
    await user.type(screen.getByTestId("username-input"), "takenuser");
    await user.type(screen.getByTestId("password-input"), "password123");
    await user.click(screen.getByTestId("submit-button"));

    await waitFor(() => {
      expect(screen.getByTestId("username-error")).toHaveTextContent(
        "This username is already taken",
      );
    });
  });

  it("shows validation error on blur for username with invalid characters", async () => {
    renderRegisterPage();
    const user = userEvent.setup();

    const usernameInput = screen.getByTestId("username-input");
    await user.type(usernameInput, "bad user!");
    fireEvent.blur(usernameInput);

    await waitFor(() => {
      expect(screen.getByTestId("username-error")).toHaveTextContent(
        "Letters, numbers, and underscores only",
      );
    });
  });

  it("toggles password visibility", async () => {
    renderRegisterPage();
    const user = userEvent.setup();

    const passwordInput = screen.getByTestId("password-input");
    expect(passwordInput).toHaveAttribute("type", "password");

    const toggleButton = screen.getByTestId("password-toggle");
    await user.click(toggleButton);

    expect(passwordInput).toHaveAttribute("type", "text");

    await user.click(toggleButton);

    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("disables submit button during loading", async () => {
    let resolveRegister: (value: unknown) => void;
    mockRegister.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRegister = resolve;
      }),
    );

    renderRegisterPage();
    const user = userEvent.setup();

    await user.type(screen.getByTestId("email-input"), "test@example.com");
    await user.type(screen.getByTestId("username-input"), "testuser");
    await user.type(screen.getByTestId("password-input"), "password123");
    await user.click(screen.getByTestId("submit-button"));

    await waitFor(() => {
      expect(screen.getByTestId("submit-button")).toBeDisabled();
    });

    resolveRegister!({
      token: "tok",
      id: 1,
      username: "testuser",
      email: "test@example.com",
      languagePreference: "en",
      createdAt: "2026-04-10T00:00:00Z",
    });
  });
});
