import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import type { State, Table } from "@hoosoo/shared";

import type {
  ReadPlan,
  ReadSelection,
  StateReader,
} from "../src/database/store";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
const memory = vi.hoisted(() => ({
  state: null as State | null,
  plans: [] as ReadPlan[],
  queue: Promise.resolve(),
}));
// Keep rate limiting active, with a fresh counter for each independent scenario.
const rateStores = vi.hoisted(
  () => [] as { resetAll: () => void | Promise<void> }[],
);
vi.mock("express-rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("express-rate-limit")>();
  return {
    ...actual,
    default: (options: Parameters<typeof actual.default>[0]) => {
      const store = new actual.MemoryStore();
      rateStores.push(store);
      return actual.default({ ...options, store });
    },
  };
});
vi.mock("../src/middleware/authenticate", () => ({
  authenticate: (
    req: { header: (k: string) => string },
    res: { locals: Record<string, unknown> },
    next: () => void,
  ) => {
    res.locals.uid = req.header("Authorization")?.replace("Bearer ", "");
    next();
  },
}));
vi.mock("../src/database/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/database/store")>();
  const filter = (
    row: Record<string, unknown>,
    selection: ReadSelection,
  ): boolean => {
    if (selection === true) return true;
    if ("ids" in selection) return selection.ids.includes(String(row.id));
    if ("any" in selection) return selection.any.some((v) => filter(row, v));
    if ("filters" in selection)
      return selection.filters.every((v) => filter(row, v));
    const v = selection.field === "__name__" ? row.id : row[selection.field],
      target = selection.value;
    switch (selection.op) {
      case "in":
        return (target as string[]).includes(String(v));
      case ">=":
        return String(v) >= String(target);
      case "<=":
        return String(v) <= String(target);
      case "<":
        return String(v) < String(target);
      case "array-contains-any":
        return (
          Array.isArray(v) && (target as string[]).some((x) => v.includes(x))
        );
      default:
        return v === target;
    }
  };
  const read = async (plan: ReadPlan) => {
    memory.plans.push(plan);
    const s = actual.emptyState();
    for (const table of Object.keys(plan) as Table[])
      s[table] = Object.fromEntries(
        Object.values(memory.state![table])
          .filter((row) =>
            filter(row as unknown as Record<string, unknown>, plan[table]!),
          )
          .map((row) => [row.id, structuredClone(row)]),
      ) as never;
    return s;
  };
  return {
    ...actual,
    readState: async (selected: Table[] = [], overrides: ReadPlan = {}) =>
      read({
        ...Object.fromEntries(selected.map((t) => [t, true])),
        ...overrides,
      }),
    mutate: async (
      fn: (s: State) => unknown,
      prepare: ReadPlan | ((reader: StateReader) => Promise<State>),
    ) => {
      const operation = memory.queue.then(async () => {
        const s =
            typeof prepare === "function"
              ? await prepare(read)
              : await read(prepare),
          before = structuredClone(s),
          result = fn(s);
        for (const table of actual.tables)
          for (const [id, value] of Object.entries(s[table]))
            if (JSON.stringify(value) !== JSON.stringify(before[table][id]))
              (memory.state![table] as Record<string, unknown>)[id] =
                structuredClone(value);
        return structuredClone(result);
      });
      memory.queue = operation.then(
        () => {},
        () => {},
      );
      return operation;
    },
  };
});
const objects = vi.hoisted(() => new Map<string, Buffer>());
vi.mock("../src/modules/workforce/document-storage", () => ({
  storeDocumentObject: async (key: string, data: Buffer) => {
    objects.set(key, data);
  },
  readDocumentObject: async (key: string) => objects.get(key)!,
}));
import { app } from "../src/app";
import { fixture } from "./fixture";
let server: Server, base: string;
const call = async (
  role: string,
  path: string,
  method = "GET",
  body?: unknown,
  key = crypto.randomUUID(),
) => {
  const response = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer test-${role}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
};
beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
beforeEach(async () => {
  await Promise.all(rateStores.map((store) => store.resetAll()));
  memory.state = fixture();
  memory.plans = [];
});

