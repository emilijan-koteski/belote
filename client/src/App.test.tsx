import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router";

import { LoginPage } from "@/features/auth/LoginPage";
import { LobbyPage } from "@/features/lobby/LobbyPage";

describe("App routing", () => {
  it("renders login page at /login", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("renders lobby page at /lobby", () => {
    render(
      <MemoryRouter initialEntries={["/lobby"]}>
        <Routes>
          <Route path="/lobby" element={<LobbyPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Lobby")).toBeInTheDocument();
  });
});
