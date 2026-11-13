import type { Candidate, RecruitmentJob } from "@hoosoo/shared";

// UI affordances mirror the existing /move command. The API remains authoritative.
export function candidateMovement(
  c: Candidate,
  job: RecruitmentJob,
  canManage: boolean,
) {
  const index = job.stages.findIndex((s) => s.id === c.stageId);
  const next = index >= 0 ? job.stages[index + 1] : undefined;
  const reason = !canManage
    ? "Bạn không có quyền chuyển vòng."
    : !job.active
      ? "Đợt tuyển dụng đã đóng."
      : c.status !== "active"
        ? "Hồ sơ đã có quyết định cuối cùng."
        : c.jobId !== job.id || index < 0
          ? "Vòng tuyển dụng không còn hợp lệ."
          : !next
            ? "Đã ở vòng quyết định."
            : c.rounds.find((r) => r.stageId === c.stageId)?.result !== "passed"
              ? "Cần đánh giá đạt ở vòng hiện tại."
              : "";
  return { next, reason, allowed: !reason && !!next };
}

export function canDropCandidate(
  c: Candidate,
  job: RecruitmentJob,
  target: string,
  canManage: boolean,
) {
  const movement = candidateMovement(c, job, canManage);
  return movement.allowed && movement.next?.id === target;
}

export function candidateDropReason(
  c: Candidate,
  job: RecruitmentJob,
  target: string | null,
  canManage: boolean,
) {
  const movement = candidateMovement(c, job, canManage);
  if (!movement.allowed) return movement.reason;
  if (!target) return "Vui lòng thả vào vòng được tô sáng.";
  if (target === c.stageId || target === movement.next?.id) return "";
  if (target === "hired" || target === "rejected")
    return "Quyết định tuyển dụng cần xác nhận trong hồ sơ.";
  return "Chỉ được chuyển sang vòng kế tiếp.";
}
