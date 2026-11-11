import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { app } from "../src/app";
import { auth, db } from "../src/config/firebase-admin";
import { env, ORG_ID } from "../src/config/env";
import * as store from "../src/database/store";
import { mutate, organization, readState } from "../src/database/store";
import { fixture, actor } from "./fixture";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { querySchema } from "@hoosoo/shared";
import { dashboard } from "../src/modules/dashboard/dashboard.queries";
import { subscribeChanges } from "../src/database/live-hub";
import { invalidateReadCache } from "../src/database/read-cache";
import { businessDate } from "../src/utils/time";
import { usageSnapshot } from "../src/observability/firestore-usage";
import { writeFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

let server: Server, base: string;
const tokens: Record<string, string> = {};
async function call(
  role: string,
  path: string,
  method = "GET",
  body?: unknown,
  key: string = crypto.randomUUID(),
) {
  const r = await fetch(base + "/api/v1" + path, {
    method,
    headers: {
      ...(tokens[role] ? { Authorization: "Bearer " + tokens[role] } : {}),
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}
beforeAll(async () => {
  if (env.FIREBASE_MODE !== "emulator" || ORG_ID !== "hoosoo-tests")
    throw new Error("Tests must use the dedicated emulator test organization");
  await db.recursiveDelete(organization);
  const s = fixture();
  await mutate((state) => Object.assign(state, s));
  for (const m of Object.values(s.memberships)) {
    try {
      await auth.createUser({
        uid: m.id,
        email: m.email,
        password: "IntegrationOnly!2026",
      });
    } catch (e) {
      if ((e as { code?: string }).code !== "auth/uid-already-exists") throw e;
      await auth.updateUser(m.id, { password: "IntegrationOnly!2026" });
    }
    const r = await fetch(
      "http://" +
        env.FIREBASE_AUTH_EMULATOR_HOST +
        "/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: m.email,
          password: "IntegrationOnly!2026",
          returnSecureToken: true,
        }),
      },
    );
    tokens[m.employeeId] = (await r.json()).idToken;
  }
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
}, 30000);
afterAll(async () => {
  if (server)
    await new Promise<void>((resolve) => server.close(() => resolve()));
  if (ORG_ID === "hoosoo-tests" && env.FIREBASE_MODE === "emulator")
    await db.recursiveDelete(organization);
});
describe("Real Auth + Express + Firestore integration", () => {
  it("persists a new empty department, includes it in the organization tree and reports quota errors distinctly", async () => {
    const body = {
      name: "Customer Care Regression",
      description: "Synthetic integration department",
    };
    const key = crypto.randomUUID();
    const created = await call("admin", "/departments", "POST", body, key);
    expect(created.status).toBe(200);
    expect(
      (
        await organization.collection("departments").doc(created.body.id).get()
      ).get("name"),
    ).toBe(body.name);
    expect(
      (await call("admin", "/departments", "POST", body, key)).body.id,
    ).toBe(created.body.id);
    const spy = vi.spyOn(store, "readState");
    try {
      const tree = await call("employee", "/organization/tree");
      expect(tree.status).toBe(200);
      expect(tree.body.departments).toContainEqual(
        expect.objectContaining({
          id: created.body.id,
          name: body.name,
          employees: [],
        }),
      );
      expect(spy.mock.calls.flatMap((call) => call[0] || [])).not.toContain(
        "receipts",
      );
      spy.mockClear();
      await call("admin", "/me");
      expect(
        spy.mock.calls.flatMap((call) => [
          ...new Set([...(call[0] || []), ...Object.keys(call[1] || {})]),
        ]),
      ).toEqual(["memberships", "employees", "settings"]);
      spy.mockRejectedValueOnce({ code: 8 });
      const unavailable = await call("admin", "/organization/tree");
      expect(unavailable.status).toBe(503);
      expect(unavailable.body.error.code).toBe("FIRESTORE_QUOTA_EXCEEDED");
      expect(
        (
          await organization
            .collection("departments")
            .doc(created.body.id)
            .get()
        ).exists,
      ).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it("loads default leave balances for a new year with scoped reads", async () => {
    for (const path of [
      "/leave-balances?year=2027",
      "/reports/balances?year=2027",
      "/dashboard?year=2027",
    ]) {
      const result = await call("admin", path);
      expect(result.status).toBe(200);
      const balances = path.startsWith("/dashboard")
        ? result.body.balances
        : result.body.items;
      expect(balances.length).toBeGreaterThan(0);
      expect(balances[0].allowance).toBe(12);
    }
  });
  it("streams committed changes and closes when membership is revoked", async () => {
    expect((await call("none", "/events")).status).toBe(401);
    const controller = new AbortController();
    const response = await fetch(base + "/api/v1/events", {
      headers: { Authorization: "Bearer " + tokens.employee },
      signal: controller.signal,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const reader = response.body!.getReader();
    let buffer = "";
    async function event() {
      const decoder = new TextDecoder();
      while (true) {
        const end = buffer.indexOf("\n\n");
        if (end >= 0) {
          const frame = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (frame.startsWith("event:")) return frame;
          continue;
        }
        const part = await reader.read();
        if (part.done) throw new Error("Stream ended before event");
        buffer += decoder.decode(part.value, { stream: true });
      }
    }
    try {
      expect(await event()).toContain("event: changed");
      const address = "Committed live update";
      const updated = await call("employee", "/me/profile", "PATCH", {
        phone: "",
        address,
      });
      expect(updated.status).toBe(200);
      // A success response already guarantees the database commit is readable.
      expect(
        (
          await organization.collection("employees").doc("employee").get()
        ).data()?.address,
      ).toBe(address);
      const changed = await event();
      expect(changed).toContain("event: changed");
      expect(changed).not.toContain(address);
      await mutate((s) => {
        s.memberships["test-employee"].active = false;
      });
      expect(await event()).toContain("event: revalidate");
      expect((await call("employee", "/events")).status).toBe(403);
    } finally {
      controller.abort();
      await reader.cancel().catch(() => {});
      await mutate((s) => {
        s.memberships["test-employee"].active = true;
      });
    }
  });
  it("rejects unauthenticated requests and forged tokens", async () => {
    expect((await call("none", "/employees")).status).toBe(401);
    tokens.fake = "not-a-token";
    expect((await call("fake", "/me")).status).toBe(401);
  });
  it("enforces ownership/team scope and field redaction", async () => {
    expect((await call("employee", "/employees/outsider")).status).toBe(404);
    expect((await call("manager", "/employees/outsider")).status).toBe(404);
    const r = await call("manager", "/employees/employee");
    expect(r.status).toBe(200);
    expect(r.body.phone).toBeUndefined();
    expect(r.body.address).toBeUndefined();
  });
  it("blocks role escalation and forged organization/employee input", async () => {
    expect(
      (await call("hr", "/users/test-hr/role", "PATCH", { role: "Admin" }))
        .status,
    ).toBe(403);
    expect(
      (
        await call("employee", "/leave-requests", "POST", {
          leaveTypeId: "annual",
          startDate: "2026-11-16",
          endDate: "2026-11-16",
          reason: "test leave",
          employeeId: "outsider",
          orgId: "other",
        })
      ).status,
    ).toBe(400);
    expect(
      (await call("hr", "/settings", "PATCH", { companyName: "Takeover" }))
        .status,
    ).toBe(403);
  });
  it("blocks missing membership and disabled membership despite valid token", async () => {
    await mutate((s) => {
      s.memberships["test-employee"].active = false;
    });
    expect((await call("employee", "/me")).status).toBe(403);
    await mutate((s) => {
      s.memberships["test-employee"].active = true;
    });
  });
  it("protects last Admin and rejects generic leave state PATCH", async () => {
    expect(
      (
        await call("admin", "/users/test-admin/status", "PATCH", {
          active: false,
        })
      ).status,
    ).toBe(409);
    expect(
      (await call("admin", "/users/test-admin/role", "PATCH", { role: "HR" }))
        .status,
    ).toBe(409);
    expect(
      (
        await call("employee", "/leave-requests/anything", "PATCH", {
          status: "approved",
        })
      ).status,
    ).toBe(404);
  });
  it("serializes duplicate attendance and ignores browser time", async () => {
    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        call("employee", "/attendance/check-in", "POST", {}),
      ),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    expect(
      (
        await call("employee", "/attendance/check-in", "POST", {
          checkIn: "fake",
        })
      ).status,
    ).toBe(400);
    expect(
      (await call("outsider", "/attendance/check-out", "POST", {})).status,
    ).toBe(409);
  });
  it("checks idempotency key/body identity on create", async () => {
    const key = crypto.randomUUID(),
      body = {
        leaveTypeId: "annual",
        startDate: "2026-11-16",
        endDate: "2026-11-16",
        reason: "Integration leave",
      };
    const first = await call("employee", "/leave-requests", "POST", body, key);
    const again = await call("employee", "/leave-requests", "POST", body, key);
    expect(first.status).toBe(200);
    expect(again.body.id).toBe(first.body.id);
    expect(
      (
        await call(
          "employee",
          "/leave-requests",
          "POST",
          { ...body, reason: "Changed request" },
          key,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          "employee",
          "/leave-requests/" + first.body.id + "/approve",
          "POST",
          {},
        )
      ).status,
    ).toBe(403);
  });
  it("prevents overspend during concurrent approvals and exactly-once refunds", async () => {
    await call("hr", "/leave-balances/employee/adjustments", "POST", {
      year: 2026,
      amount: -11,
      reason: "Set test quota to one",
    });
    const create = await call("employee", "/leave-requests", "POST", {
      leaveTypeId: "annual",
      startDate: "2026-11-17",
      endDate: "2026-11-17",
      reason: "Second integration leave",
    });
    const all = await call("manager", "/leave-requests?employeeId=employee");
    const ids = all.body.items.map((r: { id: string }) => r.id);
    expect(ids).toHaveLength(2);
    expect(create.status).toBe(200);
    const results = await Promise.all(
      ids.map((id: string) =>
        call("manager", "/leave-requests/" + id + "/approve", "POST", {}),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const approved = results.find((r) => r.status === 200)!.body;
    const repeated = await Promise.all([
      call(
        "manager",
        "/leave-requests/" + approved.id + "/approve",
        "POST",
        {},
      ),
      call(
        "manager",
        "/leave-requests/" + approved.id + "/approve",
        "POST",
        {},
      ),
    ]);
    expect(repeated.every((r) => r.status === 200)).toBe(true);
    const refunds = await Promise.all([
      call("hr", "/leave-requests/" + approved.id + "/cancel", "POST", {
        reason: "Cancel approved leave",
      }),
      call("hr", "/leave-requests/" + approved.id + "/cancel", "POST", {
        reason: "Cancel approved leave",
      }),
    ]);
    expect(refunds.every((r) => r.status === 200)).toBe(true);
    const state = await readState();
    expect(state.leaveBalances.employee_2026.used).toBe(0);
    expect(
      Object.values(state.leaveBalanceTransactions).filter(
        (t) => t.kind === "refund",
      ),
    ).toHaveLength(1);
  });
  it("rejects duplicate employee codes and updates scope after transfer", async () => {
    const employee = (await call("hr", "/employees/employee")).body;
    const {
      id: _id,
      uid: _uid,
      createdAt: _ca,
      updatedAt: _ua,
      createdBy: _cb,
      ...body
    } = employee;
    expect((await call("hr", "/employees", "POST", body)).status).toBe(409);
    expect(
      (
        await call("hr", "/employees/employee", "PATCH", {
          ...body,
          departmentId: "b",
          managerId: "manager2",
        })
      ).status,
    ).toBe(200);
    expect((await call("manager", "/employees/employee")).status).toBe(404);
    expect((await call("manager2", "/employees/employee")).status).toBe(200);
  });
  it("CSV respects scope and health/ready/unknown API semantics", async () => {
    const r = await fetch(base + "/api/v1/reports/export?kind=employees", {
      headers: { Authorization: "Bearer " + tokens.manager },
    });
    const text = await r.text();
    expect(text).not.toContain("outsider");
    expect(text).not.toContain("private phone");
    expect((await fetch(base + "/api/health")).status).toBe(200);
    expect((await fetch(base + "/api/ready")).status).toBe(200);
    const missing = await fetch(base + "/api/unknown");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("content-type")).toContain("application/json");
  });
  it("creates and safely repeats account linking; rejects existing email", async () => {
    await mutate((s) => {
      s.employees.newperson = {
        ...s.employees.outsider,
        id: "newperson",
        employeeCode: "NEWPERSON",
        email: "test-newperson@hoosoo.demo",
        uid: undefined,
      };
    });
    const body = {
        employeeId: "newperson",
        role: "Employee",
        password: "TemporaryTest!2026",
      },
      key = crypto.randomUUID();
    const first = await call("admin", "/users", "POST", body, key);
    expect(first.status).toBe(200);
    const again = await call("admin", "/users", "POST", body, key);
    expect(again.status).toBe(200);
    expect(again.body.uid).toBe(first.body.uid);
    await auth.deleteUser(first.body.uid);
  });
  it("denies an Auth account with no membership", async () => {
    const uid = "test-unlinked";
    try {
      await auth.createUser({
        uid,
        email: "test-unlinked@hoosoo.demo",
        password: "UnlinkedOnly!2026",
      });
    } catch {
      await auth.updateUser(uid, { password: "UnlinkedOnly!2026" });
    }
    const response = await fetch(
      "http://" +
        env.FIREBASE_AUTH_EMULATOR_HOST +
        "/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test-unlinked@hoosoo.demo",
          password: "UnlinkedOnly!2026",
          returnSecureToken: true,
        }),
      },
    );
    tokens.unlinked = (await response.json()).idToken;
    expect((await call("unlinked", "/me")).status).toBe(403);
    await auth.deleteUser(uid);
  });
  it("records a failed account job after Auth succeeds and recovers without duplicate UID", async () => {
    await mutate((s) => {
      s.employees.recovery = {
        ...s.employees.outsider,
        id: "recovery",
        employeeCode: "RECOVERY",
        email: "test-recovery@hoosoo.demo",
        uid: undefined,
      };
    });
    const realMutate = store.mutate;
    const spy = vi.spyOn(store, "mutate");
    let calls = 0;
    spy.mockImplementation(async (operation) => {
      calls++;
      if (calls === 2) throw new Error("Injected profile commit outage");
      return realMutate(operation);
    });
    const body = {
      employeeId: "recovery",
      role: "Employee",
      password: "RecoveryOnly!2026",
    };
    try {
      const failed = await call("admin", "/users", "POST", body);
      expect(failed.status).toBe(503);
    } finally {
      spy.mockRestore();
    }
    const pending = (await readState()).accountJobs;
    const job = Object.values(pending).find(
      (j) => j.employeeId === "recovery",
    )!;
    expect(job.status).toBe("failed");
    expect((await auth.getUser(job.uid)).email).toBe(
      "test-recovery@hoosoo.demo",
    );
    const recovered = await call("admin", "/users", "POST", body);
    expect(recovered.status).toBe(200);
    expect(recovered.body.uid).toBe(job.uid);
    expect((await readState()).memberships[job.uid].employeeId).toBe(
      "recovery",
    );
    await auth.deleteUser(job.uid);
  });
  it("keeps an explicit failed provisioning job when email is already owned", async () => {
    await mutate((s) => {
      s.employees.conflict = {
        ...s.employees.outsider,
        id: "conflict",
        employeeCode: "CONFLICT",
        email: "test-admin@hoosoo.demo",
        uid: undefined,
      };
    });
    const r = await call("admin", "/users", "POST", {
      employeeId: "conflict",
      role: "Employee",
      password: "ConflictOnly!2026",
    });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("EMAIL_EXISTS");
    const state = await readState();
    expect(
      Object.values(state.accountJobs).find((j) => j.employeeId === "conflict")
        ?.status,
    ).toBe("failed");
    expect(state.employees.conflict.uid).toBeUndefined();
  });
  it("rechecks authorization before replaying a privileged receipt", async () => {
    await mutate((s) => {
      s.memberships["test-employee"].role = "HR";
    });
    const state = await readState();
    const record = Object.values(state.attendanceRecords).find(
      (r) => r.employeeId === "employee",
    )!;
    const key = crypto.randomUUID(),
      body = {
        checkIn: record.checkIn,
        checkOut: record.checkOut,
        reason: "Review attendance receipt",
      };
    const first = await call(
      "employee",
      "/attendance/" + record.id + "/adjustment",
      "PATCH",
      body,
      key,
    );
    expect(first.status).toBe(200);
    await mutate((s) => {
      s.memberships["test-employee"].role = "Employee";
    });
    expect(
      (
        await call(
          "employee",
          "/attendance/" + record.id + "/adjustment",
          "PATCH",
          body,
          key,
        )
      ).status,
    ).toBe(403);
  });
  it("keeps document reads bounded with large history and four simultaneous roles", async () => {
    for (let first = 0; first < 1000; first += 200) {
      const batch = db.batch();
      for (let i = first; i < first + 200; i++) {
        batch.set(organization.collection("auditLogs").doc("usage-" + i), {
          id: "usage-" + i,
          action: "usage.fixture",
          actorId: "test-admin",
          targetId: "usage-fixture",
          changes: {},
          reason: "Synthetic performance fixture",
          createdAt: "2026-01-01T00:00:00.000Z",
        });
        batch.set(organization.collection("receipts").doc("usage-" + i), {
          id: "usage-" + i,
          actorId: "test-admin",
          fingerprint: "fixture",
          result: {},
        });
      }
      await batch.commit();
    }
    const before = usageSnapshot().total.reads;
    await readState();
    const previousFullStateReads = usageSnapshot().total.reads - before;
    const results: Record<
      string,
      { reads: number; writes: number; status: number }
    > = {};
    async function measure(
      name: string,
      role: string,
      path: string,
      method = "GET",
      body?: unknown,
      key?: string,
    ) {
      const before = usageSnapshot().total;
      const response = await call(role, path, method, body, key);
      const after = usageSnapshot().total;
      results[name] = {
        reads: after.reads - before.reads,
        writes: after.writes - before.writes,
        status: response.status,
      };
      expect(response.status).toBe(200);
      return response;
    }
    await measure("session", "admin", "/me");
    expect(results.session.reads).toBe(3);
    const key = crypto.randomUUID(),
      body = { phone: "", address: "Quota optimization regression" };
    await measure("profileWrite", "admin", "/me/profile", "PATCH", body, key);
    expect(results.profileWrite.reads).toBe(4);
    await measure("profileReplay", "admin", "/me/profile", "PATCH", body, key);
    expect(results.profileReplay.writes).toBe(0);
    const created = await measure(
      "departmentCreate",
      "admin",
      "/departments",
      "POST",
      { name: "Quota regression department", description: "Synthetic" },
    );
    expect(results.departmentCreate.reads).toBeLessThanOrEqual(10);
    const tree = await measure("organization", "admin", "/organization/tree");
    expect(
      tree.body.departments.some(
        (d: { id: string }) => d.id === created.body.id,
      ),
    ).toBe(true);
    expect(results.organization.reads).toBeLessThan(25);
    const start = usageSnapshot().total.reads;
    for (let i = 0; i < 10; i++) {
      const responses = await Promise.all(
        ["admin", "hr", "manager", "employee"].flatMap((role) => [
          call(role, "/me"),
          call(role, "/organization/tree"),
        ]),
      );
      expect(responses.every((r) => r.status === 200)).toBe(true);
    }
    const fourRoleReads = usageSnapshot().total.reads - start;
    expect(fourRoleReads).toBeLessThan(1000);
    const invalidBefore = usageSnapshot().total.reads;
    expect((await call("admin", "/leave-requests/bad%2Fpath")).status).toBe(
      400,
    );
    expect(usageSnapshot().total.reads).toBe(invalidBefore);
    writeFileSync(
      new URL(
        "../../output/firebase/quota-optimization-benchmark.json",
        import.meta.url,
      ),
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          environment:
            "isolated Firebase emulators, demo-hoosoo/hoosoo-tests; not cloud quota consumption",
          historyFixture: { auditLogsAdded: 1000, receiptsAdded: 1000 },
          previousFullStateReads,
          results,
          fourRoleReloads: {
            cycles: 10,
            requests: 80,
            documentReads: fourRoleReads,
          },
          idleReadsVerifiedBy:
            "live-hub.test.ts: eight subscribers, ten minutes simulated idle, zero additional reads",
        },
        null,
        2,
      ) + "\n",
    );
  }, 30000);
  it("reduces real SDK reads with warm caches, bounded dashboard history and cursor pages without stale access", async () => {
    await db.recursiveDelete(organization);
    invalidateReadCache();
    const seed = fixture();
    await mutate((s) => Object.assign(s, seed));
    for (let first = 0; first < 2000; first += 100) {
      const batch = db.batch();
      for (let i = first; i < first + 100; i++) {
        const date = new Date(Date.UTC(2018, 0, 1 + i))
          .toISOString()
          .slice(0, 10);
        const employeeId = i % 2 ? "admin" : "employee";
        const id = `${employeeId}_${date}`;
        batch.set(organization.collection("attendanceRecords").doc(id), {
          id,
          employeeId,
          date,
          checkIn: date + "T01:00:00.000Z",
          checkOut: date + "T10:00:00.000Z",
          schedule: seed.settings.main.schedule,
          adjustments: [],
        });
        const createdAt = Timestamp.fromMillis(Date.UTC(2025, 0, 1) + i * 1000);
        if (i < 1500)
          batch.set(
            organization.collection("leaveRequests").doc("history-" + i),
            {
              id: "history-" + i,
              employeeId,
              leaveTypeId: "unpaid",
              typeName: "Unpaid",
              deductsBalance: false,
              startDate: "2025-01-02",
              endDate: "2025-01-02",
              days: 1,
              workDates: ["2025-01-02"],
              reason: "Synthetic history",
              status: "approved",
              history: [],
              createdAt,
            },
          );
        if (i < 1200)
          batch.set(organization.collection("auditLogs").doc("history-" + i), {
            id: "history-" + i,
            action: "employee.updated",
            actorId: "test-admin",
            targetId: "employee",
            changes: {},
            createdAt,
          });
      }
      await batch.commit();
    }
    const results: Record<string, number> = {};
    const before = usageSnapshot().total.reads;
    const originalState = await readState(
      [
        "memberships",
        "employees",
        "departments",
        "settings",
        "attendanceRecords",
        "leaveRequests",
        "leaveBalances",
        "leaveBalanceTransactions",
      ],
      { memberships: { ids: ["test-admin"] } },
    );
    results.previousDashboardReads = usageSnapshot().total.reads - before;
    expect(results.previousDashboardReads).toBeGreaterThan(3500);
    const q = querySchema.parse({});
    const withoutTime = (value: ReturnType<typeof dashboard>) => {
      const { asOf: _asOf, ...rest } = value;
      return rest;
    };
    const changes: (readonly string[] | null)[] = [];
    let ready!: () => void;
    const initialized = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const stop = subscribeChanges({
      change: (change) => {
        changes.push(change.collections);
        ready();
      },
      error: () => {
        throw new Error("Test listener failed");
      },
    });
    await initialized;
    async function measure(name: string, role: string, path: string) {
      const start = usageSnapshot().total.reads;
      const response = await call(role, path);
      results[name] = usageSnapshot().total.reads - start;
      expect(response.status).toBe(200);
      return response.body;
    }
    try {
      const cold = await measure("dashboardCold", "admin", "/dashboard");
      expect(withoutTime(cold)).toEqual(
        withoutTime(dashboard(originalState, actor("Admin"), q)),
      );
      expect(results.dashboardCold).toBeLessThan(60);
      await measure("dashboardWarm", "admin", "/dashboard");
      expect(results.dashboardWarm).toBe(2);
      for (const [role, kind] of [
        ["manager", "Manager"],
        ["employee", "Employee"],
      ] as const) {
        const expectedState = {
          ...originalState,
          memberships: seed.memberships,
        };
        const response = await measure("dashboard_" + role, role, "/dashboard");
        expect(withoutTime(response)).toEqual(
          withoutTime(dashboard(expectedState, actor(kind), q)),
        );
      }
      for (const params of [
        "mine=true",
        "status=approved",
        "departmentId=b",
        "employeeId=employee",
        "startDate=2025-01-01&endDate=2025-01-31",
      ]) {
        const parsed = querySchema.parse(
          Object.fromEntries(new URLSearchParams(params)),
        );
        const response = await call("admin", "/dashboard?" + params);
        expect(response.status).toBe(200);
        expect(withoutTime(response.body)).toEqual(
          withoutTime(dashboard(originalState, actor("Admin"), parsed)),
        );
      }
      await measure("departmentsWarm", "admin", "/departments?pageSize=100");
      expect(results.departmentsWarm).toBe(2);
      const one = await measure("auditPageOne", "admin", "/audit-logs?page=1");
      const two = await measure("auditPageTwo", "admin", "/audit-logs?page=2");
      expect(one.total).toBe(1200);
      expect(one.items).toHaveLength(20);
      expect(two.items).toHaveLength(20);
      expect(
        new Set([...one.items, ...two.items].map((r: { id: string }) => r.id))
          .size,
      ).toBe(40);
      expect(one.items[0].id).toBe("history-1199");
      expect(two.items[0].id).toBe("history-1179");
      expect(results.auditPageOne).toBeLessThanOrEqual(25);
      expect(results.auditPageTwo).toBe(22);
      await measure("auditPageTwoWarm", "admin", "/audit-logs?page=2");
      expect(results.auditPageTwoWarm).toBe(2);
      const filtered = await measure(
        "attendanceMonth",
        "employee",
        "/attendance?mine=true&startDate=2018-01-01&endDate=2018-01-31",
      );
      expect(filtered.total).toBe(16);
      expect(results.attendanceMonth).toBeLessThan(25);
      // A warm directory cannot defeat immediate revocation or a direct transfer.
      await organization
        .collection("memberships")
        .doc("test-employee")
        .update({ active: false });
      expect((await call("employee", "/me")).status).toBe(403);
      await organization
        .collection("memberships")
        .doc("test-employee")
        .update({ active: true });
      await organization
        .collection("employees")
        .doc("employee")
        .update({ status: "terminated" });
      expect((await call("employee", "/me")).status).toBe(403);
      await organization
        .collection("employees")
        .doc("employee")
        .update({ status: "active", managerId: "manager2", departmentId: "b" });
      expect(
        (await call("manager", "/employees")).body.items.some(
          (e: { id: string }) => e.id === "employee",
        ),
      ).toBe(false);
      expect(
        (await call("manager2", "/employees")).body.items.some(
          (e: { id: string }) => e.id === "employee",
        ),
      ).toBe(true);
      await organization
        .collection("employees")
        .doc("employee")
        .update({ managerId: "manager", departmentId: "a" });
      const created = await call("admin", "/departments", "POST", {
        name: "Cache commit test",
        description: "Synthetic",
      });
      expect(created.status).toBe(200);
      expect(
        (await call("admin", "/departments")).body.items.some(
          (d: { id: string }) => d.id === created.body.id,
        ),
      ).toBe(true);
      expect((await call("admin", "/audit-logs")).body.total).toBe(1201);
      // Simulate another API process: write document plus organization version,
      // bypassing this process's mutate() invalidation.
      const count = changes.length;
      const external = db.batch();
      external.update(
        organization.collection("departments").doc(created.body.id),
        { name: "External committed name" },
      );
      external.set(
        organization,
        {
          revision: FieldValue.increment(1),
          collectionVersions: { departments: FieldValue.increment(1) },
        },
        { merge: true },
      );
      await external.commit();
      await vi.waitFor(() => expect(changes.length).toBeGreaterThan(count));
      expect(
        (await call("admin", "/departments")).body.items.find(
          (d: { id: string }) => d.id === created.body.id,
        ).name,
      ).toBe("External committed name");

      // Older approved leave still marks today's attendance as conflicting even
      // when that request is outside the five most recently created requests.
      const today = businessDate();
      const todayBatch = db.batch();
      todayBatch.set(
        organization.collection("attendanceRecords").doc("admin_" + today),
        {
          id: "admin_" + today,
          employeeId: "admin",
          date: today,
          checkIn: today + "T01:00:00.000Z",
          checkOut: null,
          schedule: seed.settings.main.schedule,
          adjustments: [],
        },
      );
      todayBatch.set(
        organization.collection("leaveRequests").doc("older-approved"),
        {
          id: "older-approved",
          employeeId: "admin",
          leaveTypeId: "unpaid",
          typeName: "Unpaid",
          deductsBalance: false,
          startDate: today,
          endDate: today,
          days: 1,
          workDates: [today],
          reason: "Earlier approved leave",
          status: "approved",
          history: [],
          createdAt: Timestamp.fromDate(new Date("2024-01-01T00:00:00Z")),
        },
      );
      todayBatch.set(
        organization,
        {
          revision: FieldValue.increment(1),
          collectionVersions: {
            attendanceRecords: FieldValue.increment(1),
            leaveRequests: FieldValue.increment(1),
          },
        },
        { merge: true },
      );
      const beforeToday = changes.length;
      await todayBatch.commit();
      await vi.waitFor(() =>
        expect(changes.length).toBeGreaterThan(beforeToday),
      );
      const withConflict = await call("admin", "/dashboard");
      expect(withConflict.status).toBe(200);
      expect(withConflict.body.today[0].leaveConflict).toBe(true);
      // Imported ISO-string timestamps keep the previous sorting/date behavior.
      await organization.collection("auditLogs").doc("legacy-import").set({
        id: "legacy-import",
        action: "legacy.import",
        actorId: "test-admin",
        targetId: "employee",
        changes: {},
        createdAt: "2024-01-01T00:00:00.000Z",
      });
      invalidateReadCache(["auditLogs"]);
      const legacy = await call(
        "admin",
        "/audit-logs?startDate=2024-01-01&endDate=2024-01-01",
      );
      expect(legacy.status).toBe(200);
      expect(legacy.body.total).toBe(1);
      expect(legacy.body.items[0].id).toBe("legacy-import");
      writeFileSync(
        new URL(
          "../../output/firebase/backend-read-optimization.json",
          import.meta.url,
        ),
        JSON.stringify(
          {
            environment:
              "isolated Firebase emulators; actual Admin SDK counts, not cloud billing",
            history: { attendance: 2000, leaveRequests: 1500, auditLogs: 1200 },
            results,
            contracts: [
              "role-scoped dashboard equivalence",
              "pagination and total",
              "immediate auth revocation",
              "team transfer",
              "read after local commit",
              "external version invalidation",
            ],
          },
          null,
          2,
        ) + "\n",
      );
    } finally {
      stop();
    }
  }, 30000);
});
