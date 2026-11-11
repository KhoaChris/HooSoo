import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Role } from "@hoosoo/shared";
import { auth } from "../config/firebase";
import { api } from "../services/api-client";
import { warmNavigation } from "../services/query-cache";

export function useNavigationCache(uid?: string, role?: Role, enabled = true) {
  const client = useQueryClient();
  useEffect(() => {
    if (!uid || !role || !enabled) return;
    return warmNavigation(
      client,
      uid,
      role,
      (path, signal) => api(path, { signal }),
      () => auth.currentUser?.uid === uid,
    );
  }, [client, uid, role, enabled]);
}
