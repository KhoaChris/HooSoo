import { createHiredEmployee } from "./recruitment-onboarding";
import { candidateHireSchema, type CandidateHireInput } from "@hoosoo/shared";
import { isSupervisorRole } from "@hoosoo/shared";
import {
  assessmentPercent,
  recruitmentAssessmentSchema,
  type RecruitmentAssessmentInput,
} from "@hoosoo/shared";
import { randomUUID, createHash } from "node:crypto";
import type {
  State,
  Actor,
  RecruitmentJobInput,
  CandidateInput,
  Candidate,
  RecruitmentJob,
  Interview,
} from "@hoosoo/shared";
import { assert, notFound } from "../../utils/errors";
import { requireRole, isHR } from "../../common/authorization";
import { audit } from "../../common/audit";
import { assertVersion, event } from "../workflows/approval";
import { clockAt } from "../../utils/time";
export function canAccessJob(s: State, a: Actor, j: RecruitmentJob) {
  return (
    isHR(a) ||
    (isSupervisorRole(a.role) &&
      j.hiringManagerId === a.employeeId &&
      j.departmentId === s.employees[a.employeeId]?.departmentId)
  );
}
export function jobFor(s: State, a: Actor, id: string) {
  const j = s.recruitmentJobs[id];
  if (!j || !canAccessJob(s, a, j)) notFound();
  return j;
}
export function candidateFor(s: State, a: Actor, id: string) {
  const c = s.candidates[id];
  if (!c) notFound();
  jobFor(s, a, c.jobId);
  return c;
}
function activeCandidate(s: State, a: Actor, id: string, version: number) {
  const c = candidateFor(s, a, id);
  assertVersion(c, version);
  assert(
    c.status === "active",
    409,
    "CANDIDATE_CLOSED",
    "Hồ sơ đã có quyết định cuối cùng.",
  );
  assert(
    jobFor(s, a, c.jobId).active,
    409,
    "JOB_CLOSED",
    "Đợt tuyển dụng đã đóng. Nhân sự cần mở lại trước khi xử lý.",
  );
  return c;
}
function changed(
  s: State,
  a: Actor,
  c: Candidate,
  action: string,
  reason: string,
) {
  c.version++;
  c.history.push(event(s, a, action, reason));
  audit(
    s,
    a,
    `recruitment.${action}`,
    c.id,
    {
      name: c.name,
      stage:
        s.recruitmentJobs[c.jobId]?.stages.find((x) => x.id === c.stageId)
          ?.name ?? "",
      status: c.status,
      ...(c.employeeId ? { employeeId: c.employeeId } : {}),
    },
    reason,
  );
  return c;
}
export function saveJob(
  s: State,
  a: Actor,
  input: RecruitmentJobInput,
  id: string = randomUUID(),
) {
  requireRole(a, ["Admin", "HR"]);
  const old = s.recruitmentJobs[id];
  if (old) assertVersion(old, input.version);
  assert(
    s.departments[input.departmentId]?.active,
    400,
    "DEPARTMENT_REQUIRED",
    "Chọn phòng ban đang hoạt động.",
  );
  const manager = s.employees[input.hiringManagerId];
  assert(
    manager &&
      manager.status !== "terminated" &&
      manager.departmentId === input.departmentId &&
      Object.values(s.memberships).some(
        (m) =>
          m.employeeId === manager.id && m.active && isSupervisorRole(m.role),
      ),
    400,
    "HIRING_MANAGER_REQUIRED",
    "Người phụ trách phải có quyền quản lý trong phòng ban tuyển dụng.",
  );
  const candidates = Object.values(s.candidates).filter((c) => c.jobId === id);
  for (const c of candidates) {
    // Existing evaluated rounds retain their order and meaning. Unused future
    // interview rounds may be added/removed without rewriting a candidate's past.
    const reached = c.rounds.map((r) => r.stageId);
    assert(
      reached.every(
        (stageId, i) =>
          input.stages[i]?.id === stageId &&
          input.stages[i]?.kind ===
            old?.stages.find((x) => x.id === stageId)?.kind,
      ),
      409,
      "STAGE_IN_USE",
      "Không thể xóa hoặc đổi thứ tự vòng đã có ứng viên. Có thể chỉnh các vòng chưa sử dụng.",
    );
  }
  assert(
    input.openings >= candidates.filter((c) => c.status === "hired").length,
    409,
    "OPENINGS_IN_USE",
    "Số lượng tuyển không thể nhỏ hơn số ứng viên đã trúng tuyển.",
  );
  const j: RecruitmentJob = {
    ...input,
    id,
    version: (old?.version ?? 0) + 1,
    createdAt: old?.createdAt ?? new Date().toISOString(),
    createdBy: old?.createdBy ?? a.uid,
  };
  s.recruitmentJobs[id] = j;
  audit(
    s,
    a,
    "recruitment.job_saved",
    id,
    { title: j.title, rounds: j.stages.map((x) => x.name) },
    "",
  );
  return j;
}
export function createCandidate(s: State, a: Actor, input: CandidateInput) {
  requireRole(a, ["Admin", "HR"]);
  const job = jobFor(s, a, input.jobId);
  assert(job.active, 409, "JOB_CLOSED", "Đợt tuyển dụng đã đóng.");
  assert(
    !Object.values(s.candidates).some(
      (c) =>
        c.jobId === input.jobId &&
        c.email.toLowerCase() === input.email.toLowerCase(),
    ),
    409,
    "DUPLICATE_CANDIDATE",
    "Email này đã có hồ sơ trong đợt tuyển dụng.",
  );
  const stage = job.stages[0];
  const c: Candidate = {
    ...input,
    id: randomUUID(),
    email: input.email.toLowerCase(),
    stageId: stage.id,
    status: "active",
    version: 1,
    rounds: [{ stageId: stage.id, stageName: stage.name }],
    history: [event(s, a, "created", input.note)],
    interviewDates: [],
    cv: null,
    createdAt: new Date().toISOString(),
    createdBy: a.uid,
  };
  s.candidates[c.id] = c;
  audit(
    s,
    a,
    "recruitment.created",
    c.id,
    { name: c.name, job: job.title },
    "",
  );
  return c;
}
export function editCandidate(
  s: State,
  a: Actor,
  id: string,
  input: CandidateInput & { version: number },
) {
  requireRole(a, ["Admin", "HR"]);
  const c = candidateFor(s, a, id);
  assertVersion(c, input.version);
  assert(
    c.jobId === input.jobId,
    400,
    "JOB_IMMUTABLE",
    "Hồ sơ phải giữ nguyên đợt tuyển dụng.",
  );
  assert(
    !Object.values(s.candidates).some(
      (other) =>
        other.id !== id &&
        other.jobId === c.jobId &&
        other.email.toLowerCase() === input.email.toLowerCase(),
    ),
    409,
    "DUPLICATE_CANDIDATE",
    "Email này đã có hồ sơ trong đợt tuyển dụng.",
  );
  Object.assign(c, input, { email: input.email.toLowerCase() });
  return changed(s, a, c, "updated", "Cập nhật thông tin hồ sơ ứng viên");
}
export function evaluateCandidate(
  s: State,
  a: Actor,
  id: string,
  input: {
    version: number;
    result: "passed" | "failed";
    score?: number;
    assessment?: RecruitmentAssessmentInput;
    reason: string;
  },
) {
  const c = activeCandidate(s, a, id, input.version),
    job = jobFor(s, a, c.jobId),
    stage = job.stages.find((x) => x.id === c.stageId)!,
    round = c.rounds.find((x) => x.stageId === c.stageId)!;
  if (stage.kind === "interview") {
    assert(
      round.interview?.status === "confirmed",
      409,
      "INTERVIEW_REQUIRED",
      "Lịch phỏng vấn cần được nhân sự duyệt trước khi đánh giá.",
    );
    assert(
      clockAt(round.interview.date, round.interview.end) <= Date.now(),
      409,
      "INTERVIEW_NOT_FINISHED",
      "Chỉ đánh giá sau khi kết thúc lịch phỏng vấn.",
    );
  }
  const assessment = input.assessment
    ? recruitmentAssessmentSchema.parse(input.assessment)
    : undefined;
  assert(
    !assessment || assessment.kind === stage.kind,
    400,
    "ASSESSMENT_STAGE_MISMATCH",
    "Bộ tiêu chí không phù hợp với vòng tuyển dụng.",
  );
  assert(
    assessment ||
      (Number.isInteger(input.score) && input.score! >= 1 && input.score! <= 5),
    400,
    "ASSESSMENT_REQUIRED",
    "Cần có phiếu đánh giá hợp lệ.",
  );
  const totalPercent = assessment ? assessmentPercent(assessment) : undefined;
  // Keep the legacy score for older clients; it is never authoritative for a scorecard.
  if (assessment)
    round.assessment = {
      ...structuredClone(assessment),
      totalPercent: totalPercent!,
    };
  else delete round.assessment;
  Object.assign(round, {
    result: input.result,
    score:
      totalPercent !== undefined
        ? Math.max(1, Math.round(totalPercent / 20))
        : input.score,
    feedback: input.reason,
    evaluatedBy: a.uid,
    evaluatedAt: new Date().toISOString(),
  });
  return changed(s, a, c, input.result, input.reason);
}
export function moveCandidate(
  s: State,
  a: Actor,
  id: string,
  input: { version: number; stageId: string; reason: string },
) {
  const c = activeCandidate(s, a, id, input.version),
    j = jobFor(s, a, c.jobId),
    index = j.stages.findIndex((x) => x.id === c.stageId),
    next = j.stages[index + 1];
  assert(
    next?.id === input.stageId,
    409,
    "SEQUENTIAL_STAGE_REQUIRED",
    "Chỉ chuyển sang vòng kế tiếp theo thứ tự tuyển dụng.",
  );
  assert(
    c.rounds.find((r) => r.stageId === c.stageId)?.result === "passed",
    409,
    "STAGE_NOT_PASSED",
    "Cần đánh giá đạt ở vòng hiện tại trước khi chuyển vòng.",
  );
  c.stageId = next.id;
  c.rounds.push({ stageId: next.id, stageName: next.name });
  return changed(s, a, c, "moved", input.reason);
}
function noInterviewConflict(s: State, id: string, interview: Interview) {
  assert(
    !Object.values(s.candidates).some(
      (c) =>
        c.id !== id &&
        c.status === "active" &&
        c.rounds.some(
          (r) =>
            r.interview?.interviewerId === interview.interviewerId &&
            r.interview.date === interview.date &&
            r.interview.start < interview.end &&
            r.interview.end > interview.start,
        ),
    ),
    409,
    "INTERVIEW_CONFLICT",
    "Người phỏng vấn đã có lịch trùng giờ. Hãy chọn thời gian khác.",
  );
}
export function scheduleInterview(
  s: State,
  a: Actor,
  id: string,
  input: {
    version: number;
    date: string;
    start: string;
    end: string;
    interviewerId: string;
    location: string;
  },
) {
  const c = activeCandidate(s, a, id, input.version),
    j = jobFor(s, a, c.jobId),
    round = c.rounds.find((r) => r.stageId === c.stageId)!;
  assert(
    j.stages.find((x) => x.id === c.stageId)?.kind === "interview",
    409,
    "INTERVIEW_STAGE_REQUIRED",
    "Chỉ đặt lịch trong vòng phỏng vấn.",
  );
  assert(
    !round.result,
    409,
    "ROUND_EVALUATED",
    "Vòng này đã được đánh giá, không thể đổi lịch.",
  );
  assert(
    input.start < input.end && clockAt(input.date, input.start) > Date.now(),
    400,
    "INTERVIEW_TIME",
    "Chọn khoảng giờ phỏng vấn trong tương lai.",
  );
  const interviewer = s.employees[input.interviewerId];
  assert(
    interviewer &&
      interviewer.status !== "terminated" &&
      (interviewer.id === j.hiringManagerId ||
        Object.values(s.memberships).some(
          (m) =>
            m.employeeId === interviewer.id &&
            m.active &&
            ["Admin", "HR"].includes(m.role),
        )),
    400,
    "INTERVIEWER_REQUIRED",
    "Chọn người phụ trách tuyển dụng hoặc nhân sự đang hoạt động.",
  );
  const interview: Interview = {
    date: input.date,
    start: input.start,
    end: input.end,
    interviewerId: input.interviewerId,
    interviewerName: interviewer.name,
    location: input.location,
    status: "proposed",
    confirmedBy: "",
  };
  noInterviewConflict(s, id, interview);
  round.interview = interview;
  c.interviewDates = [
    ...new Set(
      c.rounds.flatMap((r) => (r.interview ? [r.interview.date] : [])),
    ),
  ];
  return changed(
    s,
    a,
    c,
    "interview_scheduled",
    `${input.date} ${input.start}–${input.end}`,
  );
}
export function confirmInterview(
  s: State,
  a: Actor,
  id: string,
  input: { version: number; reason: string },
) {
  requireRole(a, ["Admin", "HR"]);
  const c = activeCandidate(s, a, id, input.version),
    interview = c.rounds.find((r) => r.stageId === c.stageId)?.interview;
  assert(
    interview?.status === "proposed",
    409,
    "INTERVIEW_REQUIRED",
    "Chưa có lịch phỏng vấn cần duyệt.",
  );
  assert(
    clockAt(interview.date, interview.start) > Date.now(),
    409,
    "PAST_INTERVIEW",
    "Lịch đã qua. Hãy đề xuất lịch mới.",
  );
  noInterviewConflict(s, id, interview);
  interview.status = "confirmed";
  interview.confirmedBy = a.uid;
  return changed(s, a, c, "interview_confirmed", input.reason);
}
export function decideCandidate(
  s: State,
  a: Actor,
  id: string,
  decision: "hire" | "reject" | "direct-hire",
  input: { version: number; reason: string } | CandidateHireInput,
) {
  requireRole(a, ["Admin", "HR"]);
  const c = activeCandidate(s, a, id, input.version),
    j = jobFor(s, a, c.jobId);
  if (decision !== "reject") {
    assert(
      Object.values(s.candidates).filter(
        (x) => x.jobId === j.id && x.status === "hired",
      ).length < j.openings,
      409,
      "HEADCOUNT_FILLED",
      "Đã đủ chỉ tiêu tuyển dụng của đợt này.",
    );
    if (decision === "hire")
      assert(
        c.stageId === j.stages.at(-1)?.id &&
          c.rounds.find((r) => r.stageId === c.stageId)?.result === "passed",
        409,
        "FINAL_REVIEW_REQUIRED",
        "Cần đạt vòng quyết định trước khi xác nhận trúng tuyển.",
      );
  }
  if (decision !== "reject")
    createHiredEmployee(s, a, c, j, candidateHireSchema.parse(input));
  c.status = decision === "reject" ? "rejected" : "hired";
  return changed(
    s,
    a,
    c,
    decision === "direct-hire" ? "direct_hired" : c.status,
    input.reason,
  );
}
export function onboardCandidate(
  s: State,
  a: Actor,
  id: string,
  input: CandidateHireInput,
) {
  requireRole(a, ["Admin", "HR"]);
  const c = candidateFor(s, a, id);
  assertVersion(c, input.version);
  assert(
    c.status === "hired",
    409,
    "CANDIDATE_NOT_HIRED",
    "Chỉ tạo hồ sơ nhân viên cho ứng viên đã trúng tuyển.",
  );
  createHiredEmployee(s, a, c, jobFor(s, a, c.jobId), input);
  return changed(s, a, c, "employee_created", input.reason);
}
export const CV_CHUNK_BYTES = 256 * 1024,
  MAX_CV_BYTES = 2 * 1024 * 1024;
