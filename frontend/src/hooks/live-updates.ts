import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "firebase/auth";
import { env } from "../config/firebase";
import { startLiveUpdates } from "../services/live-updates";
import { refreshQueries } from "../services/query-sync";

export function useLiveUpdates(user: User | null) {
  const client = useQueryClient();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!user) return;
    const stop = startLiveUpdates({
      url: env.VITE_API_BASE_URL + "/events",
      token: () => user.getIdToken(),
      onConnection: setConnected,
      onChange: (collections) => {
        void refreshQueries(client, collections);
      },
    });
    return () => {
      stop();
    };
  }, [client, user]);
  return !!user && connected;
}
