import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router";

import { LanguageSelector } from "@/shared/components/LanguageSelector";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";
import { useAuthStore } from "@/shared/stores/authStore";

const navItems = [
  { path: "/lobby", labelKey: "nav.play" },
  { path: "/leaderboard", labelKey: "nav.leaderboard" },
  { path: "/profile", labelKey: "nav.profile" },
  { path: "/rules", labelKey: "nav.rules" },
] as const;

export function AppLayout() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="min-h-screen bg-background">
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center border-b border-border bg-surface px-6"
        data-testid="app-nav"
      >
        <span
          className="font-display text-xl font-semibold text-text-primary"
          data-testid="app-name"
        >
          {t("nav.appName")}
        </span>

        <div className="ml-8 flex h-full items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex h-full items-center px-4 font-body text-base transition-colors",
                  isActive
                    ? "border-b-2 border-accent text-text-primary"
                    : "text-text-secondary hover:text-text-primary",
                )
              }
              data-testid={`nav-${item.labelKey.split(".")[1]}`}
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <LanguageSelector />
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-elevated"
                data-testid="nav-user"
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-semibold text-text-primary"
                  aria-hidden="true"
                >
                  {(user.username.charAt(0) || "?").toUpperCase()}
                </span>
                <span className="font-body text-sm text-text-secondary">{user.username}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-surface-elevated">
                <DropdownMenuItem onClick={logout} data-testid="nav-logout">
                  {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </nav>

      <main className="pt-14">
        <Outlet />
      </main>
    </div>
  );
}
