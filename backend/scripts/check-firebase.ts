import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { parseFrontendEnv } from "../../frontend/src/config/env";
import { env } from "../src/config/env";
import {
  auth,
  db,
  ensureFirebaseCredentials,
} from "../src/config/firebase-admin";
import { organization, readiness, timeout } from "../src/database/store";

// Read-only diagnostics. Never create accounts or seed a cloud project here.
let failed = false;
async function check(name: string, probe: () => Promise<string>) {
  try {
    console.log(`PASS ${name}: ${await probe()}`);
  } catch (error) {
    failed = true;
    const code = (error as { code?: string | number }).code;
    console.error(`FAIL ${name}${code ? ` (code: ${code})` : ""}`);
  }
}

const frontend = parseFrontendEnv(
  loadEnv(
    "development",
    fileURLToPath(new URL("../../frontend/", import.meta.url)),
  ),
);
if (
  frontend.VITE_FIREBASE_MODE !== env.FIREBASE_MODE ||
  frontend.VITE_FIREBASE_PROJECT_ID !== env.FIREBASE_PROJECT_ID
) {
  console.error(
    "FAIL configuration: frontend and backend must use the same Firebase mode and project.",
  );
  process.exit(1);
}
console.log(
  `PASS configuration: ${env.FIREBASE_PROJECT_ID} (${env.FIREBASE_MODE})`,
);
// The first keyless token exchange can be slower than a warm database read.
await check("Firebase Admin credentials", async () => {
  await timeout(ensureFirebaseCredentials(), 30000);
  return "credential exchange succeeded";
});
if (failed) {
  console.error(
    "Configure Application Default Credentials or a Firebase Admin service-account credential, then retry.",
  );
  await db.terminate();
  process.exit(1);
}
await check("Firebase Admin Authentication", async () => {
  await timeout(auth.listUsers(1), env.DB_TIMEOUT_MS);
  return "authenticated read succeeded";
});
await check("Firestore", async () => {
  const result = await readiness();
  return `read succeeded in ${result.latencyMs} ms`;
});
if (!failed) {
  await check("HooSoo initialization", async () => {
    const [settings, admins] = await timeout(
      Promise.all([
        organization.collection("settings").doc("main").get(),
        organization
          .collection("memberships")
          .where("role", "==", "Admin")
          .limit(150)
          .get(),
      ]),
      env.DB_TIMEOUT_MS,
    );
    if (
      !settings.exists ||
      !admins.docs.some((d) => d.data().active === true)
    ) {
      console.error(
        "Create the initial organization settings and an active Admin membership before signing in. The demo seed intentionally refuses cloud.",
      );
      throw new Error("SETUP_REQUIRED");
    }
    return "settings and active Admin membership exist";
  });
}
if (failed) {
  console.error(
    "Check Firebase Admin credentials (GOOGLE_APPLICATION_CREDENTIALS or ADC), Email/Password Auth, Firestore, and project permissions. Web API keys do not authenticate the backend.",
  );
}
if (!failed) await db.terminate();
process.exit(failed ? 1 : 0);
