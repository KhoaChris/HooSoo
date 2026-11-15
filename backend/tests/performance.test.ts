import { describe, it, expect } from "vitest";
import {
  performanceScore,
  performanceQuarter,
  balancePerformanceGoals,
  performanceAssessmentSchema,
  type PerformanceGoal,
  performanceSetupSchema,
  performanceCompetencies,
  performanceSaveSchema,
  queryAffected,
  mutationCollections,
  type PerformanceSetup,
  type PerformanceAssessment,
} from "@hoosoo/shared";
import {
  submitReport,
  decideReport,
} from "../src/modules/performance/performance-reports";
import {
  canEditPerformance,
  canDecideReport,
} from "../src/modules/performance/performance-access";
import { fixture, actor } from "./fixture";
import {
  setupPerformance,
  performanceAction,
  savePerformance,
  performanceView,
  performanceFor,
  authorizePerformanceReplay,
} from "../src/modules/performance/performance.service";
const setup: PerformanceSetup = {
  employeeId: "employee",
  title: "Quý IV / 2026",
  startDate: "2026-10-01",
  endDate: "2026-12-31",
  selfDue: "2027-01-05",
  managerDue: "2027-01-10",
  version: 0,
  goals: [
    {
      id: "delivery",
      title: "Hoàn thành công việc",
      unit: "công việc",
      target: 10,
      weight: 60,
      direction: "higher",
    },
    {
      id: "errors",
      title: "Số lỗi sau nghiệm thu",
      unit: "lỗi",
      target: 2,
      weight: 40,
      direction: "lower",
    },
  ],
};
const assessment: PerformanceAssessment = {
  goals: [
    {
      goalId: "delivery",
      actual: 10,
      evidence: "Mười công việc được nghiệm thu",
    },
    { goalId: "errors", actual: 4, evidence: "Bốn lỗi được ghi nhận" },
  ],
  competencies: performanceCompetencies.map((c) => ({
    criterionId: c.id,
    rating: 4,
    evidence: "Có minh chứng từ công việc",
  })),
  strengths: "Chất lượng đầu ra ổn định",
  improvements: "Cải thiện kiểm thử tự động",
  developmentPlan: "Hoàn tất khóa kiểm thử trong tháng một",
};
const reason = "Đã kiểm tra và xác nhận nội dung";

