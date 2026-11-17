import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  serviceSetupSchema,
  serviceActionSchema,
  queryAffected,
  mutationCollections,
  type ServiceSetup,
  type ServiceRecord,
} from "@hoosoo/shared";
import { fixture, actor, fields } from "./fixture";
import {
  saveService,
  actService,
  serviceView,
  serviceVisible,
  serviceBlockers,
  addServiceTask,
  updateServiceTask,
  authorizeServiceReplay,
} from "../src/modules/employee-services/employee-services.service";
import { saveEmployee } from "../src/modules/employees/employees.service";
const setup = (patch: Record<string, unknown> = {}) =>
  serviceSetupSchema.parse({
    section: "assets",
    employeeId: "employee",
    title: "Laptop công việc",
    assetCode: "lt-100",
    startDate: "2026-11-01",
    endDate: "",
    notes: "Đủ phụ kiện",
    version: 0,
    ...patch,
  });
const input = (r: ServiceRecord) => ({
  version: r.version,
  reason: "Đã kiểm tra và xác nhận",
  documentUrl: "",
});
const training = () =>
  serviceSetupSchema.parse({
    section: "training",
    employeeId: "employee",
    title: "An toàn dữ liệu",
    provider: "Trung tâm đào tạo",
    startDate: "2026-11-01",
    endDate: "2026-11-10",
    notes: "Hoàn thành bài tập",
    version: 0,
  });
