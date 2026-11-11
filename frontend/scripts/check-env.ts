import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import { parseFrontendEnv } from "../src/config/env";
const mode = process.argv[2] || "development";
const e = parseFrontendEnv(
  loadEnv(mode, fileURLToPath(new URL("..", import.meta.url))),
  mode === "production",
);
console.log(
  `Frontend environment valid. Mode: ${e.VITE_FIREBASE_MODE}; project: ${e.VITE_FIREBASE_PROJECT_ID}`,
);
