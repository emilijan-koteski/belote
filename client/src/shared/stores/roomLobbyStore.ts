import { create } from "zustand";

import type { Room, RoomPlayer } from "@/shared/types/apiTypes";

interface RoomLobbyState {
  room: Room | null;
  players: RoomPlayer[];
  gameStarted: boolean;
  currentRoomId: number | null;
  kickedFromRoomId: number | null;

  setRoom: (room: Room | null) => void;
  setPlayers: (players: RoomPlayer[]) => void;
  setCurrentRoomId: (roomId: number | null) => void;
  addPlayer: (player: RoomPlayer, playerCount: number) => void;
  removePlayer: (userId: number, playerCount: number, newOwnerId?: number) => void;
  updatePlayerSeat: (
    userId: number,
    seat: number,
    team: string,
    previousSeat: number | null,
  ) => void;
  setGameStarted: (started: boolean) => void;
  setKickedFromRoom: (roomId: number | null) => void;
  reset: () => void;
}

const initialState = {
  room: null,
  players: [],
  gameStarted: false,
  currentRoomId: null,
  kickedFromRoomId: null,
};

export const useRoomLobbyStore = create<RoomLobbyState>((set) => ({
  ...initialState,

  setRoom: (room) => set({ room }),

  setPlayers: (players) => set({ players }),

  setCurrentRoomId: (currentRoomId) => set({ currentRoomId }),

  addPlayer: (player, playerCount) =>
    set((state) => ({
      players: state.players.some((p) => p.userId === player.userId)
        ? state.players
        : [...state.players, player],
      room: state.room ? { ...state.room, playerCount } : state.room,
    })),

  removePlayer: (userId, playerCount, newOwnerId) =>
    set((state) => ({
      players: state.players.filter((p) => p.userId !== userId),
      room: state.room
        ? {
            ...state.room,
            playerCount,
            ownerId: newOwnerId ?? state.room.ownerId,
          }
        : state.room,
    })),

  updatePlayerSeat: (userId, seat, team, _previousSeat) =>
    set((state) => ({
      players: state.players.map((p) => (p.userId === userId ? { ...p, seat, team } : p)),
    })),

  setGameStarted: (gameStarted) => set({ gameStarted }),

  setKickedFromRoom: (kickedFromRoomId) => set({ kickedFromRoomId }),

  reset: () => set(initialState),
}));
