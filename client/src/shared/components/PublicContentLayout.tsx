import { Outlet } from "react-router";

import { PublicTopBar } from "@/shared/components/PublicTopBar";
import { TopBar } from "@/shared/components/TopBar";
import { WebSocketProvider } from "@/shared/providers/WebSocketProvider";
import { useAuthStore } from "@/shared/stores/authStore";

/**
 * Layout for reference pages reachable by EVERYONE — e.g. the Rules page.
 *
 * Authed visitors get the full app shell (nav + user menu) wrapped in the
 * WebSocketProvider so live presence is preserved; the brief reconnect on
 * entering is cancelled server-side by the reconnect handler (no seat loss).
 * Logged-out visitors (arriving from the landing footer) get a parchment
 * header with sign-in CTAs instead.
 */
export function PublicContentLayout() {
  const token = useAuthStore((s) => s.token);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return null;
  }

  if (token) {
    return (
      <WebSocketProvider>
        <div className="min-h-screen">
          <TopBar showNav showUserMenu persistLanguage />
          <main>
            <Outlet />
          </main>
        </div>
      </WebSocketProvider>
    );
  }

  return (
    <div className="min-h-screen">
      <PublicTopBar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
