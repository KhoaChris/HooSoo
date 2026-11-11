import { z } from "zod";
export function parseFrontendEnv(
  input: Record<string, unknown>,
  production = false,
) {
  const schema = z.object({
    VITE_API_BASE_URL: z.string().min(1),
    VITE_FIREBASE_MODE: z.enum(["emulator", "cloud"]),
    VITE_FIREBASE_API_KEY: z.string().min(1),
    VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1),
    VITE_FIREBASE_PROJECT_ID: z.string().min(1),
    VITE_FIREBASE_APP_ID: z.string().min(1),
    VITE_FIREBASE_STORAGE_BUCKET: z.string().min(1).optional(),
    VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().regex(/^\d+$/).optional(),
    VITE_FIREBASE_MEASUREMENT_ID: z.string().startsWith("G-").optional(),
    VITE_FIREBASE_AUTH_EMULATOR_URL: z.url().optional(),
  });
  const result = schema.safeParse(input);
  if (!result.success)
    throw new Error(
      "Missing/invalid frontend environment: " +
        result.error.issues.map((i) => i.path.join(".")).join(", "),
    );
  const e = result.data;
  if (
    !e.VITE_API_BASE_URL.startsWith("/") &&
    !/^https?:\/\//.test(e.VITE_API_BASE_URL)
  )
    throw new Error("Invalid VITE_API_BASE_URL");
  if (e.VITE_API_BASE_URL.startsWith("//"))
    throw new Error("Protocol-relative API URL is not allowed");
  if (e.VITE_FIREBASE_MODE === "emulator") {
    if (production)
      throw new Error(
        "Production refuses emulator mode. Use --mode demo for a local demo build.",
      );
    if (
      e.VITE_FIREBASE_PROJECT_ID !== "demo-hoosoo" ||
      !e.VITE_FIREBASE_AUTH_EMULATOR_URL ||
      !["127.0.0.1", "localhost"].includes(
        new URL(e.VITE_FIREBASE_AUTH_EMULATOR_URL).hostname,
      )
    )
      throw new Error("Emulator requires demo-hoosoo and a loopback Auth URL");
  } else if (
    e.VITE_FIREBASE_AUTH_EMULATOR_URL ||
    e.VITE_FIREBASE_PROJECT_ID.startsWith("demo-")
  )
    throw new Error("Cloud refuses emulator settings");
  return e;
}
