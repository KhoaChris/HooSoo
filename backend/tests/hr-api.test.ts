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
