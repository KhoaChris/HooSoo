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
import { canDropCandidate } from "../../frontend/src/pages/recruitment/candidate-movement";
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
vi.mock("../src/modules/chat/chat.repository", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../src/modules/chat/chat.repository")
    >();
  return {
    ...actual,
    readMessages: async (
      roomId: string,
      sequence: number,
      after?: number,
      before?: number,
    ) => {
      let items = Object.values(memory.state!.chatMessages)
        .filter(
          (m) =>
            m.roomId === roomId &&
            m.sequence <= sequence &&
            (after === undefined || m.sequence > after) &&
            (before === undefined || m.sequence < before),
        )
        .sort((a, b) => a.sequence - b.sequence);
      const hasMore = items.length > 40;
      items = after === undefined ? items.slice(-40) : items.slice(0, 40);
      return { items, hasMore };
    },
  };
});
import { app } from "../src/app";
import { fixture } from "./fixture";
import {
  assessmentCriteria,
  defaultRecruitmentStages,
  queryAffected,
} from "@hoosoo/shared";
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
const futureWorkDate = () => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 2);
  while ([0, 6].includes(date.getUTCDay()))
    date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};
const newEmployeeInput = (email = "new@example.test") => ({
  name: "Nhân viên mới",
  email,
  departmentId: "a",
  positionId: "dev",
  managerId: "manager",
  hireDate: "2026-11-16",
  status: "active",
});
describe("structured recruitment evaluations over HTTP", () => {
  it("validates, persists and returns the scorecard to permitted viewers without additional read collections", async () => {
    const job = await call("hr", "/recruitment/jobs", "POST", {
      title: "Kỹ sư phần mềm",
      departmentId: "a",
      hiringManagerId: "manager",
      description: "Phát triển sản phẩm",
      openings: 1,
      stages: defaultRecruitmentStages,
      active: true,
      version: 0,
    });
    const created = await call("hr", "/recruitment/candidates", "POST", {
      jobId: job.body.id,
      name: "Ứng viên đánh giá",
      email: "scorecard@example.test",
      phone: "0900000000",
      address: "",
      education: "Cử nhân CNTT",
      experience: "3 năm",
      skills: "TypeScript",
      source: "application",
      note: "",
    });
    expect(created.status).toBe(200);
    const path = `/recruitment/candidates/${created.body.id}`;
    const assessment = {
      rubricVersion: 1,
      kind: "screening",
      ratings: assessmentCriteria.screening.map((c) => ({
        criterionId: c.id,
        rating: 4,
        evidence: "Minh chứng qua dự án",
      })),
      strengths: "Giải pháp rõ ràng",
      concerns: "Cần xác nhận kinh nghiệm vận hành",
    };
    const input = {
      version: 1,
      result: "passed",
      reason: "Đáp ứng yêu cầu của vị trí",
      assessment,
    };
    for (const bad of [
      { ...input, assessment: { ...assessment, totalPercent: 100 } },
      {
        ...input,
        assessment: { ...assessment, ratings: assessment.ratings.slice(1) },
      },
    ])
      expect((await call("hr", path + "/evaluate", "POST", bad)).status).toBe(
        400,
      );
    expect(
      (await call("employee", path + "/evaluate", "POST", input)).status,
    ).toBe(403);
    expect(
      (await call("manager2", path + "/evaluate", "POST", input)).status,
    ).toBe(404);
    expect(memory.state!.candidates[created.body.id].version).toBe(1);
    memory.plans = [];
    const key = crypto.randomUUID();
    const saved = await call(
      "hr",
      path + "/evaluate",
      "POST",
      { ...input, score: 1 },
      key,
    );
    expect(saved.status).toBe(200);
    expect(saved.body.rounds[0].assessment).toEqual({
      ...assessment,
      totalPercent: 80,
    });
    expect(saved.body.rounds[0].score).toBe(4);
    expect(saved.body.version).toBe(2);
    expect(
      memory.plans.every((p) =>
        Object.keys(p).every((t) =>
          [
            "memberships",
            "employees",
            "recruitmentJobs",
            "candidates",
            "auditLogs",
            "receipts",
          ].includes(t),
        ),
      ),
    ).toBe(true);
    expect(
      memory.plans.filter((p) => p.candidates).map((p) => p.candidates),
    ).toEqual([{ ids: [created.body.id] }]);
    const replay = await call(
      "hr",
      path + "/evaluate",
      "POST",
      { ...input, score: 1 },
      key,
    );
    expect(replay.body.version).toBe(2);
    expect((await call("hr", path + "/evaluate", "POST", input)).status).toBe(
      409,
    );
    for (const role of ["admin", "hr", "manager"]) {
      const response = await call(
        role,
        `/recruitment/jobs/${job.body.id}/candidates`,
      );
      expect(response.status).toBe(200);
      expect(response.body.items[0].rounds[0].assessment).toEqual(
        saved.body.rounds[0].assessment,
      );
    }
    expect(
      (await call("manager2", `/recruitment/jobs/${job.body.id}/candidates`))
        .status,
    ).toBe(404);
    expect(
      (await call("employee", `/recruitment/jobs/${job.body.id}/candidates`))
        .status,
    ).toBe(403);
    expect(
      memory.state!.candidates[created.body.id].rounds[0].assessment,
    ).toEqual(saved.body.rounds[0].assessment);
  });
});
describe("kanban candidate transitions over HTTP", () => {
  it("keeps drag eligibility, sequential review, authorization and version checks consistent", async () => {
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
    const created = await call("hr", "/recruitment/candidates", "POST", {
      jobId: job.body.id,
      name: "Ứng viên kiểm thử",
      email: "kanban@example.test",
      phone: "0900000000",
      address: "",
      education: "Cử nhân CNTT",
      experience: "3 năm kinh nghiệm",
      skills: "TypeScript",
      source: "sample",
      note: "",
    });
    expect(created.status).toBe(200);
    const path = `/recruitment/candidates/${created.body.id}`;
    const move = {
      version: 1,
      stageId: defaultRecruitmentStages[1].id,
      reason: "Mời tham gia vòng kế tiếp",
    };
    expect(canDropCandidate(created.body, job.body, move.stageId, true)).toBe(
      false,
    );
    expect(
      (await call("hr", path + "/move", "POST", move)).body.error.code,
    ).toBe("STAGE_NOT_PASSED");
    const evaluated = await call("hr", path + "/evaluate", "POST", {
      version: 1,
      result: "passed",
      score: 4,
      reason: "Kinh nghiệm phù hợp vị trí",
    });
    expect(evaluated.status).toBe(200);
    move.version = evaluated.body.version;
    expect(canDropCandidate(evaluated.body, job.body, move.stageId, true)).toBe(
      true,
    );
    expect(
      canDropCandidate(evaluated.body, job.body, move.stageId, false),
    ).toBe(false);
    for (const target of [
      defaultRecruitmentStages[0].id,
      defaultRecruitmentStages[2].id,
      "hired",
      "rejected",
    ]) {
      expect(canDropCandidate(evaluated.body, job.body, target, true)).toBe(
        false,
      );
      expect(
        (await call("hr", path + "/move", "POST", { ...move, stageId: target }))
          .body.error.code,
      ).toBe("SEQUENTIAL_STAGE_REQUIRED");
    }
    expect((await call("manager2", path + "/move", "POST", move)).status).toBe(
      404,
    );
    expect((await call("employee", path + "/move", "POST", move)).status).toBe(
      403,
    );
    const key = crypto.randomUUID();
    const moved = await call("manager", path + "/move", "POST", move, key);
    expect(moved.status).toBe(200);
    expect(moved.body.stageId).toBe(move.stageId);
    expect(moved.body.history.at(-1).action).toBe("moved");
    const replay = await call("manager", path + "/move", "POST", move, key);
    expect(replay.status).toBe(200);
    expect(replay.body.version).toBe(moved.body.version);
    expect((await call("hr", path + "/move", "POST", move)).status).toBe(409);
    expect(
      (
        await call("hr", path + "/evaluate", "POST", {
          version: moved.body.version,
          result: "passed",
          score: 4,
          reason: "Chưa duyệt lịch phỏng vấn",
        })
      ).body.error.code,
    ).toBe("INTERVIEW_REQUIRED");
    const live = memory.state!.candidates[created.body.id];
    for (const status of ["hired", "rejected"] as const) {
      live.status = status;
      expect(
        canDropCandidate(live, job.body, defaultRecruitmentStages[2].id, true),
      ).toBe(false);
      expect(
        (
          await call("hr", path + "/move", "POST", {
            ...move,
            version: live.version,
          })
        ).body.error.code,
      ).toBe("CANDIDATE_CLOSED");
    }
    live.status = "active";
    memory.state!.recruitmentJobs[job.body.id].active = false;
    expect(
      (
        await call("hr", path + "/move", "POST", {
          ...move,
          version: live.version,
        })
      ).body.error.code,
    ).toBe("JOB_CLOSED");
  });
});

describe("server-issued employee codes over HTTP", () => {
  it("allocates unique sequential codes for simultaneous Admin/HR submissions", async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        call(
          i % 2 ? "hr" : "admin",
          "/employees",
          "POST",
          newEmployeeInput(`new${i}@example.test`),
        ),
      ),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    expect(results.map((r) => r.body.employeeCode).sort()).toEqual([
      "HS-000001",
      "HS-000002",
      "HS-000003",
      "HS-000004",
    ]);
    expect(memory.state!.employeeSequences.main.lastNumber).toBe(4);
    expect(
      memory.plans
        .filter((p) => p.employeeSequences)
        .map((p) => p.employeeSequences),
    ).toEqual(Array(4).fill({ ids: ["main"] }));
  });

  it("replays simultaneous duplicate submissions without consuming another number", async () => {
    const key = crypto.randomUUID(),
      body = newEmployeeInput();
    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        call("hr", "/employees", "POST", body, key),
      ),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    expect(results.every((r) => r.body.employeeCode === "HS-000001")).toBe(
      true,
    );
    expect(memory.state!.employeeSequences.main.lastNumber).toBe(1);
    expect(Object.keys(memory.state!.employees).length).toBe(7);
    expect(
      (
        await call(
          "hr",
          "/employees",
          "POST",
          { ...body, name: "Changed" },
          key,
        )
      ).status,
    ).toBe(409);
    expect(memory.state!.employeeSequences.main.lastNumber).toBe(1);
  });

  it("preserves codes on edit, refuses code changes and never reads the sequence for edits or lists", async () => {
    const e = memory.state!.employees.employee;
    const body = { ...newEmployeeInput(e.email), name: e.name };
    const edited = await call("hr", "/employees/employee", "PATCH", body);
    expect(edited.status).toBe(200);
    expect(edited.body.employeeCode).toBe("EMPLOYEE");
    expect(
      (
        await call("hr", "/employees/employee", "PATCH", {
          ...body,
          employeeCode: "HS-999999",
        })
      ).status,
    ).toBe(400);
    const legacy = await call("hr", "/employees/employee", "PATCH", {
      ...body,
      employeeCode: "employee",
    });
    expect(legacy.status).toBe(200);
    expect(legacy.body.employeeCode).toBe("EMPLOYEE");
    expect((await call("hr", "/employees")).status).toBe(200);
    expect(memory.plans.some((p) => p.employeeSequences)).toBe(false);
    expect(memory.state!.employeeSequences).toEqual({});
  });

  it("ignores legacy client-supplied codes and retains creation permissions", async () => {
    const body = { ...newEmployeeInput(), employeeCode: "ADMIN" };
    for (const role of ["employee", "manager"])
      expect((await call(role, "/employees", "POST", body)).status).toBe(403);
    expect(memory.plans.some((p) => p.employeeSequences)).toBe(false);
    const created = await call("hr", "/employees", "POST", body);
    expect(created.status).toBe(200);
    expect(created.body.employeeCode).toBe("HS-000001");
    expect(memory.state!.employees.admin.employeeCode).toBe("ADMIN");
  });
});
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

