import { ChevronDown, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

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

type TopBarProps = {
  /** Show nav links (Play / Leaderboard / Profile / Rules). Default false. */
  showNav?: boolean;
  /** Show username pill + logout dropdown. Default false. */
  showUserMenu?: boolean;
  /**
   * When true, the LanguageSelector also pushes the picked language to the
   * server. AppLayout passes this; AuthLayout leaves it off.
   */
  persistLanguage?: boolean;
  /** Override the LanguageSelector's test-id prefix to preserve auth tests. */
  languageTestIdPrefix?: string;
};

export function TopBar({
  showNav = false,
  showUserMenu = false,
  persistLanguage = false,
  languageTestIdPrefix,
}: TopBarProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <nav
      className="sticky top-0 z-50 flex h-[60px] items-center border-b border-border bg-[rgba(245,242,232,0.85)] px-7 backdrop-blur-md"
      data-testid="app-nav"
    >
      <span
        className="font-display text-ink text-xl font-semibold tracking-tight"
        data-testid="app-name"
      >
        {t("nav.appName")}
      </span>

      {showNav && (
        <div className="ml-7 flex h-full items-center">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex h-full items-center px-4 text-sm font-medium transition-colors",
                  isActive
                    ? "border-accent text-ink border-b-2"
                    : "text-ink-dim hover:text-ink border-b-2 border-transparent",
                )
              }
              data-testid={`nav-${item.labelKey.split(".")[1]}`}
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </div>
      )}

      <div className="ml-auto flex items-center gap-2.5">
        <LanguageSelector
          persistToServer={persistLanguage}
          testIdPrefix={languageTestIdPrefix}
        />

        {showUserMenu && user && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="bg-surface-elevated hover:bg-surface-sunken aria-expanded:bg-surface-sunken flex items-center gap-2 rounded-full border border-border py-1 pr-3 pl-1 transition-colors"
              data-testid="nav-user"
            >
              <span
                className="bg-accent text-accent-ink flex size-[26px] items-center justify-center rounded-full text-xs font-bold"
                aria-hidden="true"
              >
                {(user.username.charAt(0) || "?").toUpperCase()}
              </span>
              <span className="text-ink text-sm font-medium">{user.username}</span>
              <ChevronDown className="text-ink-dim size-3 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-surface-elevated min-w-44 border border-border p-1 shadow-[0_14px_36px_-18px_rgba(14,58,36,0.30)]"
            >
              <div className="text-ink-mute px-2.5 pt-2 pb-1.5 text-[11px] tracking-[0.3px]">
                {t("nav.signedInAs", { defaultValue: "Signed in as" })}{" "}
                <span className="text-ink font-semibold">{user.username}</span>
              </div>
              <div className="mx-1 my-1 h-px bg-border" />
              <DropdownMenuItem
                onClick={logout}
                data-testid="nav-logout"
                className="text-ink hover:bg-surface-sunken flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium"
              >
                <LogOut className="text-ink-dim size-3.5" />
                <span>{t("nav.logout")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </nav>
  );
}
