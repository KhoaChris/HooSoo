import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fixture, actor } from "./fixture";
import {
  registerWork,
  createInternalRequest,
  actOnWorkflow,
} from "../src/modules/workflows/workflows.service";
import { canReview } from "../src/modules/workflows/approval";
import * as recruiting from "../src/modules/recruitment/recruitment.service";
import { defaultRecruitmentStages } from "@hoosoo/shared";
describe("work registration and internal requests", () => {
  beforeEach(() =>
    vi.useFakeTimers().setSystemTime(new Date("2026-11-12T03:00:00Z")),
  );
  afterEach(() => vi.useRealTimers());
  const input = {
    date: "2026-11-13",
    start: "08:00",
    end: "17:00",
    reason: "Đăng ký làm việc tại văn phòng",
    version: 0,
  };
  it("requires manager then a different HR final reviewer and forbids self approval", () => {
    const s = fixture(),
      r = registerWork(s, actor("Employee"), input);
    expect(r.status).toBe("pending_manager");
    expect(canReview(s, actor("HR"), r)).toBe(false);
    expect(() =>
      actOnWorkflow(
        s,
        actor("Employee"),
        "workRegistrations",
        r.id,
        "approve",
        { version: 1, reason: "Tự phê duyệt" },
      ),
    ).toThrow();
    actOnWorkflow(s, actor("Manager"), "workRegistrations", r.id, "approve", {
      version: 1,
      reason: "Đồng ý kế hoạch",
    });
    expect(r.status).toBe("pending_hr");
    expect(() =>
      actOnWorkflow(s, actor("Manager"), "workRegistrations", r.id, "approve", {
        version: 2,
        reason: "Xác nhận cuối",
      }),
    ).toThrow();
    actOnWorkflow(s, actor("HR"), "workRegistrations", r.id, "approve", {
      version: 2,
      reason: "Xác nhận lịch làm việc",
    });
    expect(r.status).toBe("approved");
    expect(() =>
      registerWork(s, actor("Employee"), { ...input, version: 3 }),
    ).toThrow();
  });
  it("routes a request without manager to HR, still no self approval", () => {
    const s = fixture(),
      r = registerWork(s, actor("HR"), input);
    expect(r.status).toBe("pending_hr");
    expect(canReview(s, actor("HR"), r)).toBe(false);
    expect(canReview(s, actor("Admin"), r)).toBe(true);
  });
  it("falls back to HR when the direct manager loses approval access", () => {
    const s = fixture(),
      r = registerWork(s, actor("Employee"), input);
    s.memberships["test-manager"].active = false;
    expect(canReview(s, actor("HR"), r)).toBe(true);
    actOnWorkflow(s, actor("HR"), "workRegistrations", r.id, "approve", {
      version: 1,
      reason: "Không còn quản lý trực tiếp hợp lệ",
    });
    expect(r.status).toBe("approved");
  });
  it("rejects out of policy hours, weekends, duplicate submissions and stale reviews", () => {
    const s = fixture();
    for (const overrides of [
      { start: "07:00" },
      { date: "2026-11-14" },
      { start: "12:00", end: "12:30" },
    ])
      expect(() =>
        registerWork(s, actor("Employee"), { ...input, ...overrides }),
      ).toThrow();
    const r = registerWork(s, actor("Employee"), input);
    expect(() => registerWork(s, actor("Employee"), input)).toThrow();
    expect(() =>
      actOnWorkflow(s, actor("Manager"), "workRegistrations", r.id, "approve", {
        version: 2,
        reason: "Đồng ý kế hoạch",
      }),
    ).toThrow();
    expect(() =>
      actOnWorkflow(
        s,
        actor("Manager", "manager2"),
        "workRegistrations",
        r.id,
        "approve",
        { version: 1, reason: "Đồng ý kế hoạch" },
      ),
    ).toThrow();
  });
  it("applies approved attendance correction atomically with history", () => {
    const s = fixture();
    s.attendanceRecords.employee_2026_11 = {
      id: "employee_2026_11",
      employeeId: "employee",
      date: "2026-11-11",
      checkIn: "2026-11-11T02:00:00Z",
      checkOut: null,
      schedule: s.settings.main.schedule,
      adjustments: [],
    };
    s.attendanceRecords["employee_2026-11-11"] = {
      ...s.attendanceRecords.employee_2026_11,
      id: "employee_2026-11-11",
    };
    const r = createInternalRequest(s, actor("Employee"), {
      kind: "attendance_correction",
      title: "Bổ sung giờ ra",
      reason: "Quên chấm công khi ra về",
      startDate: "2026-11-11",
      endDate: "2026-11-11",
      checkIn: "08:00",
      checkOut: "17:00",
      location: "",
    });
    actOnWorkflow(s, actor("Manager"), "internalRequests", r.id, "approve", {
      version: 1,
      reason: "Xác nhận đã làm việc",
    });
    expect(s.attendanceRecords["employee_2026-11-11"].checkOut).toBeNull();
    actOnWorkflow(s, actor("HR"), "internalRequests", r.id, "approve", {
      version: 2,
      reason: "Đã đối chiếu chấm công",
    });
    expect(s.attendanceRecords["employee_2026-11-11"].checkOut).toBe(
      "2026-11-11T10:00:00.000Z",
    );
    expect(s.attendanceRecords["employee_2026-11-11"].adjustments).toHaveLength(
      1,
    );
  });
  it("does not overwrite an attendance correction made while request was pending", () => {
    const s = fixture(),
      id = "employee_2026-11-11";
    s.attendanceRecords[id] = {
      id,
      employeeId: "employee",
      date: "2026-11-11",
      checkIn: "2026-11-11T02:00:00Z",
      checkOut: null,
      schedule: s.settings.main.schedule,
      adjustments: [],
    };
    const r = createInternalRequest(s, actor("Employee"), {
      kind: "attendance_correction",
      title: "Bổ sung giờ ra",
      reason: "Quên chấm công khi ra về",
      startDate: "2026-11-11",
      endDate: "2026-11-11",
      checkIn: "08:00",
      checkOut: "17:00",
      location: "",
    });
    actOnWorkflow(s, actor("Manager"), "internalRequests", r.id, "approve", {
      version: 1,
      reason: "Xác nhận đã làm việc",
    });
    s.attendanceRecords[id].checkOut = "2026-11-11T09:00:00Z";
    expect(() =>
      actOnWorkflow(s, actor("HR"), "internalRequests", r.id, "approve", {
        version: 2,
        reason: "Đã đối chiếu dữ liệu",
      }),
    ).toThrow();
    expect(r.status).toBe("pending_hr");
  });
});
describe("recruitment", () => {
  beforeEach(() =>
    vi.useFakeTimers().setSystemTime(new Date("2026-11-12T03:00:00Z")),
  );
  afterEach(() => vi.useRealTimers());
  function setup() {
    const s = fixture(),
      a = actor("HR");
    const j = recruiting.saveJob(s, a, {
      title: "Kỹ sư phần mềm",
      departmentId: "a",
      hiringManagerId: "manager",
      description: "Phát triển sản phẩm",
      openings: 1,
      stages: defaultRecruitmentStages,
      active: true,
      version: 0,
    });
    const c = recruiting.createCandidate(s, a, {
      jobId: j.id,
      name: "Ứng viên mẫu",
      email: "candidate@example.test",
      phone: "0900000000",
      address: "",
      education: "Cử nhân CNTT",
      experience: "2 năm phát triển web",
      skills: "TypeScript",
      source: "sample",
      note: "Hồ sơ giả lập",
    });
    return { s, a, j, c };
  }
  it("blocks skipping or advancing a non-passed stage and preserves history", () => {
    const { s, a, j, c } = setup();
    expect(() =>
      recruiting.moveCandidate(s, a, c.id, {
        version: 1,
        stageId: j.stages[1].id,
        reason: "Chuyển vòng kế",
      }),
    ).toThrow();
    recruiting.evaluateCandidate(s, a, c.id, {
      version: 1,
      result: "passed",
      score: 4,
      reason: "Hồ sơ phù hợp yêu cầu",
    });
    expect(() =>
      recruiting.moveCandidate(s, a, c.id, {
        version: 2,
        stageId: j.stages[2].id,
        reason: "Bỏ qua phỏng vấn",
      }),
    ).toThrow();
    recruiting.moveCandidate(s, actor("Manager"), c.id, {
      version: 2,
      stageId: j.stages[1].id,
      reason: "Mời phỏng vấn chuyên môn",
    });
    expect(c.rounds).toHaveLength(2);
    expect(() =>
      recruiting.evaluateCandidate(s, a, c.id, {
        version: 3,
        result: "passed",
        score: 5,
        reason: "Đánh giá khi chưa phỏng vấn",
      }),
    ).toThrow();
  });
  it("requires HR confirmation, rejects interview conflicts and early evaluations", () => {
    const { s, a, j, c } = setup();
    recruiting.evaluateCandidate(s, a, c.id, {
      version: 1,
      result: "passed",
      score: 4,
      reason: "Hồ sơ đáp ứng yêu cầu",
    });
    recruiting.moveCandidate(s, a, c.id, {
      version: 2,
      stageId: j.stages[1].id,
      reason: "Mời tham gia phỏng vấn",
    });
    const i = {
      version: 3,
      date: "2026-11-13",
      start: "10:00",
      end: "11:00",
      interviewerId: "manager",
      location: "Phòng họp A",
    };
    recruiting.scheduleInterview(s, actor("Manager"), c.id, i);
    expect(() =>
      recruiting.confirmInterview(s, actor("Manager"), c.id, {
        version: 4,
        reason: "Tự duyệt lịch phỏng vấn",
      }),
    ).toThrow();
    recruiting.confirmInterview(s, a, c.id, {
      version: 4,
      reason: "Đã thống nhất lịch phỏng vấn",
    });
    expect(c.rounds[1].interview?.status).toBe("confirmed");
    expect(() =>
      recruiting.evaluateCandidate(s, a, c.id, {
        version: 5,
        result: "passed",
        score: 4,
        reason: "Phỏng vấn đạt yêu cầu",
      }),
    ).toThrow();
    vi.setSystemTime(new Date("2026-11-13T05:00:00Z"));
    recruiting.evaluateCandidate(s, actor("Manager"), c.id, {
      version: 5,
      result: "passed",
      score: 4,
      reason: "Phỏng vấn đạt yêu cầu",
    });
    expect(c.rounds[1].result).toBe("passed");
  });
  it("protects reached stages and scope, direct hiring is HR-only and headcount capped", () => {
    const { s, a, j, c } = setup();
    expect(() => recruiting.candidateFor(s, actor("Employee"), c.id)).toThrow();
    expect(() =>
      recruiting.candidateFor(s, actor("Manager", "manager2"), c.id),
    ).toThrow();
    expect(() =>
      recruiting.saveJob(
        s,
        a,
        {
          ...j,
          stages: [{ ...j.stages[0], id: "changed" }, ...j.stages.slice(1)],
        },
        j.id,
      ),
    ).toThrow();
    expect(() =>
      recruiting.decideCandidate(s, actor("Manager"), c.id, "direct-hire", {
        version: 1,
        reason: "Tuyển thẳng vị trí",
      }),
    ).toThrow();
    recruiting.decideCandidate(s, a, c.id, "direct-hire", {
      version: 1,
      reason: "Đã đánh giá từ chương trình thực tập",
    });
    expect(c.status).toBe("hired");
    const c2 = recruiting.createCandidate(s, a, {
      ...c,
      email: "second@example.test",
    });
    expect(() =>
      recruiting.decideCandidate(s, a, c2.id, "direct-hire", {
        version: 1,
        reason: "Tuyển thêm ứng viên",
      }),
    ).toThrow();
  });
  it("keeps CV bytes out of candidate records and clears unused replacement chunks", () => {
    const { s, a, c } = setup();
    const pdf = Buffer.concat([
      Buffer.from("%PDF-1.7\n"),
      Buffer.alloc(300000, 32),
    ]);
    recruiting.saveCV(s, a, c.id, pdf, "candidate.pdf", 1);
    expect(c.cv?.chunks).toBe(2);
    expect(JSON.stringify(c)).not.toContain("JVBER");
    recruiting.saveCV(s, a, c.id, Buffer.from("%PDF-1.7\n%%EOF"), "new.pdf", 2);
    expect(s.candidateFiles[`${c.id}_1`].data).toBe("");
    expect(() =>
      recruiting.saveCV(s, a, c.id, Buffer.from("not-pdf"), "bad.pdf", 3),
    ).toThrow();
  });
});

