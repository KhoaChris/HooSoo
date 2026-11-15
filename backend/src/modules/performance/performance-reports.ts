import { randomUUID } from "node:crypto";
import {
  performanceReportSchema,
  performanceActionSchema,
  type PerformanceReport,
  type PerformanceReportInput,
  type PerformanceReportView,
  type Actor,
  type State,
} from "@hoosoo/shared";
import { assert, notFound } from "../../utils/errors";
import { audit } from "../../common/audit";
import { assertVersion, event } from "../workflows/approval";
import {
  canDecideReport,
  canSeeReport,
  canSubmitReport,
  managesPerformance,
  performanceActor,
} from "./performance-access";
import { changed } from "./performance.service";
import type { z } from "zod";

export function reportView(
  s: State,
  a: Actor,
  r: PerformanceReport,
): PerformanceReportView {
  return {
    ...structuredClone(r),
    senderName: s.employees[r.senderId]?.name ?? "",
    reviewerName: s.employees[r.reviewerId]?.name ?? "",
    canDecide: canDecideReport(s, a, r),
  };
}
export function submitReport(
  s: State,
  a: Actor,
  input: PerformanceReportInput,
) {
  const b = performanceReportSchema.parse(input);
  const recipient = performanceActor(s, b.reviewerId);
  assert(
    recipient && managesPerformance(s, recipient, a.employeeId),
    403,
    "REPORT_REVIEWER_FORBIDDEN",
    "Chọn cấp trên có quyền xem xét báo cáo.",
  );
  const reviews = b.reviews.map((item) => {
    const review = s.performanceReviews[item.id];
    assert(
      review &&
        canSubmitReport(s, a, review) &&
        managesPerformance(s, recipient, review.employeeId),
      403,
      "REPORT_SCOPE_FORBIDDEN",
      "Báo cáo chứa đánh giá chưa hoàn tất hoặc ngoài phạm vi quản lý.",
    );
    assert(
      !review.requiredReviewerId || review.requiredReviewerId === b.reviewerId,
      403,
      "REPORT_REVIEWER_REQUIRED",
      "Gửi lại báo cáo cho cấp trên đã yêu cầu bổ sung.",
    );
    assertVersion(review, item.version);
    return review;
  });
  const now = new Date().toISOString();
  const report: PerformanceReport = {
    id: randomUUID(),
    title: b.title,
    senderId: a.employeeId,
    reviewerId: b.reviewerId,
    reviewIds: reviews.map((r) => r.id),
    submittedVersions: Object.fromEntries(
      reviews.map((r) => [r.id, r.version]),
    ),
    status: "pending",
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdBy: a.uid,
    reason: b.reason,
    decisionNote: "",
    history: [event(s, a, "performance_report_submitted", b.reason)],
  };
  s.performanceReports[report.id] = report;
  for (const r of reviews) {
    r.reportId = report.id;
    r.status = "pending_report";
    changed(s, a, r, "report_submitted", b.reason);
  }
  audit(
    s,
    a,
    "performance.report_submitted",
    report.id,
    { title: report.title, count: reviews.length },
    b.reason,
  );
  return reportView(s, a, report);
}
export function decideReport(
  s: State,
  a: Actor,
  id: string,
  action: "finalize" | "return",
  input: z.infer<typeof performanceActionSchema>,
) {
  const b = performanceActionSchema.parse(input),
    report = s.performanceReports[id];
  if (!report || !canSeeReport(s, a, report)) notFound();
  assertVersion(report, b.version);
  assert(
    canDecideReport(s, a, report),
    403,
    "REPORT_DECISION_FORBIDDEN",
    "Chỉ cấp trên được chỉ định mới quyết định báo cáo này.",
  );
  const reviews = report.reviewIds.map((id) => s.performanceReviews[id]);
  assert(
    action !== "finalize" ||
      reviews.every((r) => r.managerAssessment?.submitted),
    409,
    "INCOMPLETE_REVIEW",
    "Hoàn tất đánh giá trước khi công bố.",
  );
  for (const r of reviews) {
    if (action === "return") {
      r.reportId = "";
      r.revisionEditorId = report.senderId;
      r.requiredReviewerId = report.reviewerId;
      r.status = "report_revision";
    } else {
      r.status = "completed";
      r.finalNote = b.reason;
      r.finalBy = a.uid;
      r.finalAt = new Date().toISOString();
    }
    changed(
      s,
      a,
      r,
      action === "return" ? "report_returned" : "report_finalized",
      b.reason,
    );
  }
  report.status = action === "return" ? "returned" : "finalized";
  report.version++;
  report.updatedAt = new Date().toISOString();
  report.decisionNote = b.reason;
  report.history.push(
    event(
      s,
      a,
      "performance_report_" + (action === "return" ? "returned" : "finalized"),
      b.reason,
    ),
  );
  audit(
    s,
    a,
    "performance.report_" + (action === "return" ? "returned" : "finalized"),
    id,
    { title: report.title, count: reviews.length },
    b.reason,
  );
  return reportView(s, a, report);
}
