import { Outlet } from "react-router";

import { TopBar } from "@/shared/components/TopBar";

export function AppLayout() {
  return (
    <div className="min-h-screen">
      <TopBar showNav showUserMenu persistLanguage />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
