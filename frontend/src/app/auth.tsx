import { useLocale } from "../i18n";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useQueryClient } from "@tanstack/react-query";
import { auth } from "../config/firebase";
import { useApi } from "../hooks/data";
import type { Me } from "@hoosoo/shared";
import { useLiveUpdates } from "../hooks/live-updates";
import { cancelRefresh } from "../services/query-sync";
import { useNavigationCache } from "../hooks/navigation-cache";
const Context = createContext<{
  user: User | null;
  loading: boolean;
  me?: Me;
  error: Error | null;
  live: boolean;
  logout: () => Promise<void>;
  retry: () => void;
}>(null!);
export function AuthProvider({ children }: { children: ReactNode }) {
  useLocale();
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true);
  const client = useQueryClient();
  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        cancelRefresh(client);
        client.clear();
        setUser(u);
        setLoading(false);
      }),
    [client],
  );
  const me = useApi<Me>("/me", !!user);
  // Do not reconnect a stream while the membership/bootstrap read is failing.
  const live = useLiveUpdates(me.data && !me.error ? user : null);
  useNavigationCache(user?.uid, me.data?.actor.role, !me.error);
  return (
    <Context.Provider
      value={{
        user,
        loading: loading || (!!user && me.isPending),
        me: me.data,
        error: me.error,
        live,
        logout: () => signOut(auth),
        retry: () => {
          void me.refetch();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