import { canManageEmployee, actorFor } from "../src/common/authorization";
import { type Role } from "@hoosoo/shared";
describe("hierarchy across management levels", () => {
  it.each<[Role, Role, boolean]>([
    ["Admin", "Director", true],
    ["Admin", "Admin", true],
    ["Director", "Manager", true],
    ["Director", "HR", true],
    ["Director", "Admin", false],
    ["HR", "Manager", false],
    ["HR", "HR", false],
    ["HR", "DeputyManager", true],
    ["Manager", "Director", false],
    ["Manager", "DeputyManager", true],
    ["DeputyManager", "ProjectManager", true],
    ["ProjectManager", "TeamLead", false],
    ["TeamLead", "Developer", true],
    ["QC", "Developer", false],
  ])("%s managing %s: %s", (role, target, expected) => {
    const s = fixture();
    s.memberships["test-manager"].role = role;
    s.memberships["test-employee"].role = target;
    expect(canManageEmployee(s, actor(role, "manager"), "employee")).toBe(
      expected,
    );
    s.employees.employee.departmentId = "b";
    if (!["Admin", "HR"].includes(role))
      expect(canManageEmployee(s, actor(role, "manager"), "employee")).toBe(
        false,
      );
  });
  it("fails closed for an unknown role or missing account and does not create an unreviewable sole-Admin request", () => {
    const s = fixture();
    s.memberships["test-employee"].role = "Unknown" as Role;
    expect(() => actorFor(s, "test-employee")).toThrow();
    expect(canManageEmployee(s, actor("HR"), "employee")).toBe(false);
    expect(() =>
      registerWork(s, actor("Admin"), {
        date: "2026-12-01",
        start: "08:00",
        end: "17:00",
        reason: "Lịch không có người duyệt",
        version: 0,
      }),
    ).toThrow();
  });
});
