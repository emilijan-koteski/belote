import { createContext, useContext, useMemo } from "react";

import { useWebSocket } from "@/shared/hooks/useWebSocket";
import { useWsDispatch } from "@/shared/hooks/useWsDispatch";
import type { WsConnectionState } from "@/shared/hooks/useWebSocket";

interface WebSocketContextValue {
  sendMessage: (type: string, payload: unknown) => void;
  connectionState: WsConnectionState;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

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

export function useWsSendMessage(): (type: string, payload: unknown) => void {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWsSendMessage must be used within WebSocketProvider");
  }
  return ctx.sendMessage;
}

export function useWsConnectionState(): WsConnectionState {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWsConnectionState must be used within WebSocketProvider");
  }
  return ctx.connectionState;
}
