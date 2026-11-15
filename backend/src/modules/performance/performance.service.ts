import { randomUUID } from "node:crypto";
import {
  performanceCompetencies,
  performanceAssessmentSchema,
  performanceScore,
  performanceSetupSchema,
  performanceSaveSchema,
  performanceActionSchema,
  type State,
  type Actor,
  type PerformanceReview,
  type PerformanceView,
  type PerformanceSetup,
  type PerformanceAction,
} from "@hoosoo/shared";
import { z } from "zod";
import {
  managesPerformance,
  canEditPerformance,
  canSubmitReport,
  evaluatorId,
  canSeeReport,
  canDecideReport,
} from "./performance-access";
import { event, assertVersion } from "../workflows/approval";
import { assert, notFound } from "../../utils/errors";
import { audit } from "../../common/audit";
export function canSeePerformance(s: State, a: Actor, r: PerformanceReview) {
  return (
    a.employeeId === r.employeeId || managesPerformance(s, a, r.employeeId)
  );
}
export function performanceFor(s: State, a: Actor, id: string) {
  const r = s.performanceReviews[id];
  if (!r || !canSeePerformance(s, a, r)) notFound();
  return r;
}
export function performanceView(
  s: State,
  a: Actor,
  r: PerformanceReview,
): PerformanceView {
  const own = a.employeeId === r.employeeId;
  const edit = canEditPerformance(s, a, r);
  const released = ["completed", "acknowledged"].includes(r.status);
  const actions: PerformanceAction[] = [];
  if (edit && r.status === "draft") actions.push("launch");
  if (edit && !["draft", "cancelled"].includes(r.status))
    actions.push("manager");
  if (
    edit &&
    !r.reportId &&
    !r.requiredReviewerId &&
    ["ready", "hr_review"].includes(r.status) &&
    r.managerAssessment?.submitted
  )
    actions.push("finalize");
  if (own && r.status === "completed") actions.push("acknowledge");
  if (
    edit &&
    !r.reportId &&
    !r.requiredReviewerId &&
    !released &&
    r.status !== "cancelled"
  )
    actions.push("cancel");
  const view = structuredClone(r);
  // Historical self-assessments remain readable; the self-service workflow is retired.
  if (!own && !r.selfAssessment?.submitted) view.selfAssessment = null;
  if (own && !released) {
    view.managerAssessment = null;
    view.finalNote = "";
    view.finalBy = "";
    view.finalAt = "";
    view.history = view.history.filter((h) =>
      ["performance_created", "performance_launch"].includes(h.action),
    );
  }
  view.revisions = view.revisions.filter((x) =>
    own
      ? released && x.assessment.submitted
      : x.assessment.submitted || x.assessment.by === a.uid,
  );
  if (view.status === "self_review") view.status = "manager_review";
  if (view.status === "hr_review") view.status = "ready";
  return {
    ...view,
    employeeName: s.employees[r.employeeId]?.name ?? "",
    employeeCode: s.employees[r.employeeId]?.employeeCode ?? "",
    reviewerName: s.employees[evaluatorId(s, r)]?.name ?? "",
    canEdit: edit && r.status === "draft",
    canReport: canSubmitReport(s, a, r),
    actions,
  };
}
export function changed(
  s: State,
  a: Actor,
  r: PerformanceReview,
  action: string,
  reason: string,
) {
  r.version++;
  r.updatedAt = new Date().toISOString();
  r.history.push(event(s, a, "performance_" + action, reason));
  audit(
    s,
    a,
    "performance." + action,
    r.id,
    { employeeId: r.employeeId, title: r.title, status: r.status },
    reason,
  );
  return performanceView(s, a, r);
}
export function setupPerformance(
  s: State,
  a: Actor,
  input: PerformanceSetup,
  id?: string,
) {
  const b = performanceSetupSchema.parse(input);
  assert(
    managesPerformance(s, a, b.employeeId),
    403,
    "FORBIDDEN",
    "Không có quyền tạo hoặc sửa đánh giá cho nhân viên này.",
  );
  assert(
    s.employees[b.employeeId]?.status !== "terminated",
    409,
    "EMPLOYEE_INACTIVE",
    "Nhân viên đã kết thúc làm việc.",
  );
  const old = id ? performanceFor(s, a, id) : undefined;
  if (old) {
    assertVersion(old, b.version);
    assert(
      canEditPerformance(s, a, old) &&
        old.status === "draft" &&
        old.employeeId === b.employeeId,
      409,
      "REVIEW_LOCKED",
      "Mục tiêu đã được khóa sau khi mở đánh giá.",
    );
    Object.assign(old, b);
    return changed(s, a, old, "updated", "");
  }
  assert(
    b.version === 0,
    409,
    "VERSION_CONFLICT",
    "Phiếu mới phải bắt đầu từ phiên bản 0.",
  );
  assert(
    !Object.values(s.performanceReviews).some(
      (r) =>
        r.employeeId === b.employeeId &&
        r.title.toLocaleLowerCase() === b.title.toLocaleLowerCase() &&
        r.startDate === b.startDate &&
        r.endDate === b.endDate &&
        r.status !== "cancelled",
    ),
    409,
    "DUPLICATE_REVIEW",
    "Nhân viên đã có kỳ đánh giá này.",
  );
  const record: PerformanceReview = {
    ...b,
    id: randomUUID(),
    version: 0,
    createdAt: new Date().toISOString(),
    createdBy: a.uid,
    evaluatorId: a.employeeId,
    reportId: "",
    status: "draft",
    selfAssessment: null,
    managerAssessment: null,
    finalNote: "",
    finalBy: "",
    finalAt: "",
    history: [],
    revisions: [],
  };
  s.performanceReviews[record.id] = record;
  return changed(s, a, record, "created", "");
}
export function savePerformance(
  s: State,
  a: Actor,
  id: string,
  phase: "self" | "manager",
  input: z.input<typeof performanceSaveSchema>,
) {
  const b = performanceSaveSchema.parse(input),
    r = performanceFor(s, a, id);
  assertVersion(r, b.version);
  assert(
    performanceView(s, a, r).actions.includes(phase),
    403,
    "FORBIDDEN",
    "Bạn không được đánh giá ở bước này.",
  );
  assert(
    b.assessment.goals.length === r.goals.length &&
      new Set(b.assessment.goals.map((g) => g.goalId)).size ===
        r.goals.length &&
      r.goals.every((g) => b.assessment.goals.some((v) => v.goalId === g.id)) &&
      new Set(b.assessment.competencies.map((c) => c.criterionId)).size === 4 &&
      performanceCompetencies.every((c) =>
        b.assessment.competencies.some((v) => v.criterionId === c.id),
      ),
    400,
    "INVALID_ASSESSMENT",
    "Kiểm tra đầy đủ mục tiêu, năng lực và minh chứng.",
  );
  assert(
    r.goals.every(
      (goal) =>
        goal.kind !== "qualitative" ||
        b.assessment.goals.find((result) => result.goalId === goal.id)
          ?.actual === null,
    ),
    400,
    "INVALID_ASSESSMENT",
    "Chọn mức đánh giá cho từng mục tiêu.",
  );
  const full = performanceAssessmentSchema.safeParse(b.assessment);
  const score = full.success ? performanceScore(r, full.data) : null;
  assert(
    !r.managerAssessment || b.reason.length >= 5,
    400,
    "REVISION_REASON_REQUIRED",
    "Nhập lý do chỉnh sửa đánh giá.",
  );
  const key = phase === "self" ? "selfAssessment" : "managerAssessment",
    previous = r[key];
  if (previous?.submitted) {
    assert(
      r.revisions.length < 20,
      409,
      "REVISION_LIMIT",
      "Đã đạt giới hạn chỉnh sửa của kỳ đánh giá.",
    );
    r.revisions.push({ phase, assessment: structuredClone(previous) });
  }
  r[key] = {
    data: structuredClone(b.assessment),
    by: a.uid,
    name: s.employees[a.employeeId].name,
    at: new Date().toISOString(),
    submitted: b.submit,
    score,
  };
  r.revisionEditorId = "";
  r.finalNote = "";
  r.finalBy = "";
  r.finalAt = "";
  // Reserve room for workflow history and command receipts.
  assert(
    Buffer.byteLength(JSON.stringify(r), "utf8") <= 700_000,
    413,
    "ASSESSMENT_TOO_LARGE",
    "Nội dung đánh giá quá dài. Rút gọn minh chứng trước khi lưu.",
  );
  if (r.reportId) {
    const report = s.performanceReports[r.reportId];
    report.version++;
    report.updatedAt = new Date().toISOString();
    report.history.push(
      event(s, a, "performance_report_review_updated", b.reason),
    );
    r.status = "pending_report";
  } else
    r.status = r.requiredReviewerId
      ? "report_revision"
      : b.submit
        ? "ready"
        : "manager_review";
  return changed(
    s,
    a,
    r,
    phase + (b.submit ? "_submitted" : "_saved"),
    b.reason,
  );
}
export function performanceAction(
  s: State,
  a: Actor,
  id: string,
  action: PerformanceAction,
  input: z.infer<typeof performanceActionSchema>,
) {
  const b = performanceActionSchema.parse(input),
    r = performanceFor(s, a, id);
  assertVersion(r, b.version);
  assert(
    performanceView(s, a, r).actions.includes(action),
    403,
    "FORBIDDEN",
    "Bạn không được thực hiện bước này.",
  );
  switch (action) {
    case "launch":
      r.status = "manager_review";
      break;
    case "return_self":
      r.status = "manager_review";
      break;
    case "return_manager":
      r.status = "manager_review";
      break;
    case "finalize":
      assert(
        r.managerAssessment?.submitted,
        409,
        "INCOMPLETE_REVIEW",
        "Hoàn tất đánh giá trước khi công bố.",
      );
      r.status = "completed";
      r.finalNote = b.reason;
      r.finalBy = a.uid;
      r.finalAt = new Date().toISOString();
      break;
    case "acknowledge":
      r.status = "acknowledged";
      break;
    case "cancel":
      r.status = "cancelled";
      break;
    default:
      assert(false, 400, "INVALID_ACTION", "Thao tác không hợp lệ.");
  }
  return changed(s, a, r, action, b.reason);
}
export function authorizePerformanceReplay(
  s: State,
  a: Actor,
  route: string,
  result: unknown,
) {
  const id = route.split("/")[3] || (result as { id: string }).id;
  if (route.startsWith("/performance/reports")) {
    const report = s.performanceReports[id];
    assert(
      report && canSeeReport(s, a, report),
      403,
      "REPLAY_FORBIDDEN",
      "Không còn quyền thực hiện thao tác này.",
    );
    const deciding = !!route.split("/")[4];
    assert(
      deciding
        ? report.reviewerId === a.employeeId &&
            managesPerformance(s, a, report.senderId)
        : report.senderId === a.employeeId,
      403,
      "REPLAY_FORBIDDEN",
      "Không còn quyền thực hiện thao tác này.",
    );
    return;
  }
  const r = performanceFor(s, a, id),
    action = route.split("/")[4];
  const report = r.reportId ? s.performanceReports[r.reportId] : undefined;
  const allowed =
    action === "acknowledge"
      ? a.employeeId === r.employeeId
      : action !== "self" &&
        (canEditPerformance(s, a, r) ||
          (report && canDecideReport(s, a, report)));
  assert(
    allowed,
    403,
    "REPLAY_FORBIDDEN",
    "Không còn quyền thực hiện thao tác này.",
  );
}
