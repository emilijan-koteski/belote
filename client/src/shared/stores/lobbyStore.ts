import { create } from "zustand";

import type { Room } from "@/shared/types/apiTypes";

interface LobbyState {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  rooms: Room[];
  setRooms: (rooms: Room[]) => void;
  addRoom: (room: Room) => void;
  removeRoom: (roomId: number) => void;
  updateRoom: (room: Room) => void;
}

export const useLobbyStore = create<LobbyState>((set) => ({
  isLoading: false,
  setLoading: (isLoading) => set({ isLoading }),

  rooms: [],
  setRooms: (rooms) => set({ rooms }),
  addRoom: (room) => set((state) => ({ rooms: [...state.rooms, room] })),
  removeRoom: (roomId) =>
    set((state) => ({ rooms: state.rooms.filter((r) => r.id !== roomId) })),
  updateRoom: (room) =>
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === room.id ? room : r)),
    })),
}));