function ready() {
  const s = fixture();
  s.employees.director = {
    ...s.employees.manager,
    id: "director",
    uid: "test-director",
    name: "Director",
  };
  s.memberships["test-director"] = {
    ...s.memberships["test-manager"],
    id: "test-director",
    employeeId: "director",
    role: "Director",
  };
  const v = setupPerformance(s, actor("Manager"), setup);
  performanceAction(s, actor("Manager"), v.id, "launch", {
    version: v.version,
    reason,
  });
  return { s, id: v.id, r: s.performanceReviews[v.id] };
}
function assessed() {
  const c = ready();
  savePerformance(c.s, actor("Manager"), c.id, "manager", {
    version: c.r.version,
    submit: true,
    assessment,
  });
  return c;
}
function reported() {
  const c = assessed();
  const report = submitReport(c.s, actor("Manager"), {
    title: "Department Q4",
    reviewerId: "director",
    reason,
    reviews: [{ id: c.id, version: c.r.version }],
  });
  return { ...c, report: c.s.performanceReports[report.id] };
}
describe("supervisor-led performance reviews", () => {
  it("validates dates, unique goals and positive weighted targets without self deadline", () => {
    const { selfDue: _, ...newSetup } = setup;
    expect(performanceSetupSchema.safeParse(newSetup).success).toBe(true);
    for (const patch of [
      { endDate: "2026-02-31" },
      { managerDue: "2026-01-01" },
      { goals: [{ ...setup.goals[0], target: 0 }] },
      { goals: [setup.goals[0], setup.goals[0]] },
    ])
      expect(
        performanceSetupSchema.safeParse({ ...setup, ...patch }).success,
      ).toBe(false);
  });
  it("computes bounded KPI scores and rejects repeated criteria", () => {
    expect(performanceScore(setup, assessment)).toBe(80);
    expect(
      performanceScore(setup, {
        ...assessment,
        goals: assessment.goals.map((g) => ({
          ...g,
          actual: g.goalId === "errors" ? 0 : 1000,
        })),
      }),
    ).toBe(94);
    expect(() =>
      performanceScore(setup, {
        ...assessment,
        competencies: assessment.competencies.map((c) => ({
          ...c,
          criterionId: "quality",
        })),
      }),
    ).toThrow();
  });
  it("lets supervisors create reviews only below their rank and inside scope", () => {
    const { s } = ready();
    for (const employeeId of ["admin", "hr", "manager", "manager2", "outsider"])
      expect(() =>
        setupPerformance(s, actor("Manager"), { ...setup, employeeId }),
      ).toThrow();
    expect(() =>
      setupPerformance(s, actor("HR"), { ...setup, employeeId: "admin" }),
    ).toThrow();
    expect(() =>
      setupPerformance(s, actor("Employee"), {
        ...setup,
        employeeId: "manager",
      }),
    ).toThrow();
    expect(() => setupPerformance(s, actor("Manager"), setup)).toThrow();
    expect(
      setupPerformance(s, actor("Director"), {
        ...setup,
        employeeId: "manager",
      }).employeeId,
    ).toBe("manager");
  });
  it("removes self-submission and finalizes directly without HR", () => {
    const { s, id, r } = ready();
    expect(r.status).toBe("manager_review");
    expect(() =>
      savePerformance(s, actor("Employee"), id, "self", {
        version: r.version,
        submit: true,
        assessment,
      }),
    ).toThrow();
    expect(performanceView(s, actor("Employee"), r).actions).not.toContain(
      "self",
    );
    savePerformance(s, actor("Manager"), id, "manager", {
      version: r.version,
      submit: true,
      assessment,
    });
    expect(r.status).toBe("ready");
    expect(
      performanceView(s, actor("Employee"), r).managerAssessment,
    ).toBeNull();
    performanceAction(s, actor("Manager"), id, "finalize", {
      version: r.version,
      reason,
    });
    expect(
      performanceView(s, actor("Employee"), r).managerAssessment?.score,
    ).toBe(80);
    performanceAction(s, actor("Employee"), id, "acknowledge", {
      version: r.version,
      reason,
    });
    expect(r.status).toBe("acknowledged");
  });
  it("keeps unpublished assessments and revision reasons private", () => {
    const { s, id, r } = ready();
    savePerformance(s, actor("Manager"), id, "manager", {
      version: r.version,
      submit: false,
      assessment: { ...assessment, strengths: "" },
    });
    const own = performanceView(s, actor("Employee"), r);
    expect(own.managerAssessment).toBeNull();
    expect(own.revisions).toHaveLength(0);
    expect(
      own.history.some((h) => h.action === "performance_manager_saved"),
    ).toBe(false);
    expect(() =>
      performanceAction(s, actor("Manager"), id, "finalize", {
        version: r.version,
        reason,
      }),
    ).toThrow();
    expect(
      performanceSaveSchema.safeParse({
        version: r.version,
        submit: true,
        assessment: { ...assessment, strengths: "" },
      }).success,
    ).toBe(false);
  });
  it("retains published assessment revisions and requires a change reason", () => {
    const { s, id, r } = assessed();
    performanceAction(s, actor("Manager"), id, "finalize", {
      version: r.version,
      reason,
    });
    expect(() =>
      savePerformance(s, actor("Manager"), id, "manager", {
        version: r.version,
        submit: true,
        assessment,
      }),
    ).toThrow("Nhập lý do");
    savePerformance(s, actor("Manager"), id, "manager", {
      version: r.version,
      submit: true,
      assessment: { ...assessment, strengths: "Updated supporting evidence" },
      reason,
    });
    expect(r.revisions[0].assessment.data.strengths).toBe(assessment.strengths);
    expect(r.status).toBe("ready");
  });
  it("lets directors amend lower-level reviews but prevents downward overwrite", () => {
    const { s, id, r } = assessed();
    savePerformance(s, actor("Director"), id, "manager", {
      version: r.version,
      submit: true,
      assessment,
      reason,
    });
    expect(canEditPerformance(s, actor("Manager"), r)).toBe(false);
    expect(() =>
      savePerformance(s, actor("Manager"), id, "manager", {
        version: r.version,
        submit: true,
        assessment,
        reason,
      }),
    ).toThrow();
  });
  it("restricts team leads to assigned employees", () => {
    const { s } = ready();
    s.memberships["test-manager"].role = "TeamLead";
    s.employees.employee.managerId = "hr";
    expect(() =>
      setupPerformance(s, actor("TeamLead", "manager"), {
        ...setup,
        title: "New review",
      }),
    ).toThrow();
  });
  it("maps legacy pending self reviews to manager review without dropping old evidence", () => {
    const { s, id, r } = ready();
    delete r.evaluatorId;
    r.status = "self_review";
    r.selfAssessment = {
      data: assessment,
      by: "test-employee",
      name: "employee",
      at: new Date().toISOString(),
      submitted: true,
      score: 80,
    };
    expect(performanceView(s, actor("Manager"), r).status).toBe(
      "manager_review",
    );
    savePerformance(s, actor("Manager"), id, "manager", {
      version: r.version,
      submit: true,
      assessment,
    });
    expect(r.selfAssessment?.score).toBe(80);
  });
  it("rejects stale versions and UTF-8 oversized records", () => {
    const { s, id, r } = ready();
    expect(() =>
      savePerformance(s, actor("Manager"), id, "manager", {
        version: 1,
        submit: true,
        assessment,
      }),
    ).toThrow();
    r.history[0].reason = "ế".repeat(240000);
    expect(() =>
      savePerformance(s, actor("Manager"), id, "manager", {
        version: r.version,
        submit: true,
        assessment,
      }),
    ).toThrow("Nội dung đánh giá quá dài");
  });
  it("freezes submitted reports for their assigned superior and protects finality", () => {
    const { s, id, r, report } = reported();
    expect(r.status).toBe("pending_report");
    expect(canEditPerformance(s, actor("Manager"), r)).toBe(false);
    expect(canDecideReport(s, actor("Admin"), report)).toBe(false);
    expect(() =>
      performanceAction(s, actor("Director"), id, "finalize", {
        version: r.version,
        reason,
      }),
    ).toThrow();
    const version = report.version;
    savePerformance(s, actor("Director"), id, "manager", {
      version: r.version,
      submit: true,
      assessment,
      reason,
    });
    expect(report.version).toBe(version + 1);
    expect(() =>
      decideReport(s, actor("Director"), report.id, "finalize", {
        version,
        reason,
      }),
    ).toThrow();
    decideReport(s, actor("Director"), report.id, "finalize", {
      version: report.version,
      reason,
    });
    expect(r.status).toBe("completed");
    expect(r.finalBy).toBe("test-director");
    expect(canEditPerformance(s, actor("Manager"), r)).toBe(false);
    expect(
      performanceView(s, actor("Employee"), r).managerAssessment?.score,
    ).toBe(80);
  });
  it("rejects self, peer, out-of-scope and incomplete batch recipients", () => {
    const { s, id, r } = assessed();
    for (const reviewerId of ["manager", "manager2", "employee", "hr"])
      expect(() =>
        submitReport(s, actor("Manager"), {
          title: "Report",
          reviewerId,
          reason,
          reviews: [{ id, version: r.version }],
        }),
      ).toThrow();
    r.status = "manager_review";
    expect(() =>
      submitReport(s, actor("Manager"), {
        title: "Report",
        reviewerId: "director",
        reason,
        reviews: [{ id, version: r.version }],
      }),
    ).toThrow();
    expect(Object.keys(s.performanceReports)).toHaveLength(0);
  });
  it("returns a report, unlocks author edits, and permits resubmission", () => {
    const { s, id, r, report } = reported();
    savePerformance(s, actor("Director"), id, "manager", {
      version: r.version,
      submit: true,
      assessment,
      reason,
    });
    decideReport(s, actor("Director"), report.id, "return", {
      version: report.version,
      reason,
    });
    expect(r.reportId).toBe("");
    expect(canEditPerformance(s, actor("Manager"), r)).toBe(true);
    savePerformance(s, actor("Manager"), id, "manager", {
      version: r.version,
      submit: true,
      assessment,
      reason,
    });
    expect(() =>
      performanceAction(s, actor("Manager"), id, "finalize", {
        version: r.version,
        reason,
      }),
    ).toThrow();
    expect(() =>
      submitReport(s, actor("Manager"), {
        title: "Bypassed report",
        reviewerId: "admin",
        reason,
        reviews: [{ id, version: r.version }],
      }),
    ).toThrow();
    const next = submitReport(s, actor("Manager"), {
      title: "Revised report",
      reviewerId: "director",
      reason,
      reviews: [{ id, version: r.version }],
    });
    expect(next.id).not.toBe(report.id);
    expect(report.status).toBe("returned");
  });
  it("checks all report entries before mutating any of them", () => {
    const { s, id, r } = assessed();
    const version = r.version;
    expect(() =>
      submitReport(s, actor("Manager"), {
        title: "Report",
        reviewerId: "director",
        reason,
        reviews: [
          { id, version },
          { id: "missing", version: 1 },
        ],
      }),
    ).toThrow();
    expect(r.reportId).toBe("");
    expect(r.version).toBe(version);
    expect(Object.keys(s.performanceReports)).toHaveLength(0);
  });
  it("rechecks recipient hierarchy and target scope after submission", () => {
    const { s, r, report } = reported();
    s.memberships["test-director"].role = "Manager";
    expect(canDecideReport(s, actor("Manager", "director"), report)).toBe(
      false,
    );
    s.memberships["test-director"].role = "Director";
    s.employees[r.employeeId].departmentId = "b";
    expect(() =>
      decideReport(s, actor("Director"), report.id, "finalize", {
        version: report.version,
        reason,
      }),
    ).toThrow();
  });
  it("requires complete corrections before report publication", () => {
    const { s, id, r, report } = reported();
    savePerformance(s, actor("Director"), id, "manager", {
      version: r.version,
      submit: false,
      assessment: { ...assessment, strengths: "" },
      reason,
    });
    expect(() =>
      decideReport(s, actor("Director"), report.id, "finalize", {
        version: report.version,
        reason,
      }),
    ).toThrow("Hoàn tất đánh giá");
  });
  it("rechecks scope on idempotent replay and never lets employee replay self-writing", () => {
    const { s, id, r } = assessed();
    authorizePerformanceReplay(
      s,
      actor("Manager"),
      `/performance/reviews/${id}/manager`,
      r,
    );
    expect(() =>
      authorizePerformanceReplay(
        s,
        actor("Employee"),
        `/performance/reviews/${id}/self`,
        r,
      ),
    ).toThrow();
    s.employees.employee.departmentId = "b";
    expect(() =>
      authorizePerformanceReplay(
        s,
        actor("Manager"),
        `/performance/reviews/${id}/manager`,
        r,
      ),
    ).toThrow();
    expect(() => performanceFor(s, actor("Manager"), id)).toThrow();
  });
  it("invalidates reviews and reports together without unrelated reads", () => {
    expect(mutationCollections("/performance/reports/x/finalize")).toEqual([
      "performanceReviews",
      "performanceReports",
      "auditLogs",
    ]);
    expect(
      queryAffected("/performance/reviews?scope=team", ["performanceReports"]),
    ).toBe(true);
    expect(queryAffected("/departments", ["performanceReviews"])).toBe(false);
    expect(
      queryAffected("/performance/reviews?scope=my", ["chatMessages"]),
    ).toBe(false);
  });
});

