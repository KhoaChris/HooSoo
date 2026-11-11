import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "dotenv";

// Explicitly limited to the locally served HooSoo app and its synthetic accounts.
const config = parse(
  readFileSync(new URL("../frontend/.env.local", import.meta.url)),
);
const access = JSON.parse(
  readFileSync(
    new URL("../backend/.secrets/demo-accounts.json", import.meta.url),
    "utf8",
  ),
);
assert.equal(config.VITE_FIREBASE_MODE, "cloud");
assert.equal(config.VITE_FIREBASE_PROJECT_ID, "hoosoo-37881");
assert.equal(access.projectId, config.VITE_FIREBASE_PROJECT_ID);
const base = "http://127.0.0.1:5173/api/v1";
const tokens = {};
const checks = [];
function passed(name) {
  checks.push(name);
  console.log("PASS " + name);
}
async function call(role, path, options = {}) {
  const response = await fetch(base + path, {
    method: options.method || "GET",
    headers: {
      Authorization: "Bearer " + tokens[role],
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.key ? { "Idempotency-Key": options.key } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const data = response.headers
    .get("content-type")
    ?.includes("application/json")
    ? await response.json()
    : await response.text();
  return { response, data };
}
for (const role of ["Admin", "HR", "Manager", "Employee"]) {
  const account = access.accounts[role];
  assert(account.email.endsWith("@hoosoo.example"));
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(config.VITE_FIREBASE_API_KEY)}`,
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
  const signedIn = await response.json();
  assert.equal(response.status, 200, `Firebase login: ${role}`);
  assert.equal(signedIn.localId, account.uid);
  tokens[role] = signedIn.idToken;
  const { response: meResponse, data: me } = await call(role, "/me");
  assert.equal(meResponse.status, 200, `API membership: ${role}`);
  assert.equal(me.actor.role, role);
  passed(`${role}: Firebase sign-in and API membership`);
}
for (const path of [
  "/dashboard",
  "/employees",
  "/departments",
  "/positions",
  "/organization/tree",
  "/attendance",
  "/leave-types",
  "/leave-requests",
  "/leave-balances",
  "/users",
  "/settings",
  "/audit-logs",
  "/system/status",
  "/reports/employees",
  "/reports/attendance",
  "/reports/leave",
  "/reports/balances",
]) {
  const { response, data } = await call("Admin", path);
  assert.equal(
    response.status,
    200,
    `Admin ${path}: ${data.error?.code || ""}`,
  );
  passed(`Admin GET ${path}`);
}
for (const role of ["HR", "Manager", "Employee"]) {
  assert.equal((await call(role, "/users")).response.status, 403);
}
assert.equal((await call("Employee", "/employees")).response.status, 403);
assert.equal(
  (await call("Employee", "/employees/demo-admin")).response.status,
  404,
);
const managerEmployee = await call("Manager", "/employees/demo-employee");
assert.equal(managerEmployee.response.status, 200);
for (const field of ["phone", "address", "uid"])
  assert(!(field in managerEmployee.data));
passed("Role restrictions and Manager field redaction");

const profile = (await call("Employee", "/me")).data.employee;
const body = { phone: profile.phone, address: profile.address };
const key =
  "cloud_smoke_profile_" +
  createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 24);
const first = await call("Employee", "/me/profile", {
  method: "PATCH",
  body,
  key,
});
const second = await call("Employee", "/me/profile", {
  method: "PATCH",
  body,
  key,
});
assert.equal(first.response.status, 200);
assert.equal(second.response.status, 200);
assert.equal(first.data.phone, second.data.phone);
assert.equal(first.data.address, second.data.address);
passed("Real API write and idempotent replay preserve demo profile values");

const exported = await call("Admin", "/reports/export?kind=employees");
assert.equal(exported.response.status, 200);
assert(
  exported.response.headers
    .get("content-disposition")
    ?.includes("hoosoo-employees.csv"),
);
assert(exported.data.includes("DEMO-001"));
passed("CSV export contains synchronized demo employees");

const out = new URL("../output/firebase/", import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(
  new URL("cloud-api-check.json", out),
  JSON.stringify(
    {
      projectId: access.projectId,
      checkedAt: new Date().toISOString(),
      passed: checks.length,
      checks,
    },
    null,
    2,
  ) + "\n",
);
console.log(`${checks.length} cloud API checks passed.`);
