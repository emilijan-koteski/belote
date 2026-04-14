import { useMemo } from "react";

import { useWebSocket } from "@/shared/hooks/useWebSocket";
import { useWsDispatch } from "@/shared/hooks/useWsDispatch";

import { WebSocketContext } from "./WebSocketContext";

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useWsDispatch();
  const { sendMessage, state } = useWebSocket({ onMessage: dispatch });

  const value = useMemo(
    () => ({ sendMessage, connectionState: state }),
    [sendMessage, state],
  );

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}
