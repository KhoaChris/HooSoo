import React from "react";
import { Toast } from "./components/ui/toast";
import { createRoot, type Root } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./app/auth";
import { AppRoutes } from "./routes";
import { ApiError } from "./services/api-client";
import { apiCacheDefaults } from "./services/query-cache";
import "./styles.css";
const client: QueryClient =
  import.meta.hot?.data.queryClient ??
  new QueryClient({
    defaultOptions: {
      queries: {
        ...apiCacheDefaults,
        retry: (count, error) =>
          count < 1 &&
          (!(error instanceof ApiError) ||
            (error.status >= 500 && error.code !== "FIRESTORE_QUOTA_EXCEEDED")),
      },
      mutations: { retry: false },
    },
  });
if (import.meta.hot) import.meta.hot.data.queryClient = client;
// Reuse the root if a dependency update makes Vite reevaluate this entry point.
const root: Root =
  import.meta.hot?.data.root ?? createRoot(document.getElementById("root")!);
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toast />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