const offboard = (employeeId = "employee") =>
  serviceSetupSchema.parse({
    section: "offboarding",
    employeeId,
    title: "Bàn giao công việc",
    notes: "Kết thúc theo thỏa thuận",
    endDate: "2026-11-15",
    version: 0,
  });
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-15T08:00:00Z"));
});
afterEach(() => vi.useRealTimers());
describe("employee services policy and lifecycle", () => {
  it.each(["2026-02-30", "2026-13-01", "bad"])(
    "rejects invalid dates %s",
    (date) =>
      expect(
        serviceSetupSchema.safeParse({ ...setup(), startDate: date }).success,
      ).toBe(false),
  );
  it("rejects unknown fields, inverted dates and unsafe certificate URLs", () => {
    expect(
      serviceSetupSchema.safeParse({ ...setup(), status: "returned" }).success,
    ).toBe(false);
    expect(
      serviceSetupSchema.safeParse({ ...training(), endDate: "2026-01-01" })
        .success,
    ).toBe(false);
    for (const documentUrl of [
      "javascript:alert(1)",
      "http://example.test/cert",
      "data:text/html,hello",
    ])
      expect(
        serviceActionSchema.safeParse({
          version: 1,
          reason: "Certificate",
          documentUrl,
        }).success,
      ).toBe(false);
    expect(
      serviceActionSchema.safeParse({
        version: 1,
        reason: "Certificate",
        documentUrl: "https://example.test/cert",
      }).success,
    ).toBe(true);
  });
  it.each(["Employee", "Manager", "DeputyManager"] as const)(
    "prevents %s from assigning equipment",
    (role) =>
      expect(() => saveService(fixture(), actor(role), setup())).toThrow(),
  );
  it.each(["admin", "hr", "manager"])(
    "prevents HR managing peer or superior %s",
    (employeeId) =>
      expect(() =>
        saveService(fixture(), actor("HR"), setup({ employeeId })),
      ).toThrow(),
  );
  it("keeps managers scoped and owners limited to their own records", () => {
    const s = fixture(),
      r = saveService(s, actor("HR"), setup());
    expect(serviceVisible(s, actor("Employee"), r)).toBe(true);
    expect(serviceVisible(s, actor("Manager"), r)).toBe(true);
    expect(serviceVisible(s, actor("Manager", "manager2"), r)).toBe(false);
    expect(serviceVisible(s, actor("Employee", "outsider"), r)).toBe(false);
    expect(() =>
      actService(s, actor("Manager"), r.id, "acknowledge", input(r)),
    ).toThrow();
  });
  it("enforces receipt, return request and HR confirmation in order", () => {
    const s = fixture(),
      r = saveService(s, actor("HR"), setup());
    expect(r.assetCode).toBe("LT-100");
    expect(() =>
      actService(s, actor("HR"), r.id, "receive-return", input(r)),
    ).toThrow();
    actService(s, actor("Employee"), r.id, "acknowledge", input(r));
    expect(r.status).toBe("in_use");
    actService(s, actor("Employee"), r.id, "request-return", input(r));
    expect(() =>
      actService(s, actor("Manager"), r.id, "receive-return", input(r)),
    ).toThrow();
    actService(s, actor("HR"), r.id, "receive-return", input(r));
    expect(r.status).toBe("returned");
    expect(serviceView(s, actor("HR"), r).actions).toEqual([]);
  });
  it("prevents duplicate active asset codes but allows reissue after return", () => {
    const s = fixture(),
      r = saveService(s, actor("HR"), setup());
    expect(() =>
      saveService(s, actor("HR"), setup({ employeeId: "outsider" })),
    ).toThrow();
    actService(s, actor("Employee"), r.id, "acknowledge", input(r));
    actService(s, actor("HR"), r.id, "receive-return", input(r));
    expect(
      saveService(s, actor("HR"), setup({ employeeId: "outsider" })).employeeId,
    ).toBe("outsider");
  });
  it("cannot edit an acknowledged asset or silently replace a record owner", () => {
    const s = fixture(),
      r = saveService(s, actor("HR"), setup());
    expect(() =>
      saveService(
        s,
        actor("HR"),
        setup({ employeeId: "outsider", version: r.version }),
        r.id,
      ),
    ).toThrow();
    expect(() =>
      saveService(
        s,
        actor("HR"),
        setup({ assetCode: "new-id", version: r.version }),
        r.id,
      ),
    ).toThrow();
    actService(s, actor("Employee"), r.id, "acknowledge", input(r));
    expect(() =>
      saveService(s, actor("HR"), setup({ version: r.version }), r.id),
    ).toThrow();
  });
  it("rejects stale commands and rechecks access for replay", () => {
    const s = fixture(),
      r = saveService(s, actor("HR"), setup());
    expect(() =>
      actService(s, actor("Employee"), r.id, "acknowledge", {
        ...input(r),
        version: 99,
      }),
    ).toThrow();
    expect(() =>
      authorizeServiceReplay(
        s,
        actor("Manager", "manager2"),
        `/employee-services/${r.id}/receive-return`,
        r,
      ),
    ).toThrow();
    s.employees.employee.departmentId = "b";
    s.employees.employee.managerId = "manager2";
    expect(() =>
      authorizeServiceReplay(
        s,
        actor("Manager"),
        `/employee-services/${r.id}/accept-learning`,
        r,
      ),
    ).toThrow();
  });
  it("requires an approved matching request and respects quantity", () => {
    const s = fixture();
    s.internalRequests.req = {
      id: "req",
      employeeId: "employee",
      kind: "equipment",
      status: "approved",
      quantity: 1,
    } as never;
    const first = saveService(
      s,
      actor("HR"),
      setup({ sourceRequestId: "req" }),
    );
    expect(() =>
      saveService(
        s,
        actor("HR"),
        setup({ assetCode: "LT-200", sourceRequestId: "req" }),
      ),
    ).toThrow();
    actService(s, actor("HR"), first.id, "cancel", input(first));
    expect(
      saveService(
        s,
        actor("HR"),
        setup({ assetCode: "LT-200", sourceRequestId: "req" }),
      ),
    ).toBeTruthy();
    s.internalRequests.req.status = "rejected";
    expect(() =>
      saveService(
        s,
        actor("HR"),
        setup({ assetCode: "LT-300", sourceRequestId: "req" }),
      ),
    ).toThrow();
  });
  it("rejects a request belonging to another employee or another kind", () => {
    const s = fixture();
    s.internalRequests.req = {
      id: "req",
      employeeId: "outsider",
      kind: "equipment",
      status: "approved",
    } as never;
    expect(() =>
      saveService(s, actor("HR"), setup({ sourceRequestId: "req" })),
    ).toThrow();
    s.internalRequests.req.employeeId = "employee";
    s.internalRequests.req.kind = "training";
    expect(() =>
      saveService(s, actor("HR"), setup({ sourceRequestId: "req" })),
    ).toThrow();
  });
  it("supports learning submission, revision and scoped recognition", () => {
    const s = fixture(),
      r = saveService(s, actor("HR"), training());
    actService(s, actor("Employee"), r.id, "submit-learning", {
      ...input(r),
      reason: "Áp dụng quy trình bảo vệ dữ liệu",
      documentUrl: "https://example.test/certificate",
    });
    expect(() =>
      actService(s, actor("Employee"), r.id, "accept-learning", input(r)),
    ).toThrow();
    expect(() =>
      actService(
        s,
        actor("Manager", "manager2"),
        r.id,
        "accept-learning",
        input(r),
      ),
    ).toThrow();
    actService(s, actor("Manager"), r.id, "revise-learning", input(r));
    expect(r.status).toBe("in_progress");
    actService(s, actor("Employee"), r.id, "submit-learning", input(r));
    actService(s, actor("Manager"), r.id, "accept-learning", input(r));
    expect(r.status).toBe("completed");
    expect(r.history).toHaveLength(5);
  });
  it("does not accept a learning report before the course starts", () => {
    const s = fixture(),
      r = saveService(s, actor("HR"), {
        ...training(),
        startDate: "2026-12-01",
        endDate: "2026-12-02",
      } as ServiceSetup);
    expect(() =>
      actService(s, actor("Employee"), r.id, "submit-learning", input(r)),
    ).toThrow();
  });
  it("only HR can cancel plans and cancelled items cannot advance", () => {
    const s = fixture(),
      r = saveService(s, actor("HR"), training());
    expect(() =>
      actService(s, actor("Manager"), r.id, "cancel", input(r)),
    ).toThrow();
    actService(s, actor("HR"), r.id, "cancel", input(r));
    expect(() =>
      actService(s, actor("Employee"), r.id, "submit-learning", input(r)),
    ).toThrow();
  });
  it("creates a unique handover with task ownership and version checks", () => {
    const s = fixture(),
      r = saveService(s, actor("HR"), offboard());
    expect(() => saveService(s, actor("HR"), offboard())).toThrow();
    const employeeTask = r.tasks.find((t) => t.owner === "employee")!;
    expect(() =>
      updateServiceTask(s, actor("HR"), r.id, {
        version: r.version,
        taskId: employeeTask.id,
        done: true,
        reason: "Đã kiểm tra",
      }),
    ).toThrow();
    updateServiceTask(s, actor("Employee"), r.id, {
      version: r.version,
      taskId: employeeTask.id,
      done: true,
      reason: "Đã bàn giao",
    });
    expect(employeeTask.completedAt).not.toBe("");
    expect(() =>
      addServiceTask(s, actor("Employee"), r.id, {
        version: r.version,
        title: "Bàn giao khóa",
        owner: "employee",
      }),
    ).toThrow();
    addServiceTask(s, actor("HR"), r.id, {
      version: r.version,
      title: "Bàn giao khóa",
      owner: "employee",
    });
    expect(r.tasks).toHaveLength(4);
  });
  it("blocks offboarding until handover, asset return and last day", () => {
    const s = fixture(),
      r = saveService(s, actor("HR"), {
        ...offboard(),
        endDate: "2026-11-20",
      } as ServiceSetup);
    saveService(s, actor("HR"), setup());
    expect(serviceBlockers(s, r)).toHaveLength(3);
    expect(() =>
      actService(s, actor("HR"), r.id, "complete", input(r)),
    ).toThrow();
    expect(s.memberships["test-employee"].active).toBe(true);
  });
  it("terminates employment and access only after all task owners confirm", () => {
    const s = fixture(),
      r = saveService(s, actor("HR"), offboard());
    s.employmentContracts.contract = {
      id: "contract",
      employeeId: "employee",
      status: "active",
      startDate: "2026-01-01",
      endDate: "2027-01-01",
      version: 1,
      history: [],
    } as never;
    for (const task of r.tasks)
      updateServiceTask(
        s,
        actor(
          task.owner === "employee"
            ? "Employee"
            : task.owner === "manager"
              ? "Manager"
              : "HR",
        ),
        r.id,
        {
          version: r.version,
          taskId: task.id,
          done: true,
          reason: "Hoàn tất bàn giao",
        },
      );
    expect(() =>
      actService(s, actor("Manager"), r.id, "complete", input(r)),
    ).toThrow();
    actService(s, actor("HR"), r.id, "complete", input(r));
    expect(r.status).toBe("completed");
    expect(s.employees.employee.status).toBe("terminated");
    expect(s.memberships["test-employee"].active).toBe(false);
    expect(s.employmentContracts.contract.status).toBe("ended");
    expect(s.employmentContracts.contract.endDate).toBe("2026-11-15");
  });
  it("requires reassigning direct reports and protects Admin exits", () => {
    const s = fixture(),
      r = saveService(s, actor("Admin"), offboard("manager"));
    expect(serviceBlockers(s, r)).toContain(
      "Cần điều chuyển nhân viên cấp dưới.",
    );
    expect(() => saveService(s, actor("Admin"), offboard("admin"))).toThrow();
  });
  it("prevents bypassing asset clearance through employee profile editing", () => {
    const s = fixture();
    saveService(s, actor("HR"), setup());
    expect(() =>
      saveEmployee(
        s,
        actor("Admin"),
        { ...fields(s.employees.employee), status: "terminated" },
        "employee",
      ),
    ).toThrow();
  });
  it("invalidates only relevant collections and linked employment data", () => {
    expect(
      queryAffected("/employee-services?section=training&scope=my", [
        "employeeServices",
      ]),
    ).toBe(true);
    expect(
      queryAffected("/employee-services?section=training&scope=my", [
        "chatMessages",
      ]),
    ).toBe(false);
    expect(mutationCollections("/employee-services/record/complete")).toEqual(
      expect.arrayContaining([
        "employeeServices",
        "employees",
        "memberships",
        "employmentContracts",
        "auditLogs",
      ]),
    );
  });
});

