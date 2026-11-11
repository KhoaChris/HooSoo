import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const options = {
  ...process.env,
  NODE_ENV: "test",
  FIREBASE_MODE: "emulator",
  FIREBASE_PROJECT_ID: "demo-hoosoo",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  GOOGLE_APPLICATION_CREDENTIALS: "",
  PORT: "4002",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:18080",
  DB_TIMEOUT_MS: "600",
  LOG_LEVEL: "silent",
};
const server = spawn(process.execPath, ["backend/dist/server.js"], {
  env: options,
  stdio: "ignore",
});
try {
  let alive = false;
  for (let i = 0; i < 70; i++) {
    try {
      alive = (await fetch("http://127.0.0.1:4002/api/health")).status === 200;
      if (alive) break;
    } catch {
      /* Wait for the isolated API to bind its port. */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  assert(alive, "isolated API must start");
  const start = Date.now();
  const r = await fetch("http://127.0.0.1:4002/api/ready");
  assert.equal(r.status, 503);
  assert(Date.now() - start < 2500, "ready must have a short timeout");
  assert.equal((await fetch("http://127.0.0.1:4002/api/health")).status, 200);
  const code = await new Promise((resolve) => {
    const p = spawn("npm", ["run", "check:db", "-w", "backend"], {
      env: options,
      stdio: "ignore",
    });
    p.on("exit", resolve);
  });
  assert.equal(code, 1);
  console.log(
    "PASS: isolated Firestore outage returns ready=503; health=200; check:db exits 1. Demo services were not stopped.",
  );
} finally {
  server.kill("SIGTERM");
  setTimeout(() => server.kill("SIGKILL"), 2000).unref();
}