const reason = "Validated by workforce API tests";
const doc = (employeeId = "employee") => ({
  employeeId,
  title: "Qualification file",
  category: "qualification",
  expiresOn: "",
  fileName: "test.pdf",
  mime: "application/pdf",
  data: Buffer.from("%PDF-1.7\nQA fixture").toString("base64"),
  version: 0,
  reason,
});
describe("workforce HTTP permissions and persistence", () => {
  it("stores document bytes separately, replays once, denies manager and departed-scope downloads", async () => {
    const key = crypto.randomUUID(),
      r = await call("employee", "/workforce/documents", "POST", doc(), key);
    expect(r.status).toBe(200);
    expect(r.body.files[0].objectKey).toBeUndefined();
    const replay = await call(
      "employee",
      "/workforce/documents",
      "POST",
      doc(),
      key,
    );
    expect(replay.status).toBe(200);
    expect(Object.keys(memory.state!.personnelDocuments)).toHaveLength(1);
    const id = r.body.id;
    let response = await fetch(base + `/workforce/documents/${id}/download`, {
      method: "POST",
      headers: {
        Authorization: "Bearer test-employee",
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ fileVersion: 1 }),
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("%PDF-1.7\nQA fixture");
    expect(
      (
        await call("manager", `/workforce/documents/${id}/download`, "POST", {
          fileVersion: 1,
        })
      ).status,
    ).toBe(403);
    expect(
      (await call("hr", "/workforce/documents", "POST", doc("admin"))).status,
    ).toBe(403);
    const update = {
      ...doc(),
      version: r.body.version,
      title: "Revised qualification",
      data: Buffer.from("%PDF-1.7\nsecond").toString("base64"),
    };
    const edited = await call(
      "employee",
      `/workforce/documents/${id}`,
      "PATCH",
      update,
    );
    expect(edited.status).toBe(200);
    expect(edited.body.files).toHaveLength(2);
    expect(edited.body.title).toBe(update.title);
    response = await fetch(base + `/workforce/documents/${id}/download`, {
      method: "POST",
      headers: {
        Authorization: "Bearer test-employee",
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ fileVersion: 1 }),
    });
    expect(await response.text()).toBe("%PDF-1.7\nQA fixture");
  });
  it("enforces time request scope, versions and duplicate approval protection", async () => {
    const body = {
        kind: "hourly_leave",
        date: "2026-11-16",
        start: "08:00",
        end: "12:00",
        leaveTypeId: "annual",
        reason,
      },
      r = await call("employee", "/workforce/time", "POST", body);
    expect(r.status).toBe(200);
    expect(
      (
        await call("manager2", `/workforce/time/${r.body.id}/approve`, "POST", {
          version: r.body.version,
          reason,
        })
      ).status,
    ).toBe(403);
    const key = crypto.randomUUID(),
      approved = await call(
        "manager",
        `/workforce/time/${r.body.id}/approve`,
        "POST",
        { version: r.body.version, reason },
        key,
      );
    expect(approved.status).toBe(200);
    const used = memory.state!.leaveBalances.employee_2026.used;
    expect(
      (
        await call(
          "manager",
          `/workforce/time/${r.body.id}/approve`,
          "POST",
          { version: r.body.version, reason },
          key,
        )
      ).status,
    ).toBe(200);
    expect(memory.state!.leaveBalances.employee_2026.used).toBe(used);
    memory.state!.employees.employee.departmentId = "b";
    memory.state!.employees.employee.managerId = "manager2";
    expect(
      (
        await call(
          "manager",
          `/workforce/time/${r.body.id}/approve`,
          "POST",
          { version: r.body.version, reason },
          key,
        )
      ).status,
    ).toBe(403);
  });
  it("keeps policy revisions and receipt version isolated", async () => {
    const body = {
      title: "QA Policy",
      body: "Policy original",
      kind: "policy",
      departmentIds: ["a"],
      requiresAcknowledgement: true,
      pinned: false,
      publishOn: "2026-01-01",
      expiresOn: "",
      version: 0,
    };
    let r = await call("hr", "/workforce/announcements", "POST", body);
    expect(r.status).toBe(200);
    r = await call(
      "hr",
      `/workforce/announcements/${r.body.id}/publish`,
      "POST",
      { version: r.body.version, reason },
    );
    const id = r.body.id;
    expect(
      (
        await call(
          "outsider",
          `/workforce/announcements/${id}/acknowledge`,
          "POST",
          { version: r.body.version, reason },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          "employee",
          `/workforce/announcements/${id}/acknowledge`,
          "POST",
          { version: r.body.version, reason },
        )
      ).body.acknowledged,
    ).toBe(true);
    r = await call("hr", `/workforce/announcements/${id}`, "PATCH", {
      ...body,
      body: "Updated policy",
      version: r.body.version,
    });
    expect(r.body.body).toBe("Updated policy");
    expect(r.body.contentVersion).toBe(2);
    expect(
      (await call("employee", "/workforce/announcements")).body.items,
    ).toHaveLength(0);
  });
  it("imports atomically, refuses injected privileges and protects replayed writes", async () => {
    const rows = [
      {
        name: "New employee QA",
        email: "new-qa@example.test",
        departmentId: "Dept a",
        positionId: "Developer",
        managerId: "MANAGER",
        hireDate: "2026-11-01",
        status: "active",
      },
    ];
    expect(
      (
        await call("manager", "/workforce/imports/preview", "POST", {
          rows,
          fingerprint: "",
        })
      ).status,
    ).toBe(403);
    const preview = await call("hr", "/workforce/imports/preview", "POST", {
      rows,
      fingerprint: "",
    });
    expect(preview.body.canCommit).toBe(true);
    const key = crypto.randomUUID(),
      commit = { rows, fingerprint: preview.body.fingerprint };
    const result = await call(
      "hr",
      "/workforce/imports/commit",
      "POST",
      commit,
      key,
    );
    expect(result.status).toBe(200);
    expect(result.body.createdIds).toHaveLength(1);
    expect(
      (await call("hr", "/workforce/imports/commit", "POST", commit, key)).body
        .id,
    ).toBe(result.body.id);
    expect(
      Object.values(memory.state!.employees).filter(
        (e) => e.email === rows[0].email,
      ),
    ).toHaveLength(1);
    const invalid = await call("hr", "/workforce/imports/preview", "POST", {
      rows: [{ ...rows[0], role: "Admin" }],
      fingerprint: "",
    });
    expect(invalid.body.canCommit).toBe(false);
  });
});
