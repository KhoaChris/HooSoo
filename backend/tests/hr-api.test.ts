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
import { app } from "../src/app";
import { fixture } from "./fixture";
import { defaultRecruitmentStages, queryAffected } from "@hoosoo/shared";
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
beforeEach(() => {
  memory.state = fixture();
  memory.plans = [];
});
const futureWorkDate = () => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 2);
  while ([0, 6].includes(date.getUTCDay()))
    date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};
describe("HR feature HTTP contracts with isolated transactional store", () => {
  it("persists and synchronizes employee → manager → HR, visible to Admin without extra unrelated reads", async () => {
    const date = futureWorkDate(),
      input = {
        date,
        start: "08:00",
        end: "17:00",
        reason: "Đăng ký làm việc qua API",
        version: 0,
      },
      key = crypto.randomUUID();
    const created = await call(
      "employee",
      "/work-registrations",
      "POST",
      input,
      key,
    );
    expect(created.status).toBe(200);
    expect(
      (await call("employee", "/work-registrations", "POST", input, key)).body
        .id,
    ).toBe(created.body.id);
    expect(
      (
        await call(
          "hr",
          `/work-registrations/${created.body.id}/approve`,
          "POST",
          { version: 1, reason: "Không bỏ qua cấp quản lý" },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          "manager",
          `/work-registrations/${created.body.id}/approve`,
          "POST",
          { version: 1, reason: "Đã kiểm tra kế hoạch" },
        )
      ).body.status,
    ).toBe("pending_hr");
    expect(
      (
        await call(
          "hr",
          `/work-registrations/${created.body.id}/approve`,
          "POST",
          { version: 2, reason: "Nhân sự xác nhận lịch" },
        )
      ).body.status,
    ).toBe("approved");
    for (const role of ["admin", "hr", "manager", "employee"]) {
      const path = `/work-registrations?startDate=${date}&endDate=${date}${role === "employee" ? "" : "&approvals=true"}`;
      const response = await call(role, path);
      expect(response.status).toBe(200);
      expect(response.body.items[0].status).toBe("approved");
    }
    expect(memory.plans.flatMap((p) => Object.keys(p))).not.toContain(
      "candidateFiles",
    );
    expect(memory.plans.flatMap((p) => Object.keys(p))).not.toContain(
      "auditLogs",
    );
    expect(
      queryAffected("/work-registrations?mine=true", ["workRegistrations"]),
    ).toBe(true);
    expect(queryAffected("/employees?page=1", ["workRegistrations"])).toBe(
      false,
    );
  });
  it("keeps internal requests scoped and detects concurrent approvals", async () => {
    const date = futureWorkDate(),
      created = await call("employee", "/internal-requests", "POST", {
        kind: "remote_work",
        title: "Làm việc từ xa",
        reason: "Tập trung hoàn thành báo cáo",
        startDate: date,
        endDate: date,
        location: "Tại nhà",
        checkIn: "",
        checkOut: "",
      });
    expect(created.status).toBe(200);
    expect(
      (
        await call(
          "outsider",
          `/internal-requests?startDate=${date}&endDate=${date}`,
        )
      ).body.items,
    ).toHaveLength(0);
    expect(
      (await call("employee", "/internal-requests?approvals=true")).status,
    ).toBe(403);
    const responses = await Promise.all([
      call("manager", `/internal-requests/${created.body.id}/approve`, "POST", {
        version: 1,
        reason: "Đồng ý làm việc từ xa",
      }),
      call("manager", `/internal-requests/${created.body.id}/reject`, "POST", {
        version: 1,
        reason: "Chưa thống nhất kế hoạch",
      }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  });
  it("checks recruitment role, saves original PDF through HTTP, and never lists file payloads", async () => {
    const job = await call("hr", "/recruitment/jobs", "POST", {
      title: "Kỹ sư phần mềm",
      departmentId: "a",
      hiringManagerId: "manager",
      description: "Phát triển sản phẩm",
      openings: 2,
      stages: defaultRecruitmentStages,
      active: true,
      version: 0,
    });
    expect(job.status).toBe(200);
    const candidate = await call("hr", "/recruitment/candidates", "POST", {
      jobId: job.body.id,
      name: "Ứng viên mẫu",
      email: "sample@example.test",
      phone: "0900000000",
      address: "",
      education: "Đại học mẫu",
      experience: "2 năm kinh nghiệm",
      skills: "TypeScript",
      source: "sample",
      note: "Dữ liệu giả lập",
    });
    expect(candidate.status).toBe(200);
    expect((await call("employee", "/recruitment/jobs")).status).toBe(403);
    expect(
      (await call("manager2", `/recruitment/jobs/${job.body.id}/candidates`))
        .status,
    ).toBe(404);
    const pdf = Buffer.from("%PDF-1.7\nOriginal CV bytes\n%%EOF"),
      url = base + `/recruitment/candidates/${candidate.body.id}/cv`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer test-hr",
        "Content-Type": "application/pdf",
        "X-File-Name": encodeURIComponent("CV gốc.pdf"),
        "X-Record-Version": "1",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: pdf,
    });
    expect(response.status).toBe(200);
    memory.plans = [];
    const listed = await call(
      "manager",
      `/recruitment/jobs/${job.body.id}/candidates`,
    );
    expect(listed.body.items[0].cv.size).toBe(pdf.length);
    expect(memory.plans.flatMap((p) => Object.keys(p))).not.toContain(
      "candidateFiles",
    );
    const downloaded = await fetch(url, {
      headers: { Authorization: "Bearer test-manager" },
    });
    expect(downloaded.status).toBe(200);
    expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(pdf);
    expect(
      (await fetch(url, { headers: { Authorization: "Bearer test-employee" } }))
        .status,
    ).toBe(403);
  });
});

import { roles, supervisorRoles, allowedWorkKinds } from "@hoosoo/shared";
import { fields } from "./fixture";
describe("role hierarchy and professional HTTP boundaries", () => {
  beforeEach(() => {
    for (const role of roles) {
      const id = role.toLowerCase();
      if (memory.state!.employees[id]) continue;
      memory.state!.employees[id] = {
        ...memory.state!.employees.employee,
        id,
        uid: "test-" + id,
        name: role,
        employeeCode: id.toUpperCase(),
        email: id + "@example.test",
      };
      memory.state!.memberships["test-" + id] = {
        ...memory.state!.memberships["test-employee"],
        id: "test-" + id,
        employeeId: id,
        role,
        email: id + "@example.test",
      };
    }
  });
  it.each(roles)(
    "authenticates %s and enforces its directory and account boundaries",
    async (role) => {
      const id = role.toLowerCase();
      expect((await call(id, "/me")).body.actor.role).toBe(role);
      expect((await call(id, "/employees")).status).toBe(
        supervisorRoles.includes(role) ? 200 : 403,
      );
      expect((await call(id, "/users")).status).toBe(
        role === "Admin" ? 200 : 403,
      );
      const workspace = await call(id, "/professional/workspace");
      expect(workspace.status).toBe(allowedWorkKinds(role).length ? 200 : 403);
      if (workspace.status === 200)
        expect(workspace.body.kinds).toEqual(allowedWorkKinds(role));
    },
  );
  it("blocks HR mutations against Admin, Director and peers, including indirect catalog and balance changes", async () => {
    for (const target of ["admin", "director", "hr", "manager"]) {
      const before = structuredClone(memory.state);
      const response = await call("hr", "/employees/" + target, "PATCH", {
        ...fields(memory.state!.employees[target]),
        name: "Unauthorized edit",
      });
      expect(response.status).toBe(403);
      expect(memory.state).toEqual(before);
      const detail = await call("hr", "/employees/" + target);
      expect(detail.body.canEdit).toBe(false);
      if (target !== "hr") expect(detail.body.phone).toBeUndefined();
      expect(
        (
          await call("hr", `/leave-balances/${target}/adjustments`, "POST", {
            year: 2026,
            amount: 1,
            reason: "Không được chỉnh cấp trên",
          })
        ).status,
      ).toBe(403);
    }
    expect(
      (
        await call("hr", "/employees/employee", "PATCH", {
          ...fields(memory.state!.employees.employee),
          name: "Updated employee",
        })
      ).status,
    ).toBe(200);
    const departments = await call("hr", "/departments");
    expect(
      departments.body.items.find((d: { id: string }) => d.id === "a").canEdit,
    ).toBe(false);
    expect(
      (
        await call("hr", "/departments/a", "PATCH", {
          name: "Changed",
          description: "Blocked indirect edit",
        })
      ).status,
    ).toBe(403);
    memory.state!.attendanceRecords.admin_day = {
      id: "admin_day",
      employeeId: "admin",
      date: "2026-11-11",
      checkIn: "2026-11-11T01:00:00Z",
      checkOut: null,
      schedule: memory.state!.settings.main.schedule,
      adjustments: [],
    };
    expect(
      (
        await call("hr", "/attendance/admin_day/adjustment", "PATCH", {
          checkIn: "2026-11-11T01:00:00Z",
          checkOut: "2026-11-11T10:00:00Z",
          reason: "Không được chỉnh cấp trên",
        })
      ).status,
    ).toBe(403);
  });
  it("rechecks current target authority on idempotent replay and fails closed for a missing linked membership", async () => {
    const body = {
        ...fields(memory.state!.employees.employee),
        name: "First legitimate edit",
      },
      key = crypto.randomUUID();
    expect(
      (await call("hr", "/employees/employee", "PATCH", body, key)).status,
    ).toBe(200);
    memory.state!.memberships["test-employee"].role = "Director";
    expect(
      (await call("hr", "/employees/employee", "PATCH", body, key)).status,
    ).toBe(403);
    delete memory.state!.memberships["test-employee"];
    expect(
      (await call("hr", "/employees/employee", "PATCH", body)).status,
    ).toBe(403);
  });
  it("preserves Admin-only role assignment and the last administrator", async () => {
    expect(
      (
        await call("hr", "/users/test-employee/role", "PATCH", {
          role: "Director",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call("admin", "/users/test-admin/role", "PATCH", {
          role: "Director",
        })
      ).status,
    ).toBe(409);
    for (const role of roles.filter((r) => r !== "Admin"))
      expect(
        (await call("admin", "/users/test-employee/role", "PATCH", { role }))
          .body.role,
      ).toBe(role);
  });
  it("does not infer access from job titles and installs the IT title catalog idempotently", async () => {
    expect((await call("hr", "/positions/templates", "POST", {})).status).toBe(
      403,
    );
    const first = await call("admin", "/positions/templates", "POST", {});
    expect(first.status).toBe(200);
    expect(first.body.added.length).toBeGreaterThan(10);
    expect(
      (await call("admin", "/positions/templates", "POST", {})).body.added,
    ).toHaveLength(0);
    expect(
      (
        await call("admin", "/employees/employee", "PATCH", {
          ...fields(memory.state!.employees.employee),
          positionId: "it-director",
        })
      ).status,
    ).toBe(200);
    expect((await call("employee", "/me")).body.actor.role).toBe("Employee");
    expect(
      (
        await call("admin", "/employees/qc", "PATCH", {
          ...fields(memory.state!.employees.qc),
          managerId: "employee",
        })
      ).status,
    ).toBe(400);
  });
  const task = {
    kind: "test_run",
    title: "Kiểm thử chức năng",
    project: "HooSoo",
    description: "Kiểm thử luồng nghiệp vụ",
    criteria: "Đủ bằng chứng và kết quả",
    departmentId: "a",
    assigneeId: "qc",
    reviewerId: "manager",
    dueDate: "2026-12-01",
    priority: "normal",
    version: 0,
  };
  it("persists QC delivery and manager review, prevents wrong specialty, self review and stale updates", async () => {
    expect(
      (
        await call("ba", "/professional/work-items", "POST", {
          ...task,
          assigneeId: "ba",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call("manager", "/professional/work-items", "POST", {
          ...task,
          assigneeId: "director",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call("manager", "/professional/work-items", "POST", {
          ...task,
          assigneeId: "qa",
        })
      ).status,
    ).toBe(400);
    const made = await call(
      "manager",
      "/professional/work-items",
      "POST",
      task,
    );
    expect(made.status).toBe(200);
    const path = `/professional/work-items/${made.body.id}`,
      action = (version: number) => ({
        version,
        note: "Đã kiểm tra kết quả",
        evidenceUrl: "",
      });
    expect(
      (await call("qc", path + "/start", "POST", action(1))).body.status,
    ).toBe("in_progress");
    expect(
      (
        await call("qc", path + "/submit", "POST", {
          ...action(2),
          evidenceUrl: "javascript:alert(1)",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call("qc", path + "/submit", "POST", {
          ...action(2),
          evidenceUrl: "https://example.test/result",
        })
      ).body.status,
    ).toBe("in_review");
    expect(
      (await call("qc", path + "/approve", "POST", action(3))).status,
    ).toBe(403);
    expect(
      (await call("manager", path + "/approve", "POST", action(2))).status,
    ).toBe(409);
    expect(
      (await call("manager2", path + "/approve", "POST", action(3))).status,
    ).toBe(404);
    expect(
      (await call("manager", path + "/approve", "POST", action(3))).body.status,
    ).toBe("done");
    memory.plans = [];
    for (const id of ["admin", "manager", "qc"])
      expect(
        (await call(id, "/professional/workspace")).body.items[0].status,
      ).toBe("done");
    expect(
      (await call("ba", "/professional/workspace")).body.items,
    ).toHaveLength(0);
    expect(memory.plans.flatMap((p) => Object.keys(p))).not.toContain(
      "candidateFiles",
    );
    expect(queryAffected("/professional/workspace", ["workItems"])).toBe(true);
    expect(queryAffected("/employees", ["workItems"])).toBe(false);
  });
  it("revokes a creator's management actions after demotion, and respects direct-report scope", async () => {
    const made = await call(
        "manager",
        "/professional/work-items",
        "POST",
        task,
      ),
      path = `/professional/work-items/${made.body.id}`;
    memory.state!.memberships["test-manager"].role = "QC";
    expect(
      (
        await call("manager", path + "/cancel", "POST", {
          version: 1,
          note: "Không còn quyền điều phối",
        })
      ).status,
    ).toBe(403);
    memory.state!.memberships["test-manager"].role = "Manager";
    expect(
      (await call("projectmanager", "/professional/work-items", "POST", task))
        .status,
    ).toBe(403);
    memory.state!.employees.qc.managerId = "projectmanager";
    expect(
      (
        await call("projectmanager", "/professional/work-items", "POST", {
          ...task,
          reviewerId: "projectmanager",
        })
      ).status,
    ).toBe(200);
  });
});
