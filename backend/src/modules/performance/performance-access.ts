import {
  isSupervisorRole,
  type Actor,
  type State,
  type PerformanceReview,
  type PerformanceReport,
} from "@hoosoo/shared";
import { canManageEmployee, actorFor } from "../../common/authorization";

export function managesPerformance(s: State, a: Actor, employeeId: string) {
  return (
    isSupervisorRole(a.role) &&
    employeeId !== a.employeeId &&
    s.employees[employeeId]?.status !== "terminated" &&
    canManageEmployee(s, a, employeeId)
  );
}
export function performanceActor(s: State, employeeId: string): Actor | null {
  const membership = Object.values(s.memberships).find(
    (m) => m.employeeId === employeeId && m.active,
  );
  if (!membership) return null;
  try {
    return actorFor(s, membership.id);
  } catch {
    return null;
  }
}
export function evaluatorId(s: State, r: PerformanceReview) {
  return (
    r.evaluatorId ||
    s.employees[r.employeeId]?.managerId ||
    s.memberships[r.createdBy || ""]?.employeeId ||
    ""
  );
}
export function canEditPerformance(s: State, a: Actor, r: PerformanceReview) {
  if (!managesPerformance(s, a, r.employeeId)) return false;
  const report = r.reportId ? s.performanceReports[r.reportId] : undefined;
  // A submitted report owns its assessments. Missing report data fails closed.
  if (r.reportId)
    return (
      !!report && report.status === "pending" && canDecideReport(s, a, report)
    );
  const evaluator = evaluatorId(s, r);
  const author =
    r.managerAssessment && s.memberships[r.managerAssessment.by]?.employeeId;
  return (
    (evaluator === a.employeeId || managesPerformance(s, a, evaluator)) &&
    (!author ||
      author === a.employeeId ||
      r.revisionEditorId === a.employeeId ||
      managesPerformance(s, a, author))
  );
}
export function canDecideReport(s: State, a: Actor, report: PerformanceReport) {
  return (
    report.status === "pending" &&
    report.reviewerId === a.employeeId &&
    managesPerformance(s, a, report.senderId) &&
    report.reviewIds.every((id) => {
      const r = s.performanceReviews[id];
      return (
        r && r.reportId === report.id && managesPerformance(s, a, r.employeeId)
      );
    })
  );
}
export function canSeeReport(s: State, a: Actor, report: PerformanceReport) {
  return (
    isSupervisorRole(a.role) &&
    (report.senderId === a.employeeId ||
      managesPerformance(s, a, report.senderId)) &&
    report.reviewIds.every(
      (id) =>
        !!s.performanceReviews[id] &&
        managesPerformance(s, a, s.performanceReviews[id].employeeId),
    )
  );
}
export function canSubmitReport(s: State, a: Actor, r: PerformanceReview) {
  return (
    !r.reportId &&
    canEditPerformance(s, a, r) &&
    [
      "ready",
      "hr_review",
      "report_revision",
      "completed",
      "acknowledged",
    ].includes(r.status) &&
    !!r.managerAssessment?.submitted
  );
}
