import {
  receivePresence,
  disconnectPresence,
  resetPresence,
} from "../services/presence-state";
import { useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "firebase/auth";
import { env } from "../config/firebase";
import { startLiveUpdates } from "../services/live-updates";
import { refreshQueries } from "../services/query-sync";

export function useLiveUpdates(user: User | null) {
  const client = useQueryClient();
  const [connected, setConnected] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    resetPresence();
    if (!user) return;
    const stop = startLiveUpdates({
      url: env.VITE_API_BASE_URL + "/events",
      token: () => user.getIdToken(),
      onConnection: (value) => {
        setConnected(value);
        if (!value) disconnectPresence();
      },
      onPresence: receivePresence,
      onChange: (collections) => {
        void refreshQueries(client, collections);
      },
    });
    stopRef.current = stop;
    return () => {
      stopRef.current = null;
      stop();
      resetPresence();
    };
  }, [client, user]);
  return {
    connected: !!user && connected,
    disconnect: () => stopRef.current?.(),
  };
}
