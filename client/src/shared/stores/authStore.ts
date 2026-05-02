import { create } from "zustand";

import { logout as logoutApi } from "@/shared/api/auth";
import { useChatStore } from "@/shared/stores/chatStore";
import { useGameStore } from "@/shared/stores/gameStore";
import { useRoomLobbyStore } from "@/shared/stores/roomLobbyStore";
import type { User } from "@/shared/types/apiTypes";

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,
  setToken: (token) => set({ token }),
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => {
    if (get().token) {
      logoutApi();
    }
    // Wipe session-scoped stores BEFORE clearing auth state so synchronous
    // subscribers to authStore.token transitions don't observe stale game
    // data. Single canonical logout point — both manual logout and the
    // axiosClient 401 interceptor inherit this ordering.
    useGameStore.getState().clearGame();
    useRoomLobbyStore.getState().reset();
    useChatStore.getState().clearGlobal();
    useChatStore.getState().clearMatch();
    useChatStore.getState().clearRoom();
    set({ token: null, user: null, isLoading: false });
  },
}));
