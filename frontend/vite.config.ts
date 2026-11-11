import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { parseFrontendEnv } from "./src/config/env";
const root = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig(({ mode }) => {
  parseFrontendEnv(loadEnv(mode, root), mode === "production");
  return {
    root,
    plugins: [react(), tailwind()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": { target: "http://127.0.0.1:4000", changeOrigin: true },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("firebase")) return "firebase";
              if (id.includes("zod")) return "validation";
              if (id.includes("react") || id.includes("tanstack"))
                return "framework";
            }
          },
        },
      },
    },
    preview: { port: 5173, strictPort: true },
  };
});
