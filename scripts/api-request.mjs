import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { parse } from "dotenv";

// Local developer helper. Tokens and passwords stay in memory, never in output.
// Mutations require an explicit method and body; no fixtures are auto-created.
const [role, method = "GET", path = "/me", rawBody, suppliedKey] =
  process.argv.slice(2);
if (
  !["Admin", "HR", "Manager", "Employee"].includes(role) ||
  !["GET", "POST", "PATCH"].includes(method) ||
  !/^\/[A-Za-z0-9_/?=&.%-]*$/.test(path) ||
  path.startsWith("//") ||
  path.includes("..") ||
  (method !== "GET" && rawBody === undefined) ||
  (method === "GET" && rawBody !== undefined)
) {
  console.error(
    "Usage: npm run api:request -- <Admin|HR|Manager|Employee> <GET|POST|PATCH> /route [JSON-body] [idempotency-key]",
  );
  process.exit(1);
}

try {
  const frontend = parse(
    readFileSync(new URL("../frontend/.env.local", import.meta.url)),
  );
  const backend = parse(
    readFileSync(new URL("../backend/.env", import.meta.url)),
  );
  const access = JSON.parse(
    readFileSync(
      new URL("../backend/.secrets/demo-accounts.json", import.meta.url),
      "utf8",
    ),
  );
  if (
    frontend.VITE_FIREBASE_MODE !== "cloud" ||
    backend.FIREBASE_MODE !== "cloud" ||
    frontend.VITE_FIREBASE_PROJECT_ID !== "hoosoo-37881" ||
    backend.FIREBASE_PROJECT_ID !== "hoosoo-37881" ||
    access.projectId !== "hoosoo-37881"
  )
    throw new Error(
      "This helper is restricted to the configured hoosoo-37881 cloud demo.",
    );
  const account = access.accounts[role];
  if (!account?.email?.endsWith("@hoosoo.example"))
    throw new Error("Missing synthetic account for this role.");
  const body = rawBody === undefined ? undefined : JSON.parse(rawBody);
  const login = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(frontend.VITE_FIREBASE_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: account.email,
        password: account.password,
        returnSecureToken: true,
      }),
      signal: AbortSignal.timeout(20000),
    },
  );
  const identity = await login.json();
  if (!login.ok || identity.localId !== account.uid)
    throw new Error(
      "Firebase sign-in failed or the saved identity does not match.",
    );
  const key = method === "GET" ? undefined : suppliedKey || randomUUID();
  if (key && !/^[A-Za-z0-9_-]{8,100}$/.test(key))
    throw new Error("Invalid idempotency key.");
  // Printed before sending so the same key can be reused after a timeout.
  console.log(`${role} ${method} /api/v1${path}`);
  if (key) console.log(`Idempotency-Key: ${key}`);
  const response = await fetch("http://127.0.0.1:5173/api/v1" + path, {
    method,
    headers: {
      Authorization: "Bearer " + identity.idToken,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  console.log(
    `HTTP ${response.status}; X-Request-Id: ${response.headers.get("x-request-id") || "unavailable"}`,
  );
  console.log(
    response.headers.get("content-type")?.includes("application/json")
      ? JSON.stringify(await response.json(), null, 2)
      : await response.text(),
  );
  if (!response.ok) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : "API request failed");
  process.exitCode = 1;
}
