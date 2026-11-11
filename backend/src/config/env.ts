import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { resolve } from "node:path";
// This module retains the same relative location in src/config and the bundled dist entry.
const backendRoot = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  import.meta.url.includes("/src/config/") ? "../.." : "..",
);
config({ path: resolve(backendRoot, ".env"), quiet: true });
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGINS: z.string().min(1),
  FIREBASE_MODE: z.enum(["emulator", "cloud"]),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_AUTH_EMULATOR_HOST: z.string().optional(),
  FIRESTORE_EMULATOR_HOST: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error", "silent"])
    .default("info"),
  DB_TIMEOUT_MS: z.coerce.number().int().min(100).max(10000).default(4000),
  DEMO_PASSWORD: z.string().min(10).optional(),
});
export function parseEnv(input: NodeJS.ProcessEnv) {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new Error(
      "Invalid environment variables: " +
        result.error.issues.map((i) => i.path.join(".")).join(", "),
    );
  const e = result.data;
  for (const origin of e.CORS_ORIGINS.split(",")) {
    const u = new URL(origin);
    if (!["http:", "https:"].includes(u.protocol) || u.origin !== origin)
      throw new Error("Invalid CORS_ORIGINS");
  }
  if (e.FIREBASE_MODE === "emulator") {
    if (e.NODE_ENV === "production")
      throw new Error("Production refuses FIREBASE_MODE=emulator");
    if (e.FIREBASE_PROJECT_ID !== "demo-hoosoo")
      throw new Error("Emulator requires FIREBASE_PROJECT_ID=demo-hoosoo");
    for (const k of [
      "FIREBASE_AUTH_EMULATOR_HOST",
      "FIRESTORE_EMULATOR_HOST",
    ] as const)
      if (!e[k] || !/^(127\.0\.0\.1|localhost):\d+$/.test(e[k]!))
        throw new Error("Missing or invalid " + k);
    if (e.GOOGLE_APPLICATION_CREDENTIALS)
      throw new Error("Remove GOOGLE_APPLICATION_CREDENTIALS in emulator mode");
  } else {
    if (e.FIREBASE_PROJECT_ID.startsWith("demo-"))
      throw new Error("Cloud requires a real FIREBASE_PROJECT_ID");
    if (e.FIREBASE_AUTH_EMULATOR_HOST || e.FIRESTORE_EMULATOR_HOST)
      throw new Error("Cloud refuses emulator environment variables");
  }
  return e;
}
export const env = parseEnv(process.env);
export const ORG_ID = env.NODE_ENV === "test" ? "hoosoo-tests" : "hoosoo";