it("requires an active self-service account for receipt and learning workflows", () => {
  const s = fixture();
  s.memberships["test-employee"].active = false;
  expect(() => saveService(s, actor("HR"), setup())).toThrow(
    /Cần cấp tài khoản/,
  );
  expect(() => saveService(s, actor("HR"), training())).toThrow(
    /Cần cấp tài khoản/,
  );
});
it("assigns offline handover verification to HR for a profile without an account", () => {
  const s = fixture();
  delete s.employees.employee.uid;
  delete s.memberships["test-employee"];
  const r = saveService(s, actor("HR"), offboard());
  expect(r.tasks[0].owner).toBe("hr");
  expect(() =>
    addServiceTask(s, actor("HR"), r.id, {
      version: r.version,
      title: "Bàn giao khóa",
      owner: "employee",
    }),
  ).toThrow(/tài khoản/);
  for (const task of r.tasks)
    updateServiceTask(
      s,
      actor(task.owner === "manager" ? "Manager" : "HR"),
      r.id,
      {
        version: r.version,
        taskId: task.id,
        done: true,
        reason: "Đã kiểm tra biên bản bàn giao",
      },
    );
  actService(s, actor("HR"), r.id, "complete", input(r));
  expect(s.employees.employee.status).toBe("terminated");
});