const qualitativeGoals: PerformanceGoal[] = balancePerformanceGoals([
  {
    id: "delivery",
    kind: "qualitative",
    title: "Chất lượng bàn giao",
    expectation: "Được nghiệm thu và không có lỗi nghiêm trọng",
    priority: "critical",
    weight: 100,
  },
  {
    id: "teamwork",
    kind: "qualitative",
    title: "Phối hợp đồng nghiệp",
    expectation: "Chia sẻ thông tin và hỗ trợ đúng thời hạn",
    priority: "standard",
    weight: 100,
  },
]);
const qualitativeSetup: PerformanceSetup = {
  ...setup,
  period: { quarter: 4, year: 2026 },
  ...performanceQuarter({ quarter: 4, year: 2026 }),
  goals: qualitativeGoals,
};
const qualitativeAssessment: PerformanceAssessment = {
  ...assessment,
  goals: qualitativeGoals.map((g) => ({
    goalId: g.id,
    actual: null,
    outcome: "meets",
    evidence: "Đã hoàn thành các yêu cầu đã thống nhất",
  })),
  competencies: assessment.competencies.map((c) => ({ ...c, rating: 3 })),
};
describe("quarterly qualitative performance reviews", () => {
  it("validates fixed quarter boundaries, titles and due dates", () => {
    expect(performanceSetupSchema.safeParse(qualitativeSetup).success).toBe(
      true,
    );
    expect(performanceQuarter({ quarter: 1, year: 2028 })).toMatchObject({
      startDate: "2028-01-01",
      endDate: "2028-03-31",
    });
    for (const patch of [
      { period: { quarter: 5, year: 2026 } },
      { period: { quarter: 0, year: 2026 } },
      { period: { quarter: 1, year: 2101 } },
      { period: undefined },
      { title: "anything" },
      { startDate: "2026-11-15" },
      { endDate: "2026-12-30" },
      { managerDue: "2026-12-01" },
    ]) {
      expect(
        performanceSetupSchema.safeParse({ ...qualitativeSetup, ...patch })
          .success,
      ).toBe(false);
    }
  });
  it("allocates weights from priority, including rounding, and rejects forged weights", () => {
    expect(qualitativeGoals.map((g) => g.weight)).toEqual([75, 25]);
    const six = balancePerformanceGoals(
      Array.from({ length: 6 }, (_, i) => ({
        ...qualitativeGoals[1],
        id: `goal-${i}`,
      })),
    );
    expect(six.map((g) => g.weight)).toEqual([17, 17, 17, 17, 16, 16]);
    expect(balancePerformanceGoals([])).toEqual([]);
    expect(
      performanceSetupSchema.safeParse({
        ...qualitativeSetup,
        goals: qualitativeGoals.map((g) => ({ ...g, weight: 50 })),
      }).success,
    ).toBe(false);
    expect(
      performanceSetupSchema.safeParse({ ...qualitativeSetup, goals: [] })
        .success,
    ).toBe(false);
  });
  it("requires a selected outcome and evidence on submission, while retaining partial drafts", () => {
    const unfinished = {
      ...qualitativeAssessment,
      goals: qualitativeAssessment.goals.map((g) => ({
        ...g,
        outcome: undefined,
        evidence: "",
      })),
    };
    expect(
      performanceSaveSchema.safeParse({
        version: 1,
        submit: false,
        assessment: unfinished,
      }).success,
    ).toBe(true);
    expect(
      performanceSaveSchema.safeParse({
        version: 1,
        submit: true,
        assessment: unfinished,
      }).success,
    ).toBe(false);
    expect(
      performanceAssessmentSchema.safeParse({
        ...qualitativeAssessment,
        goals: qualitativeAssessment.goals.map((g) => ({
          ...g,
          outcome: "made_up",
        })),
      }).success,
    ).toBe(false);
    expect(
      performanceAssessmentSchema.safeParse({
        ...qualitativeAssessment,
        goals: qualitativeAssessment.goals.map((g) => ({ ...g, actual: 100 })),
      }).success,
    ).toBe(false);
    expect(performanceScore(qualitativeSetup, qualitativeAssessment)).toBe(60);
    expect(
      performanceScore(qualitativeSetup, {
        ...qualitativeAssessment,
        goals: qualitativeAssessment.goals.map((g, i) => ({
          ...g,
          outcome: i === 0 ? "below" : "outstanding",
        })),
      }),
    ).toBe(46);
  });
  it("rejects numeric bypasses on qualitative goals even when saving a draft", () => {
    const { s } = ready();
    const v = setupPerformance(s, actor("Manager"), {
      ...qualitativeSetup,
      period: { quarter: 3, year: 2026 },
      ...performanceQuarter({ quarter: 3, year: 2026 }),
    });
    const r = s.performanceReviews[v.id];
    performanceAction(s, actor("Manager"), v.id, "launch", {
      version: r.version,
      reason,
    });
    for (const submit of [false, true])
      expect(() =>
        savePerformance(s, actor("Manager"), v.id, "manager", {
          version: r.version,
          submit,
          assessment: {
            ...qualitativeAssessment,
            goals: qualitativeAssessment.goals.map((g) => ({
              ...g,
              actual: 100,
              outcome: undefined,
            })),
          },
        }),
      ).toThrow("Chọn mức đánh giá");
  });
  it("retains outcomes, written evidence and revision history through supervisor reporting", () => {
    const { s } = ready();
    const v = setupPerformance(s, actor("Manager"), {
      ...qualitativeSetup,
      period: { quarter: 3, year: 2026 },
      ...performanceQuarter({ quarter: 3, year: 2026 }),
    });
    const r = s.performanceReviews[v.id];
    performanceAction(s, actor("Manager"), v.id, "launch", {
      version: r.version,
      reason,
    });
    savePerformance(s, actor("Manager"), v.id, "manager", {
      version: r.version,
      submit: true,
      assessment: qualitativeAssessment,
    });
    const report = submitReport(s, actor("Manager"), {
      title: "Quarterly report",
      reviewerId: "director",
      reason,
      reviews: [{ id: r.id, version: r.version }],
    });
    const revised = {
      ...qualitativeAssessment,
      goals: qualitativeAssessment.goals.map((g) => ({
        ...g,
        outcome: "outstanding" as const,
        evidence: "Cấp trên xác nhận kết quả vượt trội",
      })),
    };
    expect(() =>
      savePerformance(s, actor("Manager"), v.id, "manager", {
        version: r.version,
        submit: true,
        assessment: revised,
        reason,
      }),
    ).toThrow();
    savePerformance(s, actor("Director"), v.id, "manager", {
      version: r.version,
      submit: true,
      assessment: revised,
      reason,
    });
    expect(r.revisions.at(-1)?.assessment.data.goals[0].outcome).toBe("meets");
    decideReport(s, actor("Director"), report.id, "finalize", {
      version: s.performanceReports[report.id].version,
      reason,
    });
    expect(r.status).toBe("completed");
    expect(r.managerAssessment?.score).toBe(88);
    expect(
      performanceView(s, actor("Employee"), r).managerAssessment?.data.goals[0],
    ).toMatchObject({
      actual: null,
      outcome: "outstanding",
      evidence: "Cấp trên xác nhận kết quả vượt trội",
    });
  });
});