export function saveCV(
  s: State,
  a: Actor,
  id: string,
  pdf: Buffer,
  name: string,
  version: number,
) {
  requireRole(a, ["Admin", "HR"]);
  const c = candidateFor(s, a, id);
  assertVersion(c, version);
  assert(
    pdf.length > 5 &&
      pdf.length <= MAX_CV_BYTES &&
      pdf.subarray(0, 5).toString() === "%PDF-",
    400,
    "INVALID_CV",
    "Chỉ nhận tệp PDF gốc tối đa 2 MB.",
  );
  const chunks = Math.ceil(pdf.length / CV_CHUNK_BYTES);
  // Fixed slots avoid orphaned data when replacing a larger CV with a smaller one.
  for (let i = 0; i < 8; i++) {
    const fileId = `${id}_${i}`;
    if (i < chunks || s.candidateFiles[fileId])
      s.candidateFiles[fileId] = {
        id: fileId,
        candidateId: id,
        data:
          i < chunks
            ? pdf
                .subarray(i * CV_CHUNK_BYTES, (i + 1) * CV_CHUNK_BYTES)
                .toString("base64")
            : "",
      };
  }
  c.cv = {
    name:
      Array.from(name)
        .map((ch) =>
          ch.charCodeAt(0) < 32 || ch === "/" || ch === "\\" ? "_" : ch,
        )
        .join("")
        .slice(0, 150) || "CV.pdf",
    size: pdf.length,
    chunks,
    sha256: createHash("sha256").update(pdf).digest("hex"),
  };
  changed(s, a, c, "cv_uploaded", c.cv.name);
  return { id: c.id, cv: c.cv, version: c.version };
}
