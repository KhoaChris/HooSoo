import { randomUUID } from "node:crypto";
import {
  isSupervisorRole,
  employmentTables,
  type Actor,
  type State,
  type EmploymentSection,
  type EmploymentItem,
  type EmploymentView,
  type EmploymentAction,
  type EmploymentActionInput,
  type ContractInput,
  type ProbationInput,
  type ProbationAssessment,
  type OnboardingPlan,
  type OnboardingTask,
  type EmploymentRecord,
} from "@hoosoo/shared";
import { assert, notFound } from "../../utils/errors";
import {
  isHR,
  canManageEmployee,
  assertManageEmployee,
} from "../../common/authorization";
import { managerFor, event, assertVersion } from "../workflows/approval";
import { audit } from "../../common/audit";
import { businessDate } from "../../utils/time";

export function canSeeEmployment(
  s: State,
  a: Actor,
  section: EmploymentSection,
  r: EmploymentItem,
) {
  if (a.employeeId === r.employeeId)
    return (
      section !== "contracts" ||
      r.status !== "draft" ||
      (isHR(a) && canManageEmployee(s, a, r.employeeId))
    );
  return (
    canManageEmployee(s, a, r.employeeId) &&
    (section !== "contracts" || isHR(a))
  );
}
export function employmentFor(
  s: State,
  a: Actor,
  section: EmploymentSection,
  id: string,
) {
  const r = s[employmentTables[section]][id];
  if (!r || !canSeeEmployment(s, a, section, r)) notFound();
  return r;
}
function manage(s: State, a: Actor, employeeId: string) {
  assert(
    isHR(a),
    403,
    "FORBIDDEN",
    "Chỉ HR hoặc Admin được quản lý hồ sơ này.",
  );
  assertManageEmployee(s, a, employeeId);
}
function liveEmployee(s: State, id: string) {
  assert(
    s.employees[id] && s.employees[id].status !== "terminated",
    409,
    "EMPLOYEE_INACTIVE",
    "Nhân viên đã kết thúc làm việc.",
  );
}
function reviewer(s: State, a: Actor, employeeId: string) {
  if (a.employeeId === employeeId || !canManageEmployee(s, a, employeeId))
    return false;
  const manager = managerFor(s, employeeId);
  return manager
    ? manager === a.employeeId && isSupervisorRole(a.role)
    : isHR(a);
}
function taskOwner(
  s: State,
  a: Actor,
  p: OnboardingPlan,
  task: OnboardingTask,
) {
  if (task.owner === "employee") return a.employeeId === p.employeeId;
  if (!canManageEmployee(s, a, p.employeeId) || a.employeeId === p.employeeId)
    return false;
  return task.owner === "hr" ? isHR(a) : reviewer(s, a, p.employeeId);
}
function changed(
  s: State,
  a: Actor,
  r: EmploymentRecord,
  action: string,
  reason: string,
) {
  r.version++;
  r.history.push(event(s, a, action, reason));
  audit(
    s,
    a,
    "employment." + action,
    r.id,
    { employeeId: r.employeeId, version: r.version },
    reason,
  );
}
function base(
  s: State,
  a: Actor,
  employeeId: string,
  id: string = randomUUID(),
): EmploymentRecord {
  return {
    id,
    employeeId,
    version: 1,
    createdAt: new Date().toISOString(),
    createdBy: a.uid,
    history: [event(s, a, "created", "")],
  };
}
export function saveContract(
  s: State,
  a: Actor,
  input: ContractInput,
  id?: string,
) {
  const old = id ? s.employmentContracts[id] : undefined;
  if (id && !old) notFound();
  manage(s, a, old?.employeeId ?? input.employeeId);
  if (old) {
    assert(
      old.employeeId === input.employeeId,
      400,
      "EMPLOYEE_IMMUTABLE",
      "Không thể đổi nhân viên của hồ sơ.",
    );
    assert(
      old.status === "draft",
      409,
      "CONTRACT_LOCKED",
      "Chỉ chỉnh sửa hợp đồng nháp.",
    );
    assertVersion(old, input.version);
  } else
    assert(input.version === 0, 409, "VERSION_CONFLICT", "Hồ sơ đã thay đổi.");
  liveEmployee(s, input.employeeId);
  const record = {
    ...base(s, a, input.employeeId),
    ...old,
    ...input,
    version: old?.version ?? 0,
    reference: old?.reference ?? "HD-" + randomUUID().slice(0, 8).toUpperCase(),
    status: "draft" as const,
    acknowledgedAt: "",
    acknowledgedBy: "",
  };
  changed(
    s,
    a,
    record,
    old ? "contract_updated" : "contract_created",
    input.title,
  );
  s.employmentContracts[record.id] = record;
  return record;
}
export function contractAction(
  s: State,
  a: Actor,
  id: string,
  action: string,
  input: EmploymentActionInput,
) {
  const r = s.employmentContracts[id];
  if (!r) notFound();
  assertVersion(r, input.version);
  if (action === "acknowledge") {
    assert(
      a.employeeId === r.employeeId,
      403,
      "FORBIDDEN",
      "Chỉ người nhận được xác nhận hợp đồng.",
    );
    assert(
      r.status === "active" && !r.acknowledgedAt,
      409,
      "CONTRACT_STATE",
      "Hợp đồng không còn chờ xác nhận.",
    );
    r.acknowledgedAt = new Date().toISOString();
    r.acknowledgedBy = a.uid;
  } else {
    manage(s, a, r.employeeId);
    if (action === "activate") {
      liveEmployee(s, r.employeeId);
      assert(
        r.status === "draft",
        409,
        "CONTRACT_STATE",
        "Chỉ phát hành hợp đồng nháp.",
      );
      assert(
        !r.endDate || r.endDate >= businessDate(),
        400,
        "CONTRACT_EXPIRED",
        "Không phát hành hợp đồng đã hết hạn.",
      );
      assert(
        !Object.values(s.employmentContracts).some(
          (c) =>
            c.id !== id &&
            c.employeeId === r.employeeId &&
            c.status === "active" &&
            c.startDate <= (r.endDate || "9999-12-31") &&
            (c.endDate || "9999-12-31") >= r.startDate,
        ),
        409,
        "CONTRACT_OVERLAP",
        "Thời hạn trùng với hợp đồng đã phát hành.",
      );
      r.status = "active";
    } else if (action === "end") {
      assert(
        r.status === "active",
        409,
        "CONTRACT_STATE",
        "Chỉ kết thúc hợp đồng đã phát hành.",
      );
      r.status = "ended";
    } else {
      assert(
        action === "cancel" && ["draft", "active"].includes(r.status),
        409,
        "CONTRACT_STATE",
        "Không thể hủy hợp đồng này.",
      );
      r.status = "cancelled";
    }
  }
  changed(s, a, r, "contract_" + action, input.reason);
  return r;
}
export function saveProbation(
  s: State,
  a: Actor,
  input: ProbationInput,
  id?: string,
) {
  const old = id ? s.probationReviews[id] : undefined;
  if (id && !old) notFound();
  manage(s, a, old?.employeeId ?? input.employeeId);
  assert(
    s.employees[input.employeeId]?.status === "probation",
    409,
    "NOT_ON_PROBATION",
    "Chọn nhân viên đang thử việc.",
  );
  if (old) {
    assert(
      old.employeeId === input.employeeId && old.status === "in_progress",
      409,
      "PROBATION_LOCKED",
      "Không thể đổi hồ sơ đang chờ quyết định.",
    );
    assertVersion(old, input.version);
  } else {
    assert(input.version === 0, 409, "VERSION_CONFLICT", "Hồ sơ đã thay đổi.");
    assert(
      !Object.values(s.probationReviews).some(
        (p) =>
          p.employeeId === input.employeeId &&
          ["in_progress", "in_review"].includes(p.status),
      ),
      409,
      "PROBATION_EXISTS",
      "Nhân viên đã có kỳ thử việc đang theo dõi.",
    );
  }
  const r = {
    ...base(s, a, input.employeeId),
    status: "in_progress" as const,
    assessment: null,
    assessments: [] as ProbationAssessment[],
    selfReview: "",
    decision: "",
    ...old,
    ...input,
    version: old?.version ?? 0,
  };
  changed(
    s,
    a,
    r,
    old ? "probation_updated" : "probation_created",
    input.objectives,
  );
  s.probationReviews[r.id] = r;
  return r;
}
export function assessProbation(
  s: State,
  a: Actor,
  id: string,
  input: Omit<ProbationAssessment, "by" | "at" | "name">,
) {
  const r = s.probationReviews[id];
  if (!r) notFound();
  assert(
    reviewer(s, a, r.employeeId),
    403,
    "APPROVAL_FORBIDDEN",
    "Bạn không phải quản lý đánh giá hiện tại.",
  );
  liveEmployee(s, r.employeeId);
  assertVersion(r, input.version);
  assert(
    r.status === "in_progress",
    409,
    "PROBATION_LOCKED",
    "Kỳ thử việc không còn chờ đánh giá.",
  );
  r.assessment = {
    ...input,
    by: a.uid,
    at: new Date().toISOString(),
    name: s.employees[a.employeeId].name,
  };
  r.assessments.push(r.assessment);
  r.status = "in_review";
  changed(s, a, r, "probation_reviewed", input.strengths);
  return r;
}
export function probationAction(
  s: State,
  a: Actor,
  id: string,
  action: string,
  input: EmploymentActionInput,
) {
  const r = s.probationReviews[id];
  if (!r) notFound();
  assertVersion(r, input.version);
  if (action === "self-review") {
    assert(
      a.employeeId === r.employeeId,
      403,
      "FORBIDDEN",
      "Chỉ nhân viên tự đánh giá hồ sơ của mình.",
    );
    assert(
      r.status === "in_progress",
      409,
      "PROBATION_LOCKED",
      "Kỳ thử việc đã chuyển sang đánh giá.",
    );
    r.selfReview = input.reason;
  } else {
    manage(s, a, r.employeeId);
    liveEmployee(s, r.employeeId);
    assert(
      a.employeeId !== r.employeeId && r.assessment?.by !== a.uid,
      403,
      "SELF_APPROVAL_FORBIDDEN",
      "Người xác nhận phải khác nhân viên và người đánh giá.",
    );
    assert(
      r.status === "in_review" && r.assessment,
      409,
      "ASSESSMENT_REQUIRED",
      "Cần đánh giá của quản lý trước khi quyết định.",
    );
    if (action === "return") {
      r.status = "in_progress";
      r.assessment = null;
    } else {
      assert(
        r.assessment.recommendation === action,
        409,
        "RECOMMENDATION_MISMATCH",
        "Quyết định không khớp đề xuất. Yêu cầu đánh giá lại trước.",
      );
      if (action === "extend") {
        assert(
          input.endDate > r.endDate && input.endDate >= businessDate(),
          400,
          "EXTENSION_DATE",
          "Ngày gia hạn phải sau ngày kết thúc hiện tại.",
        );
        r.endDate = input.endDate;
        r.status = "in_progress";
        r.assessment = null;
      } else if (action === "confirm") {
        assert(
          s.employees[r.employeeId].status === "probation",
          409,
          "EMPLOYEE_CHANGED",
          "Trạng thái nhân viên đã thay đổi.",
        );
        s.employees[r.employeeId].status = "active";
        r.status = "confirmed";
      } else {
        assert(
          action === "decline",
          400,
          "INVALID_ACTION",
          "Thao tác không hợp lệ.",
        );
        r.status = "declined";
      }
    }
    r.decision = input.reason;
  }
  changed(s, a, r, "probation_" + action, input.reason);
  return r;
}
export function createOnboarding(
  s: State,
  a: Actor,
  employeeId: string,
  startDate: string,
) {
  manage(s, a, employeeId);
  liveEmployee(s, employeeId);
  assert(
    !s.onboardingPlans[employeeId],
    409,
    "ONBOARDING_EXISTS",
    "Nhân viên đã có checklist tiếp nhận.",
  );
  const template: [string, OnboardingTask["owner"], number][] = [
    ["Hoàn thiện thông tin cá nhân", "employee", 0],
    ["Xác nhận hồ sơ tiếp nhận", "hr", 0],
    ["Bàn giao tài khoản và công cụ", "hr", 1],
    ["Giới thiệu đội ngũ và công việc", "manager", 1],
    ["Thống nhất mục tiêu đầu kỳ", "manager", 3],
    ["Xác nhận nội quy và hướng dẫn", "employee", 3],
  ];
  const p: OnboardingPlan = {
    ...base(s, a, employeeId, employeeId),
    startDate,
    status: "in_progress",
    tasks: template.map(([title, owner, days]) => ({
      id: randomUUID(),
      title,
      owner,
      dueDate: new Date(Date.parse(startDate) + days * 86400000)
        .toISOString()
        .slice(0, 10),
      completedAt: "",
      completedBy: "",
      note: "",
    })),
  };
  s.onboardingPlans[p.id] = p;
  audit(s, a, "employment.onboarding_created", p.id, {
    employeeId,
    tasks: p.tasks.length,
  });
  return p;
}
export function addOnboardingTask(
  s: State,
  a: Actor,
  id: string,
  input: {
    version: number;
    title: string;
    owner: OnboardingTask["owner"];
    dueDate: string;
  },
) {
  const p = s.onboardingPlans[id];
  if (!p) notFound();
  manage(s, a, p.employeeId);
  liveEmployee(s, p.employeeId);
  assertVersion(p, input.version);
  assert(
    p.status === "in_progress" && p.tasks.length < 30,
    409,
    "ONBOARDING_LOCKED",
    "Checklist đã hoàn tất hoặc đủ 30 mục.",
  );
  p.tasks.push({
    id: randomUUID(),
    title: input.title,
    owner: input.owner,
    dueDate: input.dueDate,
    completedAt: "",
    completedBy: "",
    note: "",
  });
  changed(s, a, p, "onboarding_task_added", input.title);
  return p;
}
export function completeOnboardingTask(
  s: State,
  a: Actor,
  id: string,
  input: { version: number; taskId: string; done: boolean; note: string },
) {
  const p = s.onboardingPlans[id];
  if (!p) notFound();
  const task = p.tasks.find((t) => t.id === input.taskId);
  assert(task, 404, "NOT_FOUND", "Không tìm thấy mục tiếp nhận.");
  assert(
    taskOwner(s, a, p, task),
    403,
    "TASK_FORBIDDEN",
    "Chỉ người phụ trách được cập nhật mục này.",
  );
  liveEmployee(s, p.employeeId);
  assertVersion(p, input.version);
  assert(
    p.status === "in_progress",
    409,
    "ONBOARDING_LOCKED",
    "Checklist đã hoàn tất.",
  );
  task.completedAt = input.done ? new Date().toISOString() : "";
  task.completedBy = input.done ? a.uid : "";
  task.note = input.note;
  changed(
    s,
    a,
    p,
    input.done ? "onboarding_task_done" : "onboarding_task_reopened",
    task.title,
  );
  return p;
}
export function onboardingAction(
  s: State,
  a: Actor,
  id: string,
  action: string,
  input: EmploymentActionInput,
) {
  const p = s.onboardingPlans[id];
  if (!p) notFound();
  manage(s, a, p.employeeId);
  liveEmployee(s, p.employeeId);
  assertVersion(p, input.version);
  if (action === "complete") {
    assert(
      p.status === "in_progress" &&
        p.tasks.length > 0 &&
        p.tasks.every((t) => t.completedAt),
      409,
      "CHECKLIST_INCOMPLETE",
      "Hoàn thành tất cả mục trước khi chốt tiếp nhận.",
    );
    p.status = "completed";
  } else {
    assert(
      action === "reopen" && p.status === "completed",
      409,
      "ONBOARDING_STATE",
      "Checklist đang mở.",
    );
    p.status = "in_progress";
  }
  changed(s, a, p, "onboarding_" + action, input.reason);
  return p;
}
export function employmentView(
  s: State,
  a: Actor,
  section: EmploymentSection,
  r: EmploymentItem,
): EmploymentView {
  const canManage = isHR(a) && canManageEmployee(s, a, r.employeeId),
    self = a.employeeId === r.employeeId;
  const actions: EmploymentAction[] = [];
  let canEdit = false,
    canAddTask = false,
    editableTasks: string[] = [];
  if (section === "contracts") {
    const c = s.employmentContracts[r.id];
    canEdit = canManage && c.status === "draft";
    if (canEdit) actions.push("activate");
    if (canManage && c.status === "active") actions.push("end");
    if (canManage && ["draft", "active"].includes(c.status))
      actions.push("cancel");
    if (self && c.status === "active" && !c.acknowledgedAt)
      actions.push("acknowledge");
  } else if (section === "probations") {
    const p = s.probationReviews[r.id];
    canEdit = canManage && p.status === "in_progress";
    if (p.status === "in_progress") {
      if (self) actions.push("self-review");
      if (reviewer(s, a, p.employeeId)) actions.push("review");
    }
    if (
      p.status === "in_review" &&
      canManage &&
      !self &&
      p.assessment &&
      p.assessment.by !== a.uid
    )
      actions.push(p.assessment.recommendation, "return");
  } else {
    const p = s.onboardingPlans[r.id];
    canAddTask = canManage && p.status === "in_progress" && p.tasks.length < 30;
    editableTasks =
      p.status === "in_progress"
        ? p.tasks.filter((t) => taskOwner(s, a, p, t)).map((t) => t.id)
        : [];
    if (canManage) {
      if (p.status === "completed") actions.push("reopen");
      else if (p.tasks.every((t) => t.completedAt)) actions.push("complete");
    }
  }
  return {
    ...r,
    employeeName: s.employees[r.employeeId]?.name ?? "",
    employeeCode: s.employees[r.employeeId]?.employeeCode ?? "",
    canEdit,
    actions,
    editableTasks,
    canAddTask,
  };
}
export function authorizeEmploymentReplay(
  s: State,
  a: Actor,
  route: string,
  body: unknown,
  result: unknown,
) {
  const [, , section, id, action] = route.split("/") as string[];
  const r = employmentFor(
    s,
    a,
    section as EmploymentSection,
    id || (result as EmploymentItem).id,
  );
  if (["acknowledge", "self-review"].includes(action))
    assert(
      r.employeeId === a.employeeId,
      403,
      "FORBIDDEN",
      "Không còn quyền thực hiện.",
    );
  else if (action === "review")
    assert(
      reviewer(s, a, r.employeeId),
      403,
      "APPROVAL_FORBIDDEN",
      "Không còn quyền đánh giá.",
    );
  else if (action === "tasks" && route.endsWith("/complete")) {
    const p = s.onboardingPlans[r.id],
      task = p.tasks.find((t) => t.id === (body as { taskId: string }).taskId);
    assert(
      task && taskOwner(s, a, p, task),
      403,
      "TASK_FORBIDDEN",
      "Không còn quyền cập nhật mục này.",
    );
  } else manage(s, a, r.employeeId);
}
