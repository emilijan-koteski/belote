import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/shared/api/queryKeys";
import {
  createRoom,
  getRoomByCode,
  joinRoom,
  kickPlayer,
  leaveRoom,
  leaveSeat,
  quickPlay,
  selectSeat,
  startGame,
  swapSeats,
  transferOwnership,
} from "@/shared/api/rooms";
import type {
  CreateRoomRequest,
  Room,
  RoomPlayer,
  SelectSeatResponse,
} from "@/shared/types/apiTypes";

export function useCreateRoomMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateRoomRequest) => createRoom(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all });
    },
  });
}

export function useJoinRoomMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => joinRoom(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all });
    },
  });
}

export function useLeaveRoomMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => leaveRoom(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all });
    },
  });
}

export function useSelectSeatMutation() {
  return useMutation<SelectSeatResponse, Error, { roomId: number; seat: number }>({
    mutationFn: ({ roomId, seat }) => selectSeat(roomId, seat),
  });
}

export function useLeaveSeatMutation() {
  return useMutation<{ players: RoomPlayer[] }, Error, { roomId: number }>({
    mutationFn: ({ roomId }) => leaveSeat(roomId),
  });
}

export function useTransferOwnershipMutation() {
  return useMutation<{ ownerId: number }, Error, { roomId: number; userId: number }>({
    mutationFn: ({ roomId, userId }) => transferOwnership(roomId, userId),
  });
}

export function useStartGameMutation() {
  return useMutation({
    mutationFn: (roomId: number) => startGame(roomId),
  });
}

export function useQuickPlayMutation() {
  return useMutation({
    mutationFn: (signal?: AbortSignal) => quickPlay(signal),
  });
}

export function useKickPlayerMutation() {
  return useMutation<{ playerCount: number }, Error, { roomId: number; userId: number }>({
    mutationFn: ({ roomId, userId }) => kickPlayer(roomId, userId),
  });
}

export function useSwapSeatsMutation() {
  return useMutation<
    { players: RoomPlayer[] },
    Error,
    { roomId: number; seatA: number; seatB: number }
  >({
    mutationFn: ({ roomId, seatA, seatB }) => swapSeats(roomId, seatA, seatB),
  });
}

export function useJoinByCodeMutation() {
  const queryClient = useQueryClient();
  return useMutation<Room, Error, string>({
    mutationFn: async (code: string) => {
      const { room } = await getRoomByCode(code);
      await joinRoom(room.id);
      return room;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all });
    },
  });
}