import { mutationCollections } from "@hoosoo/shared";
describe("atomic recruitment to employee onboarding", () => {
  const hireInput = (email: string) => ({
    version: 1,
    reason: "Đã xác nhận nhận việc",
    positionId: "dev",
    hireDate: "2026-11-16",
    workEmail: email,
    employmentStatus: "probation",
  });
  async function applicant(email = "new-hire@example.test") {
    const job = await call("hr", "/recruitment/jobs", "POST", {
      title: "Developer",
      departmentId: "a",
      hiringManagerId: "manager",
      description: "Đợt tuyển để kiểm thử",
      openings: 1,
      stages: [
        { id: "screen", name: "Sơ tuyển", kind: "screening" },
        { id: "decision", name: "Quyết định", kind: "decision" },
      ],
      active: true,
      version: 0,
    });
    expect(job.status).toBe(200);
    const candidate = await call("hr", "/recruitment/candidates", "POST", {
      jobId: job.body.id,
      name: "Nhân viên tuyển mới",
      email,
      phone: "0900000000",
      address: "Địa chỉ mẫu",
      education: "Bằng cấp mẫu",
      experience: "Kinh nghiệm mẫu",
      skills: "TypeScript",
      source: "sample",
      note: "",
    });
    expect(candidate.status).toBe(200);
    return {
      job: job.body,
      c: candidate.body,
      path: `/recruitment/candidates/${candidate.body.id}`,
    };
  }
  it("shares the same allocation sequence across concurrent manual creation and hiring", async () => {
    const { c, path } = await applicant();
    const [manual, hired] = await Promise.all([
      call(
        "admin",
        "/employees",
        "POST",
        newEmployeeInput("manual@example.test"),
      ),
      call("hr", path + "/direct-hire", "POST", hireInput(c.email)),
    ]);
    expect(manual.status).toBe(200);
    expect(hired.status).toBe(200);
    expect(
      [
        manual.body.employeeCode,
        memory.state!.employees[hired.body.employeeId].employeeCode,
      ].sort(),
    ).toEqual(["HS-000001", "HS-000002"]);
    expect(memory.state!.employeeSequences.main.lastNumber).toBe(2);
  });
  it("creates a complete employee atomically and keeps CV, identities and idempotency safe", async () => {
    const { c, path } = await applicant(),
      body = hireInput(c.email),
      key = crypto.randomUUID();
    const before = Object.keys(memory.state!.employees).length,
      memberships = structuredClone(memory.state!.memberships);
    memory.state!.candidates[c.id].cv = {
      name: "Original.pdf",
      size: 123,
      chunks: 1,
      sha256: "original",
    };
    const hired = await call("hr", path + "/direct-hire", "POST", body, key);
    expect(hired.status).toBe(200);
    expect(hired.body.status).toBe("hired");
    const e = memory.state!.employees[hired.body.employeeId];
    expect(memory.state!.onboardingPlans[e.id].tasks).toHaveLength(6);
    expect(memory.state!.onboardingPlans[e.id].startDate).toBe(e.hireDate);
    expect(e).toMatchObject({
      name: c.name,
      email: c.email,
      phone: c.phone,
      address: c.address,
      departmentId: "a",
      positionId: "dev",
      managerId: "manager",
      hireDate: body.hireDate,
      status: "probation",
      recruitmentCandidateId: c.id,
    });
    expect(e.employeeCode).toBe("HS-000001");
    expect(e.uid).toBeUndefined();
    expect(memory.state!.memberships).toEqual(memberships);
    expect(memory.state!.candidates[c.id].cv?.sha256).toBe("original");
    expect(
      (await call("hr", path + "/direct-hire", "POST", body, key)).body
        .employeeId,
    ).toBe(e.id);
    expect((await call("hr", path + "/direct-hire", "POST", body)).status).toBe(
      409,
    );
    expect(Object.keys(memory.state!.employees)).toHaveLength(before + 1);
    for (const role of ["admin", "hr", "manager"])
      expect(
        (await call(role, "/employees")).body.items.some(
          (row: { id: string }) => row.id === e.id,
        ),
      ).toBe(true);
    for (const route of [
      "/employees?page=1",
      "/organization/tree",
      "/dashboard",
      "/recruitment/jobs/example/candidates",
    ])
      expect(
        queryAffected(route, mutationCollections(path + "/direct-hire")),
      ).toBe(true);
    expect(mutationCollections(path + "/evaluate")).not.toContain("employees");
    expect(memory.plans.flatMap((p) => Object.keys(p))).not.toContain(
      "candidateFiles",
    );
  });
  it("requires successful final evaluation for normal hiring", async () => {
    const { c, path, job } = await applicant();
    expect(
      (await call("hr", path + "/hire", "POST", hireInput(c.email))).status,
    ).toBe(409);
    await call("hr", path + "/evaluate", "POST", {
      version: 1,
      result: "passed",
      score: 4,
      reason: "Hồ sơ đáp ứng yêu cầu",
    });
    await call("hr", path + "/move", "POST", {
      version: 2,
      stageId: job.stages[1].id,
      reason: "Chuyển tới vòng quyết định",
    });
    await call("hr", path + "/evaluate", "POST", {
      version: 3,
      result: "passed",
      score: 5,
      reason: "Đạt tiêu chí tuyển dụng",
    });
    const hired = await call("hr", path + "/hire", "POST", {
      ...hireInput(c.email),
      version: 4,
      employmentStatus: "active",
    });
    expect(hired.status).toBe(200);
    expect(memory.state!.employees[hired.body.employeeId].status).toBe(
      "active",
    );
  });
  it("rolls back hiring when employee data is invalid, duplicate or a role escalation is attempted", async () => {
    const { c, path } = await applicant();
    for (const [body, status] of [
      [{ ...hireInput(c.email), positionId: "missing" }, 400],
      [{ ...hireInput(c.email), workEmail: "TEST-ADMIN@HOOSOO.DEMO" }, 409],
      [{ ...hireInput(c.email), role: "Admin" }, 400],
    ] as const) {
      const before = structuredClone(memory.state);
      expect(
        (await call("hr", path + "/direct-hire", "POST", body)).status,
      ).toBe(status);
      expect(memory.state).toEqual(before);
    }
    expect(
      (await call("manager", path + "/direct-hire", "POST", hireInput(c.email)))
        .status,
    ).toBe(403);
    expect(
      (
        await call("hr", path + "/direct-hire", "POST", {
          version: 1,
          reason: "Thiếu thông tin nhận việc",
        })
      ).status,
    ).toBe(400);
  });
  it("prevents duplicates under simultaneous submissions", async () => {
    const { c, path } = await applicant(),
      count = Object.keys(memory.state!.employees).length;
    const results = await Promise.all([
      call("hr", path + "/direct-hire", "POST", hireInput(c.email)),
      call("admin", path + "/direct-hire", "POST", hireInput(c.email)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(Object.keys(memory.state!.employees)).toHaveLength(count + 1);
  });
  it("does not create an employee for rejection and safely backfills a previously hired candidate", async () => {
    const rejected = await applicant("reject@example.test"),
      count = Object.keys(memory.state!.employees).length;
    expect(
      (
        await call("hr", rejected.path + "/reject", "POST", {
          version: 1,
          reason: "Chưa phù hợp yêu cầu",
        })
      ).body.status,
    ).toBe("rejected");
    expect(Object.keys(memory.state!.employees)).toHaveLength(count);
    const { c, path, job } = await applicant("legacy@example.test");
    memory.state!.candidates[c.id].status = "hired";
    memory.state!.recruitmentJobs[job.id].active = false;
    const hired = await call(
      "hr",
      path + "/employee",
      "POST",
      hireInput(c.email),
    );
    expect(hired.status).toBe(200);
    expect(hired.body.status).toBe("hired");
    expect(hired.body.history.at(-1).action).toBe("employee_created");
    expect(
      (
        await call("hr", path + "/employee", "POST", {
          ...hireInput(c.email),
          version: 2,
        })
      ).status,
    ).toBe(409);
    expect(Object.keys(memory.state!.employees)).toHaveLength(count + 1);
  });
});

describe("employee avatar API", () => {
  const validImage = async () => {
    const sharp = (await import("sharp")).default;
    const bytes = await sharp({
      create: { width: 256, height: 256, channels: 3, background: "#087f78" },
    })
      .png()
      .toBuffer();
    return "data:image/png;base64," + bytes.toString("base64");
  };
  it("saves a normalized thumbnail, replays without writing and exposes it through existing reads", async () => {
    const image = await validImage(),
      key = crypto.randomUUID();
    const payload = { image, version: 0 };
    const saved = await call("employee", "/me/avatar", "PATCH", payload, key);
    expect(saved.status).toBe(200);
    const avatar = memory.state!.employees.employee.avatarUrl!;
    expect(avatar).toMatch(/^data:image\/webp;base64,/);
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(
      Buffer.from(avatar.split(",")[1], "base64"),
    ).metadata();
    expect(metadata.width).toBe(192);
    expect(metadata.height).toBe(192);
    expect(metadata.exif).toBeUndefined();
    const state = structuredClone(memory.state);
    expect(
      (await call("employee", "/me/avatar", "PATCH", payload, key)).status,
    ).toBe(200);
    expect(memory.state).toEqual(state);
    expect(JSON.stringify(memory.state!.receipts)).not.toContain("data:image");
    expect(JSON.stringify(memory.state!.auditLogs)).not.toContain("data:image");
    expect(
      memory.plans.some(
        (p) => p.employees === true || p.positions || p.departments,
      ),
    ).toBe(false);
    expect((await call("employee", "/me")).body.employee.avatarUrl).toBe(
      avatar,
    );
    expect((await call("hr", "/employees/employee")).body.avatarUrl).toBe(
      avatar,
    );
    const org = (await call("employee", "/organization/tree")).body;
    expect(
      org.departments
        .flatMap(
          (d: { employees: { id: string; avatarUrl: string }[] }) =>
            d.employees,
        )
        .find((e: { id: string }) => e.id === "employee").avatarUrl,
    ).toBe(avatar);
  });
  it("rejects stale updates and removes only the avatar", async () => {
    const image = await validImage();
    await call("employee", "/me/avatar", "PATCH", { image, version: 0 });
    const before = structuredClone(memory.state);
    expect(
      (
        await call("employee", "/me/avatar", "PATCH", {
          image: null,
          version: 0,
        })
      ).status,
    ).toBe(409);
    expect(memory.state).toEqual(before);
    expect(
      (
        await call("employee", "/me/avatar", "PATCH", {
          image: null,
          version: 1,
        })
      ).status,
    ).toBe(200);
    expect(memory.state!.employees.employee).toEqual({
      ...before!.employees.employee,
      avatarUrl: null,
      avatarVersion: 2,
    });
  });
  it("enforces hierarchy for other profiles with bounded reads", async () => {
    memory.state!.employees.director = {
      ...memory.state!.employees.employee,
      id: "director",
      uid: "test-director",
    };
    memory.state!.memberships["test-director"] = {
      ...memory.state!.memberships["test-employee"],
      id: "test-director",
      employeeId: "director",
      role: "Director",
    };
    const payload = { image: await validImage(), version: 0 };
    for (const [actor, target] of [
      ["hr", "admin"],
      ["hr", "director"],
      ["manager", "employee"],
      ["employee", "admin"],
    ]) {
      const before = structuredClone(memory.state);
      expect(
        (await call(actor, `/employees/${target}/avatar`, "PATCH", payload))
          .status,
      ).toBe(403);
      expect(memory.state).toEqual(before);
    }
    memory.plans = [];
    expect(
      (await call("hr", "/employees/employee/avatar", "PATCH", payload)).status,
    ).toBe(200);
    expect(
      memory.plans.some(
        (p) =>
          p.employees === true ||
          p.memberships === true ||
          p.positions ||
          p.departments,
      ),
    ).toBe(false);
    const key = crypto.randomUUID();
    expect(
      (await call("hr", "/employees/hr/avatar", "PATCH", payload, key)).status,
    ).toBe(200);
    expect(
      (await call("hr", "/employees/hr/avatar", "PATCH", payload, key)).status,
    ).toBe(200);
  });
  it("rejects invalid, oversized and non-image payloads without writes", async () => {
    for (const image of [
      "https://example.test/photo.png",
      "data:image/svg+xml;base64,PHN2Zy8+",
      "data:image/png;base64,YmFk",
      "data:image/png;base64," + "A".repeat(60000),
    ]) {
      const before = structuredClone(memory.state);
      expect(
        (await call("employee", "/me/avatar", "PATCH", { image, version: 0 }))
          .status,
      ).toBe(400);
      expect(memory.state).toEqual(before);
    }
    expect(
      (
        await call("employee", "/me/avatar", "PATCH", {
          image: null,
          version: 0,
          employeeId: "admin",
        })
      ).status,
    ).toBe(400);
  });
});

describe("Private messaging HTTP contracts", () => {
  const direct = () =>
    call("employee", "/chat/rooms", "POST", {
      kind: "direct",
      memberIds: ["manager"],
    });
  it("deduplicates direct rooms, persists a message once, and never accepts a forged sender", async () => {
    const first = await direct(),
      second = await direct();
    expect(first.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    const path = `/chat/rooms/${first.body.id}/messages`,
      key = crypto.randomUUID();
    const one = await call(
      "employee",
      path,
      "POST",
      { text: "Chào quản lý" },
      key,
    );
    const again = await call(
      "employee",
      path,
      "POST",
      { text: "Chào quản lý" },
      key,
    );
    expect(one.status).toBe(200);
    expect(again.body.id).toBe(one.body.id);
    expect(Object.values(memory.state!.chatMessages)).toHaveLength(1);
    expect((await call("manager", path)).body.items[0].senderId).toBe(
      "employee",
    );
    expect(
      (await call("employee", path, "POST", { text: "Giả", senderId: "admin" }))
        .status,
    ).toBe(400);
    expect(
      (await call("employee", path, "POST", { text: "Khác" }, key)).status,
    ).toBe(409);
    expect(memory.plans.every((plan) => plan.chatMessages !== true)).toBe(true);
  });
  it("denies reading, sending, and managing a private room even to Admin and HR", async () => {
    const room = (await direct()).body;
    for (const role of ["admin", "hr", "outsider"]) {
      expect((await call(role, `/chat/rooms/${room.id}/messages`)).status).toBe(
        404,
      );
      expect(
        (
          await call(role, `/chat/rooms/${room.id}/messages`, "POST", {
            text: "Ngoài nhóm",
          })
        ).status,
      ).toBe(404);
      expect((await call(role, "/chat/rooms")).body).toHaveLength(0);
    }
  });
  it("enforces group ownership, optimistic versions and immediate revocation including receipt replay", async () => {
    const room = (
      await call("employee", "/chat/rooms", "POST", {
        kind: "group",
        title: "Nhóm sản phẩm",
        memberIds: ["manager", "hr"],
      })
    ).body;
    const path = `/chat/rooms/${room.id}`,
      key = crypto.randomUUID();
    expect(
      (await call("hr", path + "/messages", "POST", { text: "Đã nhận" }, key))
        .status,
    ).toBe(200);
    const update = {
      title: "Nhóm mới",
      memberIds: ["employee", "manager"],
      ownerId: "employee",
      version: room.version,
    };
    expect((await call("manager", path, "PATCH", update)).status).toBe(403);
    expect((await call("employee", path, "PATCH", update)).status).toBe(200);
    expect((await call("employee", path, "PATCH", update)).status).toBe(409);
    expect((await call("hr", path + "/messages")).status).toBe(404);
    expect(
      (await call("hr", path + "/messages", "POST", { text: "Đã nhận" }, key))
        .status,
    ).toBe(404);
    expect((await call("hr", "/chat/rooms")).body).toHaveLength(0);
    expect((await call("manager", path + "/messages")).body.items).toHaveLength(
      1,
    );
  });
  it("rejects disabled users, inactive invitees, malformed messages and empty groups", async () => {
    const room = (await direct()).body;
    memory.state!.memberships["test-manager"].active = false;
    expect(
      (await call("manager", `/chat/rooms/${room.id}/messages`)).status,
    ).toBe(403);
    expect((await direct()).status).toBe(400);
    expect(
      (
        await call("employee", `/chat/rooms/${room.id}/messages`, "POST", {
          text: " ",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call("employee", `/chat/rooms/${room.id}/messages`, "POST", {
          text: "a".repeat(4001),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call("employee", "/chat/rooms", "POST", {
          kind: "group",
          title: "",
          memberIds: ["hr"],
        })
      ).status,
    ).toBe(400);
  });
  it("records a member leaving once and immediately revokes their history access", async () => {
    const room = (
      await call("employee", "/chat/rooms", "POST", {
        kind: "group",
        title: "Nhóm dự án",
        memberIds: ["manager", "hr"],
      })
    ).body;
    const path = `/chat/rooms/${room.id}`,
      key = crypto.randomUUID();
    const body = { action: "leave", version: room.version };
    expect(
      (await call("employee", path + "/lifecycle", "POST", body)).status,
    ).toBe(409);
    expect(
      (await call("manager", path + "/lifecycle", "POST", body, key)).body,
    ).toEqual({ id: room.id, left: true });
    expect(
      (await call("manager", path + "/lifecycle", "POST", body, key)).body,
    ).toEqual({ id: room.id, left: true });
    expect((await call("manager", path + "/messages")).status).toBe(404);
    expect(
      (
        await call("manager", path + "/messages", "POST", {
          text: "No longer a member",
        })
      ).status,
    ).toBe(404);
    expect((await call("manager", "/chat/rooms")).body).toHaveLength(0);
    const history = (await call("hr", path + "/messages")).body.items;
    expect(history).toHaveLength(1);
    expect(history[0].event).toMatchObject({
      type: "member_left",
      employeeId: "manager",
      name: memory.state!.employees.manager.name,
    });
    expect(memory.state!.chatRooms[room.id].version).toBe(2);
    expect(
      (
        await call("employee", path + "/messages", "POST", {
          text: "fake",
          event: { type: "member_left", employeeId: "hr", name: "fake" },
        })
      ).status,
    ).toBe(400);
  });
  it("only lets the owner dissolve, keeps history read-only and removes the room per member", async () => {
    const room = (
      await call("employee", "/chat/rooms", "POST", {
        kind: "group",
        title: "Nhóm dự án",
        memberIds: ["manager", "admin"],
      })
    ).body;
    const path = `/chat/rooms/${room.id}`,
      body = { action: "dissolve", version: room.version },
      key = crypto.randomUUID();
    await call("manager", path + "/messages", "POST", {
      text: "Giữ lại lịch sử",
    });
    for (const member of ["manager", "admin"])
      expect(
        (await call(member, path + "/lifecycle", "POST", body)).status,
      ).toBe(403);
    expect(
      (
        await call("manager", path + "/lifecycle", "POST", {
          action: "hide",
          version: room.version,
        })
      ).status,
    ).toBe(409);
    const dissolved = await call(
      "employee",
      path + "/lifecycle",
      "POST",
      body,
      key,
    );
    expect(dissolved.status).toBe(200);
    expect(dissolved.body.dissolved.byId).toBe("employee");
    expect(dissolved.body.dissolved.byName).toBe(
      memory.state!.employees.employee.name,
    );
    expect(
      (await call("employee", path + "/lifecycle", "POST", body, key)).body,
    ).toEqual(dissolved.body);
    const history = (await call("manager", path + "/messages")).body.items;
    expect(history).toHaveLength(2);
    expect(history[1].event.type).toBe("group_dissolved");
    for (const member of ["employee", "manager", "admin"])
      expect(
        (
          await call(member, path + "/messages", "POST", {
            text: "No more sending",
          })
        ).status,
      ).toBe(409);
    expect(
      (
        await call("employee", path, "PATCH", {
          title: "Changed",
          memberIds: room.memberIds,
          ownerId: "employee",
          version: dissolved.body.version,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await call("manager", path + "/lifecycle", "POST", {
          action: "hide",
          version: dissolved.body.version,
        })
      ).status,
    ).toBe(200);
    expect((await call("manager", "/chat/rooms")).body).toHaveLength(0);
    const others = (await call("admin", "/chat/rooms")).body;
    expect(others).toHaveLength(1);
    expect(others[0]).not.toHaveProperty("memberState");
    expect(others[0].viewer.hidden).toBe(false);
    expect(Object.values(memory.state!.chatMessages)).toHaveLength(2);
  });
  it("archives privately, restores explicitly and returns to the inbox on new messages", async () => {
    const room = (
      await call("employee", "/chat/rooms", "POST", {
        kind: "group",
        title: "Lưu trữ",
        memberIds: ["manager"],
      })
    ).body;
    const path = `/chat/rooms/${room.id}/lifecycle`;
    const archived = await call("manager", path, "POST", {
      action: "archive",
      version: room.version,
    });
    expect(archived.body.viewer.archived).toBe(true);
    expect(archived.body).not.toHaveProperty("memberState");
    expect((await call("manager", "/chat/rooms")).body[0].viewer.archived).toBe(
      true,
    );
    expect(
      (await call("employee", "/chat/rooms")).body[0].viewer.archived,
    ).toBe(false);
    expect(
      (
        await call("manager", path, "POST", {
          action: "restore",
          version: room.version,
        })
      ).status,
    ).toBe(409);
    const restored = await call("manager", path, "POST", {
      action: "restore",
      version: room.version,
      preferenceVersion: 1,
    });
    expect(restored.body.viewer.archived).toBe(false);
    await call("manager", path, "POST", {
      action: "archive",
      version: room.version,
      preferenceVersion: 2,
    });
    await call("employee", `/chat/rooms/${room.id}/messages`, "POST", {
      text: "Tin mới",
    });
    expect((await call("manager", "/chat/rooms")).body[0].viewer.archived).toBe(
      false,
    );
    expect(memory.plans.every((plan) => plan.chatMessages !== true)).toBe(true);
  });
  it("denies all lifecycle actions to nonmembers, disabled members and forged targets", async () => {
    const room = (
      await call("employee", "/chat/rooms", "POST", {
        kind: "group",
        title: "Private",
        memberIds: ["manager"],
      })
    ).body;
    const path = `/chat/rooms/${room.id}/lifecycle`;
    for (const role of ["admin", "hr", "outsider"])
      for (const action of ["archive", "restore", "leave", "dissolve", "hide"])
        expect(
          (await call(role, path, "POST", { action, version: room.version }))
            .status,
        ).toBe(404);
    expect(
      (
        await call("manager", path, "POST", {
          action: "archive",
          version: room.version,
          employeeId: "employee",
        })
      ).status,
    ).toBe(400);
    memory.state!.memberships["test-manager"].active = false;
    expect(
      (
        await call("manager", path, "POST", {
          action: "archive",
          version: room.version,
        })
      ).status,
    ).toBe(403);
  });
  it("pages history forwards/backwards without exposing another conversation", async () => {
    const room = (await direct()).body,
      path = `/chat/rooms/${room.id}/messages`;
    for (let n = 0; n < 45; n++)
      expect(
        (await call("employee", path, "POST", { text: `Tin ${n}` })).status,
      ).toBe(200);
    const latest = (await call("manager", path)).body;
    expect(latest.items).toHaveLength(40);
    expect(latest.items[0].sequence).toBe(6);
    expect(latest.hasMore).toBe(true);
    expect((await call("manager", path + "?before=6")).body.items).toHaveLength(
      5,
    );
    expect((await call("manager", path + "?after=44")).body.items).toHaveLength(
      1,
    );
    expect((await call("manager", path + "?after=45")).body.items).toHaveLength(
      0,
    );
    expect((await call("manager", path + "?after=1&before=6")).status).toBe(
      400,
    );
  });
});

describe("role-scoped notification feed", () => {
  it("shows only member chat updates and omits private message content", async () => {
    const room = await call("employee", "/chat/rooms", "POST", {
      kind: "direct",
      memberIds: ["manager"],
    });
    expect(room.status).toBe(200);
    await call("employee", `/chat/rooms/${room.body.id}/messages`, "POST", {
      text: "Private notification test",
    });
    memory.plans = [];
    const manager = await call("manager", "/notifications");
    expect(manager.status).toBe(200);
    expect(
      manager.body.items.some((n: { kind: string }) => n.kind === "chat"),
    ).toBe(true);
    expect(JSON.stringify(manager.body)).not.toContain(
      "Private notification test",
    );
    for (const role of ["employee", "admin", "hr", "outsider"]) {
      const feed = await call(role, "/notifications");
      expect(feed.status).toBe(200);
      expect(
        feed.body.items.some((n: { kind: string }) => n.kind === "chat"),
      ).toBe(false);
    }
    expect(
      memory.plans.some(
        (p) => p.chatMessages || p.auditLogs || p.attendanceRecords,
      ),
    ).toBe(false);
  });
  it("follows manager then HR approval and keeps employee updates private", async () => {
    const date = futureWorkDate();
    const created = await call("employee", "/work-registrations", "POST", {
      date,
      start: "08:00",
      end: "17:00",
      reason: "Notification approval",
      version: 0,
    });
    expect(created.status).toBe(200);
    const feed = async (role: string) => {
      const response = await call(role, "/notifications");
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      return response.body.items as {
        id: string;
        kind: string;
        status: string;
        requiresAction: boolean;
      }[];
    };
    expect(
      (await feed("manager")).some(
        (n) => n.kind === "work" && n.requiresAction,
      ),
    ).toBe(true);
    expect(
      (await feed("hr")).some((n) => n.kind === "work" && n.requiresAction),
    ).toBe(false);
    expect((await feed("outsider")).some((n) => n.kind === "work")).toBe(false);
    await call(
      "manager",
      `/work-registrations/${created.body.id}/approve`,
      "POST",
      { version: 1, reason: "Approved by manager" },
    );
    expect(
      (await feed("hr")).some((n) => n.kind === "work" && n.requiresAction),
    ).toBe(true);
    const approved = await call(
      "hr",
      `/work-registrations/${created.body.id}/approve`,
      "POST",
      { version: 2, reason: "Approved by HR" },
    );
    expect(approved.status).toBe(200);
    expect(
      (await feed("employee")).some(
        (n) =>
          n.kind === "work" && n.status === "approved" && !n.requiresAction,
      ),
    ).toBe(true);
    expect(
      (await feed("manager")).some(
        (n) => n.kind === "work" && n.requiresAction,
      ),
    ).toBe(false);
  });
});

// These scenarios exercise the real routes and command read plans against the
// isolated transactional store. No cloud credentials or Firestore calls are used.
describe("employment lifecycle API", () => {
  const contract = {
    employeeId: "employee",
    kind: "fixed_term",
    title: "Employment agreement",
    startDate: "2027-01-01",
    endDate: "2027-12-31",
    documentUrl: "https://example.test/agreement",
    notes: "Agreed terms",
    version: 0,
  };
  const period = {
    employeeId: "employee",
    startDate: "2026-11-01",
    endDate: "2027-01-01",
    objectives: "Deliver the agreed onboarding milestones",
    version: 0,
  };
  const decision = (version: number) => ({
    version,
    reason: "Reviewed with supporting evidence",
  });
  const assessment = (version: number, recommendation = "confirm") => ({
    version,
    quality: "meets",
    delivery: "exceeds",
    collaboration: "meets",
    independence: "developing",
    strengths: "Completed planned milestones",
    improvements: "Continue developing independent delivery",
    recommendation,
  });
  it("creates, edits, issues, acknowledges and ends a contract, without exposing drafts or other employees' documents", async () => {
    const created = await call("hr", "/employment/contracts", "POST", contract);
    expect(created.status).toBe(200);
    const id = created.body.id;
    expect(
      (await call("employee", "/employment/contracts")).body.items,
    ).toHaveLength(0);
    expect(
      (await call("outsider", "/employment/contracts")).body.items,
    ).toHaveLength(0);
    expect(
      (await call("manager", "/employment/contracts?scope=team")).status,
    ).toBe(403);
    expect(
      (
        await call("hr", `/employment/contracts/${id}`, "PATCH", {
          ...contract,
          title: "Updated agreement",
          version: 1,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call(
          "hr",
          `/employment/contracts/${id}/activate`,
          "POST",
          decision(2),
        )
      ).status,
    ).toBe(200);
    const self = await call("employee", "/employment/contracts");
    expect(self.body.items[0].title).toBe("Updated agreement");
    expect(self.body.items[0].actions).toEqual(["acknowledge"]);
    expect(
      (
        await call(
          "manager",
          `/employment/contracts/${id}/acknowledge`,
          "POST",
          decision(3),
        )
      ).status,
    ).toBe(403);
    const key = crypto.randomUUID();
    const accepted = await call(
      "employee",
      `/employment/contracts/${id}/acknowledge`,
      "POST",
      decision(3),
      key,
    );
    expect(accepted.status).toBe(200);
    expect(
      (
        await call(
          "employee",
          `/employment/contracts/${id}/acknowledge`,
          "POST",
          decision(3),
          key,
        )
      ).body,
    ).toEqual(accepted.body);
    expect(
      (
        await call("hr", `/employment/contracts/${id}`, "PATCH", {
          ...contract,
          version: 4,
        })
      ).status,
    ).toBe(409);
    expect(
      (await call("hr", `/employment/contracts/${id}/end`, "POST", decision(4)))
        .body.status,
    ).toBe("ended");
  });
  it("rejects contract overlap, malformed URLs and changing the employee of an existing record", async () => {
    expect(
      (
        await call("hr", "/employment/contracts", "POST", {
          ...contract,
          documentUrl: "javascript:alert(1)",
        })
      ).status,
    ).toBe(400);
    const first = (await call("hr", "/employment/contracts", "POST", contract))
      .body;
    await call(
      "hr",
      `/employment/contracts/${first.id}/activate`,
      "POST",
      decision(1),
    );
    const next = (await call("hr", "/employment/contracts", "POST", contract))
      .body;
    expect(
      (
        await call(
          "hr",
          `/employment/contracts/${next.id}/activate`,
          "POST",
          decision(1),
        )
      ).body.error.code,
    ).toBe("CONTRACT_OVERLAP");
    expect(
      (
        await call("hr", `/employment/contracts/${next.id}`, "PATCH", {
          ...contract,
          employeeId: "admin",
          version: 1,
        })
      ).status,
    ).toBe(400);
  });
  it("enforces HR/Admin hierarchy on creation, edits, transitions and receipt replay after promotion", async () => {
    expect(
      (
        await call("hr", "/employment/contracts", "POST", {
          ...contract,
          employeeId: "admin",
        })
      ).status,
    ).toBe(403);
    const adminDoc = (
      await call("admin", "/employment/contracts", "POST", {
        ...contract,
        employeeId: "admin",
      })
    ).body;
    expect(
      (
        await call("hr", `/employment/contracts/${adminDoc.id}`, "PATCH", {
          ...contract,
          employeeId: "admin",
          version: 1,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          "hr",
          `/employment/contracts/${adminDoc.id}/activate`,
          "POST",
          decision(1),
        )
      ).status,
    ).toBe(403);
    expect(
      (await call("hr", "/employment/contracts?scope=team")).body.items,
    ).toHaveLength(0);
    const key = crypto.randomUUID();
    await call("hr", "/employment/contracts", "POST", contract, key);
    memory.state!.memberships["test-employee"].role = "Admin";
    expect(
      (await call("hr", "/employment/contracts", "POST", contract, key)).status,
    ).toBe(404);
  });
  it("completes self assessment -> manager assessment -> HR confirmation atomically with employee status", async () => {
    memory.state!.employees.employee.status = "probation";
    const p = (await call("hr", "/employment/probations", "POST", period)).body;
    expect(
      (
        await call(
          "hr",
          `/employment/probations/${p.id}/confirm`,
          "POST",
          decision(1),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          "employee",
          `/employment/probations/${p.id}/self-review`,
          "POST",
          decision(1),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await call(
          "employee",
          `/employment/probations/${p.id}/review`,
          "POST",
          assessment(2),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          "manager2",
          `/employment/probations/${p.id}/review`,
          "POST",
          assessment(2),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          "hr",
          `/employment/probations/${p.id}/review`,
          "POST",
          assessment(2),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          "manager",
          `/employment/probations/${p.id}/review`,
          "POST",
          assessment(2),
        )
      ).body.status,
    ).toBe("in_review");
    expect(
      (
        await call(
          "hr",
          `/employment/probations/${p.id}/confirm`,
          "POST",
          decision(2),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          "manager",
          `/employment/probations/${p.id}/confirm`,
          "POST",
          decision(3),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          "hr",
          `/employment/probations/${p.id}/confirm`,
          "POST",
          decision(3),
        )
      ).body.status,
    ).toBe("confirmed");
    expect(memory.state!.employees.employee.status).toBe("active");
  });
  it("requires a different final approver when no manager exists", async () => {
    memory.state!.employees.employee.status = "probation";
    memory.state!.employees.employee.managerId = "";
    const p = (await call("hr", "/employment/probations", "POST", period)).body;
    expect(
      (
        await call(
          "hr",
          `/employment/probations/${p.id}/review`,
          "POST",
          assessment(1),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await call(
          "hr",
          `/employment/probations/${p.id}/confirm`,
          "POST",
          decision(2),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          "admin",
          `/employment/probations/${p.id}/confirm`,
          "POST",
          decision(2),
        )
      ).status,
    ).toBe(200);
  });
  it("preserves earlier assessments on extension and never auto-terminates an unsuccessful employee", async () => {
    memory.state!.employees.employee.status = "probation";
    const p = (await call("hr", "/employment/probations", "POST", period)).body;
    expect(
      (await call("hr", "/employment/probations", "POST", period)).status,
    ).toBe(409);
    await call(
      "manager",
      `/employment/probations/${p.id}/review`,
      "POST",
      assessment(1, "extend"),
    );
    expect(
      (
        await call(
          "hr",
          `/employment/probations/${p.id}/confirm`,
          "POST",
          decision(2),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call("hr", `/employment/probations/${p.id}/extend`, "POST", {
          ...decision(2),
          endDate: "2026-12-01",
        })
      ).status,
    ).toBe(400);
    const extended = await call(
      "hr",
      `/employment/probations/${p.id}/extend`,
      "POST",
      { ...decision(2), endDate: "2027-02-01" },
    );
    expect(extended.body.assessments).toHaveLength(1);
    await call(
      "manager",
      `/employment/probations/${p.id}/review`,
      "POST",
      assessment(3, "decline"),
    );
    const failed = await call(
      "hr",
      `/employment/probations/${p.id}/decline`,
      "POST",
      decision(4),
    );
    expect(failed.body.status).toBe("declined");
    expect(failed.body.assessments).toHaveLength(2);
    expect(memory.state!.employees.employee.status).toBe("probation");
  });
  it("assigns onboarding tasks by responsibility and prevents premature completion", async () => {
    const p = (
      await call("hr", "/employment/onboarding", "POST", {
        employeeId: "employee",
        startDate: "2026-11-13",
      })
    ).body;
    expect(p.tasks).toHaveLength(6);
    expect(
      (
        await call("hr", "/employment/onboarding", "POST", {
          employeeId: "employee",
          startDate: "2026-11-13",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          "hr",
          `/employment/onboarding/${p.id}/complete`,
          "POST",
          decision(1),
        )
      ).status,
    ).toBe(409);
    const task = p.tasks.find((t: { owner: string }) => t.owner === "employee");
    const body = { version: 1, taskId: task.id, done: true };
    expect(
      (
        await call(
          "hr",
          `/employment/onboarding/${p.id}/tasks/complete`,
          "POST",
          body,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          "outsider",
          `/employment/onboarding/${p.id}/tasks/complete`,
          "POST",
          body,
        )
      ).status,
    ).toBe(403);
    let version = 1;
    for (const task of p.tasks) {
      const updated = await call(
        task.owner === "employee"
          ? "employee"
          : task.owner === "manager"
            ? "manager"
            : "hr",
        `/employment/onboarding/${p.id}/tasks/complete`,
        "POST",
        { version, taskId: task.id, done: true },
      );
      expect(updated.status).toBe(200);
      version = updated.body.version;
    }
    expect(
      (
        await call(
          "hr",
          `/employment/onboarding/${p.id}/complete`,
          "POST",
          decision(version),
        )
      ).body.status,
    ).toBe("completed");
    expect(
      (
        await call(
          "employee",
          `/employment/onboarding/${p.id}/tasks/complete`,
          "POST",
          { ...body, version: version + 1, done: false },
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          "hr",
          `/employment/onboarding/${p.id}/reopen`,
          "POST",
          decision(version + 1),
        )
      ).body.status,
    ).toBe("in_progress");
  });
  it("rechecks current manager scope and limits personal reads to the person's documents", async () => {
    const p = (
      await call("hr", "/employment/onboarding", "POST", {
        employeeId: "employee",
        startDate: "2026-11-13",
      })
    ).body;
    expect(
      (await call("manager", "/employment/onboarding?scope=team")).body.items,
    ).toHaveLength(1);
    memory.state!.employees.employee.departmentId = "b";
    const task = p.tasks.find((t: { owner: string }) => t.owner === "manager");
    expect(
      (
        await call(
          "manager",
          `/employment/onboarding/${p.id}/tasks/complete`,
          "POST",
          { version: 1, taskId: task.id, done: true },
        )
      ).status,
    ).toBe(403);
    expect(
      (await call("manager", "/employment/onboarding?scope=team")).body.items,
    ).toHaveLength(0);
    memory.plans.length = 0;
    expect(
      (await call("employee", "/employment/onboarding")).body.items,
    ).toHaveLength(1);
    expect(
      memory.plans.some(
        (p) =>
          p.onboardingPlans === true ||
          p.employmentContracts ||
          p.probationReviews,
      ),
    ).toBe(false);
    expect(
      queryAffected("/employment/contracts?scope=my", ["onboardingPlans"]),
    ).toBe(false);
    expect(
      queryAffected("/employment/onboarding?scope=my", ["onboardingPlans"]),
    ).toBe(true);
  });
});

describe("performance reviews over authenticated HTTP", () => {
  const setup = {
    employeeId: "employee",
    title: "Q4 assessment",
    startDate: "2026-10-01",
    endDate: "2026-12-31",
    selfDue: "2027-01-05",
    managerDue: "2027-01-10",
    version: 0,
    goals: [
      {
        id: "delivery",
        title: "Deliver agreed work",
        unit: "tasks",
        target: 10,
        weight: 100,
        direction: "higher",
      },
    ],
  };
  const assessment = {
    goals: [
      {
        goalId: "delivery",
        actual: 10,
        evidence: "All agreed work was accepted",
      },
    ],
    competencies: ["quality", "ownership", "teamwork", "growth"].map(
      (criterionId) => ({
        criterionId,
        rating: 4,
        evidence: "Observed on the current project",
      }),
    ),
    strengths: "Reliable project delivery",
    improvements: "Automate regression testing",
    developmentPlan: "Complete automation plan next quarter",
  };
  const reason = "Reviewed the submitted evidence";
  async function completedByManager() {
    let res = await call("manager", "/performance/reviews", "POST", setup);
    expect(res.status).toBe(200);
    const id = res.body.id;
    res = await call("manager", `/performance/reviews/${id}/launch`, "POST", {
      version: res.body.version,
      reason,
    });
    expect(res.status).toBe(200);
    res = await call("manager", `/performance/reviews/${id}/manager`, "POST", {
      version: res.body.version,
      submit: true,
      assessment,
    });
    expect(res.status).toBe(200);
    return res;
  }
  it("lets managers publish directly, denies self assessment and narrows command reads", async () => {
    expect(
      (
        await call("hr", "/performance/reviews", "POST", {
          ...setup,
          employeeId: "admin",
        })
      ).status,
    ).toBe(403);
    expect(
      (await call("employee", "/performance/reviews?scope=team")).status,
    ).toBe(403);
    const key = crypto.randomUUID();
    let res = await call("manager", "/performance/reviews", "POST", setup, key);
    expect(res.status).toBe(200);
    const id = res.body.id;
    expect(
      (await call("manager", "/performance/reviews", "POST", setup, key)).body
        .id,
    ).toBe(id);
    expect(Object.keys(memory.state!.performanceReviews)).toHaveLength(1);
    res = await call("manager", `/performance/reviews/${id}/launch`, "POST", {
      version: res.body.version,
      reason,
    });
    expect(res.body.status).toBe("manager_review");
    expect(
      (
        await call("employee", `/performance/reviews/${id}/self`, "POST", {
          version: res.body.version,
          submit: true,
          assessment,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call("manager2", `/performance/reviews/${id}/manager`, "POST", {
          version: res.body.version,
          submit: true,
          assessment,
        })
      ).status,
    ).toBe(404);
    expect(
      (await call("manager2", "/performance/reviews?scope=team")).body.items,
    ).toHaveLength(0);
    memory.plans = [];
    const stale = res.body.version;
    res = await call("manager", `/performance/reviews/${id}/manager`, "POST", {
      version: stale,
      submit: true,
      assessment,
    });
    expect(res.status).toBe(200);
    expect(
      memory.plans.some((p) => p.performanceReviews === true || p.auditLogs),
    ).toBe(false);
    expect(
      memory.plans
        .flatMap((p) => Object.keys(p))
        .every((k) =>
          [
            "employees",
            "memberships",
            "receipts",
            "performanceReviews",
            "performanceReports",
          ].includes(k),
        ),
    ).toBe(true);
    expect(
      (
        await call("manager", `/performance/reviews/${id}/manager`, "POST", {
          version: stale,
          submit: true,
          assessment,
          reason,
        })
      ).status,
    ).toBe(409);
    expect(
      (await call("employee", "/performance/reviews?scope=my")).body.items[0]
        .managerAssessment,
    ).toBeNull();
    res = await call("manager", `/performance/reviews/${id}/finalize`, "POST", {
      version: res.body.version,
      reason,
    });
    expect(res.status).toBe(200);
    for (const role of ["hr", "admin", "manager"]) {
      const view = await call(role, "/performance/reviews?scope=team");
      expect(view.body.items[0].status).toBe("completed");
      expect(view.body.items[0].managerAssessment.score).toBe(94);
    }
    res = await call(
      "employee",
      `/performance/reviews/${id}/acknowledge`,
      "POST",
      { version: res.body.version, reason },
    );
    expect(res.body.status).toBe("acknowledged");
  });
  it("routes batch reports to a higher reviewer, locks authors and publishes corrections atomically", async () => {
    const created = await completedByManager(),
      id = created.body.id;
    const body = {
      title: "Q4 department report",
      reviewerId: "admin",
      reason,
      reviews: [{ id, version: created.body.version }],
    };
    const key = crypto.randomUUID();
    let report = await call(
      "manager",
      "/performance/reports",
      "POST",
      body,
      key,
    );
    expect(report.status).toBe(200);
    expect(
      (await call("manager", "/performance/reports", "POST", body, key)).body
        .id,
    ).toBe(report.body.id);
    expect(
      (await call("employee", "/performance/reviews?scope=my")).body.reports,
    ).toEqual([]);
    expect(
      (await call("manager", "/performance/reviews?scope=team")).body.reports[0]
        .canDecide,
    ).toBe(false);
    let view = (await call("admin", "/performance/reviews?scope=team")).body;
    expect(view.reports[0].canDecide).toBe(true);
    expect(
      (
        await call("manager", `/performance/reviews/${id}/manager`, "POST", {
          version: view.items[0].version,
          submit: true,
          assessment,
          reason,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          "hr",
          `/performance/reports/${report.body.id}/finalize`,
          "POST",
          { version: report.body.version, reason },
        )
      ).status,
    ).toBe(404);
    const oldVersion = report.body.version;
    const correction = await call(
      "admin",
      `/performance/reviews/${id}/manager`,
      "POST",
      {
        version: view.items[0].version,
        submit: true,
        assessment: {
          ...assessment,
          strengths: "Reviewed and confirmed by department leadership",
        },
        reason,
      },
    );
    expect(correction.status).toBe(200);
    expect(
      (
        await call(
          "admin",
          `/performance/reports/${report.body.id}/finalize`,
          "POST",
          { version: oldVersion, reason },
        )
      ).status,
    ).toBe(409);
    view = (await call("admin", "/performance/reviews?scope=team")).body;
    const finalizeKey = crypto.randomUUID(),
      finalizeBody = { version: view.reports[0].version, reason };
    report = await call(
      "admin",
      `/performance/reports/${report.body.id}/finalize`,
      "POST",
      finalizeBody,
      finalizeKey,
    );
    expect(report.status).toBe(200);
    expect(
      (
        await call(
          "admin",
          `/performance/reports/${report.body.id}/finalize`,
          "POST",
          finalizeBody,
          finalizeKey,
        )
      ).status,
    ).toBe(200);
    const own = (await call("employee", "/performance/reviews?scope=my")).body
      .items[0];
    expect(own.status).toBe("completed");
    expect(own.managerAssessment.by).toBe("test-admin");
    expect(own.revisions).toHaveLength(1);
    expect(
      (
        await call("manager", `/performance/reviews/${id}/manager`, "POST", {
          version: own.version,
          submit: true,
          assessment,
          reason,
        })
      ).status,
    ).toBe(403);
  });
  it("returns corrections to the author and rejects invalid batch entries without partial writes", async () => {
    const res = await completedByManager(),
      id = res.body.id;
    const base = { title: "Q4 report", reviewerId: "admin", reason };
    expect(
      (
        await call("manager", "/performance/reports", "POST", {
          ...base,
          reviews: [
            { id, version: res.body.version },
            { id: "missing", version: 1 },
          ],
        })
      ).status,
    ).toBe(403);
    expect(Object.keys(memory.state!.performanceReports)).toHaveLength(0);
    expect(memory.state!.performanceReviews[id].reportId).toBe("");
    const report = await call("manager", "/performance/reports", "POST", {
      ...base,
      reviews: [{ id, version: res.body.version }],
    });
    let view = (await call("admin", "/performance/reviews?scope=team")).body;
    const corrected = await call(
      "admin",
      `/performance/reviews/${id}/manager`,
      "POST",
      { version: view.items[0].version, submit: true, assessment, reason },
    );
    expect(corrected.status).toBe(200);
    view = (await call("admin", "/performance/reviews?scope=team")).body;
    expect(
      (
        await call(
          "admin",
          `/performance/reports/${report.body.id}/return`,
          "POST",
          { version: view.reports[0].version, reason },
        )
      ).status,
    ).toBe(200);
    view = (await call("manager", "/performance/reviews?scope=team")).body;
    expect(view.items[0].actions).toContain("manager");
    expect(
      (
        await call("manager", `/performance/reviews/${id}/manager`, "POST", {
          version: view.items[0].version,
          submit: true,
          assessment,
          reason,
        })
      ).status,
    ).toBe(200);
  });
  it("commits multi-employee reports together and allows only one concurrent decision", async () => {
    const first = await completedByManager();
    let second = await call("manager", "/performance/reviews", "POST", {
      ...setup,
      employeeId: "second-employee",
    });
    // No record is created for an unknown target.
    expect(second.status).toBe(403);
    memory.state!.employees["second-employee"] = {
      ...memory.state!.employees.employee,
      id: "second-employee",
      uid: "",
      employeeCode: "HS-TEST-2",
      name: "Second employee",
    };
    second = await call("manager", "/performance/reviews", "POST", {
      ...setup,
      employeeId: "second-employee",
    });
    expect(second.status).toBe(200);
    const id = second.body.id;
    second = await call(
      "manager",
      `/performance/reviews/${id}/launch`,
      "POST",
      { version: second.body.version, reason },
    );
    second = await call(
      "manager",
      `/performance/reviews/${id}/manager`,
      "POST",
      { version: second.body.version, submit: true, assessment },
    );
    expect(second.status).toBe(200);
    const report = await call("manager", "/performance/reports", "POST", {
      title: "Team performance report",
      reviewerId: "admin",
      reason,
      reviews: [
        { id: first.body.id, version: first.body.version },
        { id, version: second.body.version },
      ],
    });
    expect(report.status).toBe(200);
    const decisions = await Promise.all(
      ["finalize", "return"].map((action) =>
        call(
          "admin",
          `/performance/reports/${report.body.id}/${action}`,
          "POST",
          { version: report.body.version, reason },
        ),
      ),
    );
    expect(decisions.map((r) => r.status).sort()).toEqual([200, 409]);
    const state = memory.state!,
      result = state.performanceReports[report.body.id];
    const expected =
      result.status === "finalized" ? "completed" : "report_revision";
    expect([
      state.performanceReviews[id].status,
      state.performanceReviews[first.body.id].status,
    ]).toEqual([expected, expected]);
  });
  it("keeps drafts private and fails closed after a target is promoted", async () => {
    let res = await call("hr", "/performance/reviews", "POST", setup);
    const id = res.body.id;
    res = await call("hr", `/performance/reviews/${id}/launch`, "POST", {
      version: res.body.version,
      reason,
    });
    res = await call("hr", `/performance/reviews/${id}/manager`, "POST", {
      version: res.body.version,
      submit: false,
      assessment: { ...assessment, strengths: "" },
    });
    expect(res.status).toBe(200);
    expect(
      (await call("employee", "/performance/reviews?scope=my")).body.items[0]
        .managerAssessment,
    ).toBeNull();
    memory.state!.memberships["test-employee"].role = "Admin";
    expect(
      (await call("hr", "/performance/reviews?scope=team")).body.items,
    ).toHaveLength(0);
    expect(
      (
        await call("hr", `/performance/reviews/${id}/cancel`, "POST", {
          version: res.body.version,
          reason,
        })
      ).status,
    ).toBe(404);
  });
});

import { businessDate } from "../src/utils/time";
describe("protected compensation API and hiring packages", () => {
  const salary = () => ({
    currency: "VND",
    basis: "gross_monthly",
    baseSalary: 23_456_789,
    probationSalary: 20_000_000,
    allowances: [
      { id: "meal", kind: "meal", name: "Ăn trưa", amount: 700_000 },
    ],
    benefits: [
      {
        id: "health",
        kind: "health",
        name: "Bảo hiểm sức khỏe",
        detail: "Theo gói công ty",
      },
    ],
    bonusPolicy: "Xét thưởng định kỳ",
  });
  const date = (offset = 0) => {
    const d = new Date(businessDate());
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const input = (employeeId = "employee", offset = 0) => ({
    employeeId,
    effectiveDate: date(offset),
    package: salary(),
    reason: "Confidential salary reason",
    version: 0,
  });
  async function draft(employeeId = "employee", offset = 0) {
    const result = await call(
      "hr",
      "/compensation/records",
      "POST",
      input(employeeId, offset),
    );
    expect(result.status).toBe(200);
    return result.body;
  }
  async function publish(record: { id: string; version: number }) {
    const result = await call(
      "hr",
      `/compensation/records/${record.id}/publish`,
      "POST",
      { version: record.version, reason: "Đã kiểm tra và xác nhận" },
    );
    expect(result.status).toBe(200);
    return result.body;
  }
  it("keeps drafts private and exposes published personal pay only to permitted viewers", async () => {
    const r = await draft();
    expect(
      (await call("employee", "/compensation?scope=my")).body.people[0].records,
    ).toHaveLength(0);
    expect(
      (await call("manager", "/compensation?scope=team&employeeId=employee"))
        .body.people[0].records,
    ).toHaveLength(0);
    await publish(r);
    const own = await call("employee", "/compensation?scope=my");
    expect(own.body.people[0].records[0].package.baseSalary).toBe(23_456_789);
    const team = await call(
      "manager",
      "/compensation?scope=team&employeeId=employee",
    );
    expect(team.body.people[0].records[0]).toMatchObject({
      canEdit: false,
      canCancel: false,
      canPublish: false,
    });
    expect(
      (await call("manager", "/compensation?scope=team&employeeId=outsider"))
        .status,
    ).toBe(404);
    expect(
      (await call("employee", "/compensation?scope=my&employeeId=outsider"))
        .status,
    ).toBe(404);
    expect((await call("employee", "/compensation?scope=team")).status).toBe(
      403,
    );
    expect(
      (await call("outsider", "/compensation?scope=my")).body.people[0].records,
    ).toHaveLength(0);
  });
  it("blocks manager writes, HR peer/superior writes and personal changes before salary queries", async () => {
    for (const [role, target] of [
      ["manager", "employee"],
      ["hr", "admin"],
      ["hr", "manager"],
      ["hr", "hr"],
      ["admin", "admin"],
    ]) {
      memory.plans = [];
      expect(
        (await call(role, "/compensation/records", "POST", input(target)))
          .status,
      ).toBe(403);
      expect(memory.plans.some((p) => p.compensationRecords)).toBe(false);
    }
    const r = await draft();
    expect(
      (
        await call("manager", `/compensation/records/${r.id}/publish`, "POST", {
          version: r.version,
          reason: "Unauthorized action",
        })
      ).status,
    ).toBe(403);
    expect(memory.state!.compensationRecords[r.id].status).toBe("draft");
  });
  it("reads compensation by allowed employee IDs and avoids unrelated scans", async () => {
    await publish(await draft());
    await publish(await draft("outsider"));
    memory.plans = [];
    const result = await call("manager", "/compensation?scope=team");
    expect(result.status).toBe(200);
    expect(result.body.people.map((p: { id: string }) => p.id)).toEqual([
      "employee",
    ]);
    const plans = memory.plans
      .filter((p) => p.compensationRecords)
      .map((p) => p.compensationRecords);
    expect(plans).toEqual([
      { any: [{ field: "employeeId", op: "in", value: ["employee"] }] },
    ]);
    expect(
      memory.plans.some(
        (p) => p.auditLogs || p.attendanceRecords || p.recruitmentJobs,
      ),
    ).toBe(false);
    memory.plans = [];
    await call("manager", "/compensation?scope=team&employeeId=outsider");
    expect(memory.plans.some((p) => p.compensationRecords)).toBe(false);
  });
  it("preserves published history, rejects stale updates and handles future cancellations", async () => {
    const first = await publish(await draft());
    const future = await publish(await draft("employee", 5));
    const cancel = await call(
      "hr",
      `/compensation/records/${future.id}/cancel`,
      "POST",
      { version: future.version, reason: "Kế hoạch mới" },
    );
    expect(cancel.status).toBe(200);
    expect(
      (
        await call("employee", "/compensation?scope=my")
      ).body.people[0].records.map((r: { id: string }) => r.id),
    ).toEqual([first.id]);
    expect(
      (
        await call("hr", `/compensation/records/${first.id}`, "PATCH", {
          ...input(),
          version: first.version,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await call("hr", `/compensation/records/${first.id}/cancel`, "POST", {
          version: first.version,
          reason: "Try to delete history",
        })
      ).status,
    ).toBe(409);
    const d = await draft("employee", 10);
    expect(
      (
        await call("hr", `/compensation/records/${d.id}`, "PATCH", {
          ...input("employee", 10),
          version: 0,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await call("hr", `/compensation/records/${d.id}`, "PATCH", {
          ...input("outsider", 10),
          version: d.version,
        })
      ).status,
    ).toBe(400);
  });
  it("serializes duplicate publication and makes request retries idempotent", async () => {
    const key = crypto.randomUUID();
    const body = input();
    const first = await call("hr", "/compensation/records", "POST", body, key);
    expect(first.status).toBe(200);
    expect(
      (await call("hr", "/compensation/records", "POST", body, key)).body.id,
    ).toBe(first.body.id);
    expect(Object.keys(memory.state!.compensationRecords)).toHaveLength(1);
    const second = await draft();
    const responses = await Promise.all(
      [first.body, second].map((r) =>
        call("hr", `/compensation/records/${r.id}/publish`, "POST", {
          version: r.version,
          reason: "Confirm plan",
        }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    memory.state!.memberships["test-employee"].role = "Director";
    expect(
      (await call("hr", "/compensation/records", "POST", body, key)).status,
    ).toBe(403);
  });
  it("never exposes salary values through employee profiles, reports or generic audit", async () => {
    await publish(await draft());
    for (const path of [
      "/employees/employee",
      "/employees/employee/history",
      "/employees",
      "/reports/employees",
      "/organization/tree",
      "/audit-logs?search=compensation",
    ]) {
      const response = await call("admin", path);
      expect(response.status).toBe(200);
      expect(JSON.stringify(response.body)).not.toContain("23456789");
      expect(JSON.stringify(response.body)).not.toContain(
        "Confidential salary reason",
      );
    }
  });
  it("rejects invalid money, dates and injected salary fields without writing records", async () => {
    for (const body of [
      { ...input(), package: { ...salary(), baseSalary: -1 } },
      { ...input(), package: { ...salary(), probationSalary: 30_000_000 } },
      { ...input(), effectiveDate: "2026-02-31" },
      { ...input(), status: "published" },
      { ...input(), package: { ...salary(), currency: "USD" } },
    ])
      expect(
        (await call("hr", "/compensation/records", "POST", body)).status,
      ).toBe(400);
    expect(Object.keys(memory.state!.compensationRecords)).toHaveLength(0);
  });
  it("creates the salary package atomically when hiring, including retries and failed validation", async () => {
    const rewards = {
      mode: "range",
      currency: "VND",
      min: 20_000_000,
      max: 30_000_000,
      benefits: salary().benefits,
    };
    const job = await call("hr", "/recruitment/jobs", "POST", {
      title: "Developer",
      departmentId: "a",
      hiringManagerId: "manager",
      description: "Synthetic role",
      openings: 1,
      stages: defaultRecruitmentStages,
      rewards,
      version: 0,
    });
    expect(job.status).toBe(200);
    expect(
      (await call("manager", "/recruitment/jobs")).body.items[0].rewards,
    ).toEqual(rewards);
    const candidate = await call("hr", "/recruitment/candidates", "POST", {
      jobId: job.body.id,
      name: "Ứng viên kiểm thử",
      email: "compensation-hire@example.test",
      phone: "0900000000",
      education: "Cử nhân CNTT",
      experience: "Hai năm",
      skills: "TypeScript",
      source: "sample",
    });
    expect(candidate.status).toBe(200);
    const body = {
      version: candidate.body.version,
      reason: "Xác nhận lương và nhận việc",
      positionId: "dev",
      hireDate: date(1),
      workEmail: candidate.body.email,
      employmentStatus: "probation",
      compensation: salary(),
    };
    const path = `/recruitment/candidates/${candidate.body.id}/direct-hire`,
      key = crypto.randomUUID();
    const before = Object.keys(memory.state!.employees).length;
    expect(
      (
        await call("hr", path, "POST", {
          ...body,
          compensation: { ...salary(), baseSalary: -1 },
        })
      ).status,
    ).toBe(400);
    expect(Object.keys(memory.state!.employees)).toHaveLength(before);
    const hired = await call("hr", path, "POST", body, key);
    expect(hired.status).toBe(200);
    const records = Object.values(memory.state!.compensationRecords);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      employeeId: hired.body.employeeId,
      sourceCandidateId: candidate.body.id,
      status: "published",
      effectiveDate: date(1),
      package: salary(),
    });
    expect((await call("hr", path, "POST", body, key)).status).toBe(200);
    expect(Object.keys(memory.state!.compensationRecords)).toHaveLength(1);
    expect(Object.keys(memory.state!.employees)).toHaveLength(before + 1);
    expect(
      JSON.stringify(
        (await call("manager", `/recruitment/jobs/${job.body.id}/candidates`))
          .body,
      ),
    ).not.toContain("23456789");
  });
});

describe("Admin salary band and request expansion", () => {
  const band = (version = 0, baseSalary = 30_000_000) => ({
    version,
    reason: "Band quản trị doanh nghiệp",
    package: {
      currency: "VND" as const,
      basis: "gross_monthly" as const,
      baseSalary,
      probationSalary: null,
      allowances: [],
      benefits: [],
      bonusPolicy: "",
    },
  });
  it("rejects other roles before reading pay and never exposes the band to them", async () => {
    for (const role of ["hr", "manager", "employee"]) {
      memory.plans = [];
      expect((await call(role, "/compensation/admin-band")).status).toBe(403);
      expect(
        (await call(role, "/compensation/admin-band", "POST", band())).status,
      ).toBe(403);
      expect(
        memory.plans.some(
          (plan) => plan.compensationBands || plan.compensationRecords,
        ),
      ).toBe(false);
    }
    await call("admin", "/compensation/admin-band", "POST", band());
    for (const role of ["hr", "manager", "employee"])
      expect(
        (await call(role, "/compensation?scope=my")).body.adminBand,
      ).toBeUndefined();
  });
  it("prefills existing pay and applies a shared band with immutable history and version checks", async () => {
    const s = memory.state!;
    s.compensationRecords.legacy = {
      ...band(),
      id: "legacy",
      employeeId: "admin",
      effectiveDate: "2026-01-01",
      version: 1,
      status: "published",
      history: [],
      sourceCandidateId: "",
    };
    expect(
      (await call("admin", "/compensation/admin-band")).body.existingPackage
        .baseSalary,
    ).toBe(30_000_000);
    s.employees.admin2 = {
      ...s.employees.admin,
      id: "admin2",
      email: "admin2@example.test",
    };
    s.memberships["test-admin2"] = {
      ...s.memberships["test-admin"],
      id: "test-admin2",
      employeeId: "admin2",
    };
    expect(
      (await call("admin", "/compensation/admin-band", "POST", band())).status,
    ).toBe(200);
    expect(
      (await call("admin2", "/compensation?scope=my")).body.adminBand.package
        .baseSalary,
    ).toBe(30_000_000);
    expect(
      (await call("admin", "/compensation/admin-band", "POST", band())).status,
    ).toBe(409);
    expect(
      (
        await call(
          "admin2",
          "/compensation/admin-band",
          "POST",
          band(1, 32_000_000),
        )
      ).status,
    ).toBe(200);
    const result = (await call("admin", "/compensation/admin-band")).body;
    expect(result.history.map((v: { version: number }) => v.version)).toEqual([
      2, 1,
    ]);
    expect(result.history[1].package.baseSalary).toBe(30_000_000);
    expect(result.band.package.baseSalary).toBe(32_000_000);
    expect(JSON.stringify(Object.values(s.auditLogs))).not.toContain(
      "30000000",
    );
  });
  it("replays idempotently, validates pay and reauthorizes after demotion", async () => {
    const key = crypto.randomUUID();
    expect(
      (await call("admin", "/compensation/admin-band", "POST", band(), key))
        .status,
    ).toBe(200);
    expect(
      (await call("admin", "/compensation/admin-band", "POST", band(), key))
        .body.version,
    ).toBe(1);
    expect(Object.keys(memory.state!.compensationBands)).toHaveLength(2);
    expect(
      (await call("admin", "/compensation/admin-band", "POST", band(1, -1)))
        .status,
    ).toBe(400);
    memory.state!.memberships["test-admin"].role = "HR";
    expect(
      (await call("admin", "/compensation/admin-band", "POST", band(), key))
        .status,
    ).toBe(403);
  });
  const request = (kind: string) => ({
    kind,
    title: "Đề nghị hỗ trợ công việc",
    reason: "Phục vụ công việc của phòng ban",
    startDate: futureWorkDate(),
    endDate: futureWorkDate(),
    resource: "Thiết bị hoặc chương trình",
    amount: kind === "expense_reimbursement" ? 500_000 : null,
    reference: "HD-2026-001",
  });
  it.each([
    "equipment",
    "training",
    "expense_reimbursement",
    "benefit_support",
  ])("persists %s and enforces scoped two-step approval", async (kind) => {
    const created = await call(
      "employee",
      "/internal-requests",
      "POST",
      request(kind),
    );
    expect(created.status).toBe(200);
    const path = `/internal-requests/${created.body.id}/approve`;
    for (const reviewer of ["employee", "manager2", "hr"])
      expect(
        (
          await call(reviewer, path, "POST", {
            version: 1,
            reason: "Xác nhận yêu cầu",
          })
        ).status,
      ).toBe(403);
    expect(
      (
        await call("manager", path, "POST", {
          version: 1,
          reason: "Đồng ý đề nghị",
        })
      ).body.status,
    ).toBe("pending_hr");
    const approved = await call("hr", path, "POST", {
      version: 2,
      reason: "Đã kiểm tra và chấp thuận",
    });
    expect(approved.body.status).toBe("approved");
    expect(approved.body.history).toHaveLength(3);
    expect(approved.body.resource).toBe(request(kind).resource);
    expect(Object.keys(memory.state!.compensationRecords)).toHaveLength(0);
  });
  it("requires receipts and amounts, validates quantities and allows withdrawal", async () => {
    for (const patch of [
      { amount: 0 },
      { amount: -100 },
      { amount: 1.5 },
      { reference: "" },
    ])
      expect(
        (
          await call("employee", "/internal-requests", "POST", {
            ...request("expense_reimbursement"),
            ...patch,
          })
        ).status,
      ).toBe(400);
    expect(
      (
        await call("employee", "/internal-requests", "POST", {
          ...request("equipment"),
          quantity: 0,
        })
      ).status,
    ).toBe(400);
    const created = await call(
      "employee",
      "/internal-requests",
      "POST",
      request("training"),
    );
    expect(created.status).toBe(200);
    expect(
      (
        await call(
          "employee",
          "/internal-requests",
          "POST",
          request("training"),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          "employee",
          `/internal-requests/${created.body.id}/cancel`,
          "POST",
          { version: 1, reason: "Chưa cần tham gia đợt này" },
        )
      ).body.status,
    ).toBe("cancelled");
  });
});

describe("employee services over scoped HTTP transactions", () => {
  const asset = (employeeId = "employee", assetCode = "LT-100") => ({
    section: "assets",
    employeeId,
    title: "Laptop công việc",
    assetCode,
    startDate: "2026-01-01",
    notes: "Cấp đủ phụ kiện",
    version: 0,
  });
  const decision = (version: number) => ({
    version,
    reason: "Đã kiểm tra hồ sơ",
  });
  it("assigns once, validates source quantity, and completes receipt and return", async () => {
    memory.state!.internalRequests.req = {
      id: "req",
      employeeId: "employee",
      kind: "equipment",
      status: "approved",
      quantity: 1,
    } as never;
    const key = crypto.randomUUID(),
      body = { ...asset(), sourceRequestId: "req" };
    const first = await call("hr", "/employee-services", "POST", body, key);
    expect(first.status).toBe(200);
    const id = first.body.id;
    expect(
      (await call("hr", "/employee-services", "POST", body, key)).body.id,
    ).toBe(id);
    expect(Object.keys(memory.state!.employeeServices)).toHaveLength(1);
    expect(
      (await call("hr", "/employee-services?section=assets&scope=team")).body
        .requests,
    ).toEqual([]);
    expect(
      (
        await call("hr", "/employee-services", "POST", {
          ...body,
          assetCode: "LT-101",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          "manager",
          `/employee-services/${id}/acknowledge`,
          "POST",
          decision(1),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          "employee",
          `/employee-services/${id}/acknowledge`,
          "POST",
          decision(1),
        )
      ).body.status,
    ).toBe("in_use");
    expect(
      (
        await call(
          "employee",
          `/employee-services/${id}/request-return`,
          "POST",
          decision(2),
        )
      ).body.status,
    ).toBe("return_requested");
    expect(
      (
        await call(
          "hr",
          `/employee-services/${id}/receive-return`,
          "POST",
          decision(2),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          "hr",
          `/employee-services/${id}/receive-return`,
          "POST",
          decision(3),
        )
      ).body.status,
    ).toBe("returned");
    expect(
      memory.plans.every(
        (p) =>
          p.employeeServices !== true &&
          p.internalRequests !== true &&
          !p.auditLogs,
      ),
    ).toBe(true);
  });
  it("filters lists and rejects foreign records, elevated roles and unknown fields", async () => {
    const own = await call("hr", "/employee-services", "POST", asset());
    await call("hr", "/employee-services", "POST", asset("outsider", "LT-200"));
    const list = await call(
      "manager",
      "/employee-services?section=assets&scope=team",
    );
    expect(list.status).toBe(200);
    expect(
      list.body.items.map((r: { employeeId: string }) => r.employeeId),
    ).toEqual(["employee"]);
    expect(list.body.canCreate).toBe(false);
    expect(list.body.people).toEqual([]);
    expect(
      (await call("employee", "/employee-services?section=assets&scope=team"))
        .status,
    ).toBe(403);
    expect(
      (
        await call(
          "manager2",
          `/employee-services/${own.body.id}/receive-return`,
          "POST",
          decision(1),
        )
      ).status,
    ).toBe(404);
    expect(
      (await call("hr", "/employee-services", "POST", asset("admin", "LT-300")))
        .status,
    ).toBe(403);
    expect(
      (
        await call("hr", "/employee-services", "POST", {
          ...asset(),
          status: "returned",
        })
      ).status,
    ).toBe(400);
    expect(
      (await call("employee", "/employee-services", "POST", asset())).status,
    ).toBe(403);
  });
  it("serializes duplicate assignment attempts and invalidates replay after lost scope", async () => {
    const results = await Promise.all([
      call("hr", "/employee-services", "POST", asset()),
      call("hr", "/employee-services", "POST", asset("outsider")),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const input = {
      section: "training",
      employeeId: "employee",
      title: "Dữ liệu an toàn",
      provider: "Learning Center",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
      version: 0,
    };
    const created = await call("hr", "/employee-services", "POST", input),
      id = created.body.id;
    await call(
      "employee",
      `/employee-services/${id}/submit-learning`,
      "POST",
      decision(1),
    );
    const key = crypto.randomUUID();
    expect(
      (
        await call(
          "manager",
          `/employee-services/${id}/accept-learning`,
          "POST",
          decision(2),
          key,
        )
      ).status,
    ).toBe(200);
    memory.state!.employees.employee.departmentId = "b";
    memory.state!.employees.employee.managerId = "manager2";
    expect(
      (
        await call(
          "manager",
          `/employee-services/${id}/accept-learning`,
          "POST",
          decision(2),
          key,
        )
      ).status,
    ).toBe(404);
  });
  it("requires each handover owner, then closes employment, contracts and access atomically", async () => {
    const endDate = new Date().toISOString().slice(0, 10);
    memory.state!.employmentContracts.contract = {
      id: "contract",
      employeeId: "employee",
      startDate: "2026-01-01",
      status: "active",
      version: 1,
      history: [],
    } as never;
    const created = await call("hr", "/employee-services", "POST", {
      section: "offboarding",
      employeeId: "employee",
      title: "Bàn giao nghỉ việc",
      notes: "Kết thúc theo thỏa thuận",
      endDate,
      version: 0,
    });
    expect(created.status).toBe(200);
    const id = created.body.id;
    expect(
      (
        await call(
          "hr",
          `/employee-services/${id}/complete`,
          "POST",
          decision(1),
        )
      ).status,
    ).toBe(409);
    let version = 1;
    for (const task of created.body.tasks) {
      const taskInput = {
        version,
        taskId: task.id,
        done: true,
        reason: "Bàn giao đã hoàn tất",
      };
      expect(
        (
          await call(
            "manager2",
            `/employee-services/${id}/task`,
            "POST",
            taskInput,
          )
        ).status,
      ).toBe(404);
      const result = await call(
        task.owner,
        `/employee-services/${id}/task`,
        "POST",
        taskInput,
      );
      expect(result.status).toBe(200);
      version = result.body.version;
    }
    const key = crypto.randomUUID();
    expect(
      (
        await call(
          "hr",
          `/employee-services/${id}/complete`,
          "POST",
          decision(version),
          key,
        )
      ).status,
    ).toBe(200);
    expect(memory.state!.employees.employee.status).toBe("terminated");
    expect(memory.state!.memberships["test-employee"].active).toBe(false);
    expect(memory.state!.employmentContracts.contract.status).toBe("ended");
    expect(
      (
        await call(
          "employee",
          "/employee-services?section=offboarding&scope=my",
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          "hr",
          `/employee-services/${id}/complete`,
          "POST",
          decision(version),
          key,
        )
      ).status,
    ).toBe(200);
  });
});

it("rechecks current task ownership when replaying handover confirmation", async () => {
  const created = await call("hr", "/employee-services", "POST", {
    section: "offboarding",
    employeeId: "employee",
    title: "Bàn giao nghỉ việc",
    notes: "Theo thỏa thuận",
    endDate: new Date().toISOString().slice(0, 10),
    version: 0,
  });
  const task = created.body.tasks.find(
      (t: { owner: string }) => t.owner === "manager",
    ),
    key = crypto.randomUUID();
  const body = {
    taskId: task.id,
    done: true,
    reason: "Đã kiểm tra bàn giao",
    version: 1,
  };
  const path = `/employee-services/${created.body.id}/task`;
  expect((await call("manager", path, "POST", body, key)).status).toBe(200);
  memory.state!.employees.employee.managerId = "";
  expect((await call("manager", path, "POST", body, key)).status).toBe(403);
});

describe("employee background API", () => {
  const body = {
    section: "skills",
    version: 0,
    items: ["TypeScript", "Project management"],
  };
  it("persists personal changes, enforces versions and replays idempotently without account changes", async () => {
    const key = crypto.randomUUID(),
      memberships = structuredClone(memory.state!.memberships);
    const saved = await call("employee", "/me/background", "PATCH", body, key);
    expect(saved.status).toBe(200);
    expect(saved.body.background).toMatchObject({
      version: 1,
      skills: body.items,
    });
    expect(
      (await call("employee", "/me/background", "PATCH", body, key)).body,
    ).toEqual(saved.body);
    expect(
      (await call("employee", "/me/background", "PATCH", body)).status,
    ).toBe(409);
    expect(
      (await call("employee", "/employees/employee")).body.background.skills,
    ).toEqual(body.items);
    expect(memory.state!.memberships).toEqual(memberships);
  });
  it("allows HR to update a subordinate using targeted reads, and rejects replay after a target promotion", async () => {
    const key = crypto.randomUUID();
    expect(
      (await call("hr", "/employees/employee/background", "PATCH", body, key))
        .status,
    ).toBe(200);
    expect(
      memory.plans.flatMap((p) => Object.values(p)).every((s) => s !== true),
    ).toBe(true);
    expect(memory.plans.some((p) => p.auditLogs)).toBe(false);
    memory.state!.memberships["test-employee"].role = "Admin";
    expect(
      (await call("hr", "/employees/employee/background", "PATCH", body, key))
        .status,
    ).toBe(403);
  });
  it.each([
    ["hr", "admin", 403],
    ["manager", "employee", 403],
    ["manager", "outsider", 403],
    ["employee", "outsider", 403],
  ])("rejects %s writing %s", async (role, id, status) => {
    expect(
      (await call(String(role), `/employees/${id}/background`, "PATCH", body))
        .status,
    ).toBe(status);
  });
  it("lets managers read only scoped subordinate background", async () => {
    await call("employee", "/me/background", "PATCH", body);
    const ownTeam = await call("manager", "/employees/employee");
    expect(ownTeam.status).toBe(200);
    expect(ownTeam.body.background.skills).toEqual(body.items);
    expect(ownTeam.body.canEditBackground).toBe(false);
    expect((await call("manager2", "/employees/employee")).status).toBe(404);
  });
  it("rejects mass assignment and preserves background when status changes", async () => {
    expect(
      (
        await call("employee", "/me/background", "PATCH", {
          ...body,
          status: "terminated",
        })
      ).status,
    ).toBe(400);
    await call("employee", "/me/background", "PATCH", body);
    const changed = await call("hr", "/employees/employee/status", "PATCH", {
      status: "probation",
    });
    expect(changed.status).toBe(200);
    expect(changed.body.background.skills).toEqual(body.items);
    expect(memory.state!.memberships["test-employee"].active).toBe(true);
  });
});

describe("personal background replay identity", () => {
  it("rejects receipts after an account is reassigned to another employee", async () => {
    const key = crypto.randomUUID();
    const body = { section: "skills", version: 0, items: ["Project planning"] };
    expect(
      (await call("employee", "/me/background", "PATCH", body, key)).status,
    ).toBe(200);
    memory.state!.memberships["test-employee"].employeeId = "outsider";
    expect(
      (await call("employee", "/me/background", "PATCH", body, key)).status,
    ).toBe(403);
  });
});
