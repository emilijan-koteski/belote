import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLogoutApi = vi.fn();
vi.mock("@/shared/api/auth", () => ({
  logout: (...args: unknown[]) => mockLogoutApi(...args),
}));

import { useAuthStore } from "./authStore";

describe("authStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: null, user: null, isLoading: false });
  });

  it("logout clears token and user from store", () => {
    useAuthStore.setState({
      token: "test-token",
      user: {
        id: 1,
        username: "test",
        email: "test@test.com",
        languagePreference: "en",
        createdAt: "2026-01-01",
      },
    });

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("logout calls backend /auth/logout endpoint", () => {
    useAuthStore.setState({ token: "test-token" });

    useAuthStore.getState().logout();

    expect(mockLogoutApi).toHaveBeenCalled();
  });
});
