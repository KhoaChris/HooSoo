import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { api } from "../services/api-client";
import { mutationCollections } from "@hoosoo/shared";
import { refreshQueries } from "../services/query-sync";
import { apiQueryOptions } from "../services/query-cache";
import { auth } from "../config/firebase";
export function useApi<T>(path: string, enabled = true) {
  const uid = auth.currentUser?.uid ?? null;
  return useQuery({
    ...apiQueryOptions<T>(path, uid, (url, signal) => api<T>(url, { signal })),
    enabled: enabled && !!uid,
  });
}
export function useAction() {
  const client = useQueryClient();
  const keys = useRef(new Map<string, string>());
  return useMutation({
    mutationFn: async ({
      path,
      method = "POST",
      body = {},
    }: {
      path: string;
      method?: string;
      body?: unknown;
    }) => {
      const signature = method + path + JSON.stringify(body);
      const key = keys.current.get(signature) || crypto.randomUUID();
      keys.current.set(signature, key);
      const result = await api<unknown>(path, { method, body, key });
      keys.current.delete(signature);
      return result;
    },
    onSuccess: async (_data, variables) => {
      await refreshQueries(client, mutationCollections(variables.path));
      window.dispatchEvent(new Event("hoosoo:saved"));
    },
  });
}
