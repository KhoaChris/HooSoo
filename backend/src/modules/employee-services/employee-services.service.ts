import { randomUUID } from "node:crypto";
import {
  serviceActions,
  type Actor,
  type State,
  type ServiceRecord,
  type ServiceSetup,
  type ServiceAction,
  type ServiceActionInput,
  type ServiceView,
  type ServiceTask,
} from "@hoosoo/shared";
import {
  isHR,
  canManageEmployee,
  employeeRole,
} from "../../common/authorization";
import { audit } from "../../common/audit";
import { assert, notFound } from "../../utils/errors";
import { businessDate } from "../../utils/time";
import { event, assertVersion } from "../workflows/approval";
import { saveEmployee } from "../employees/employees.service";

const outstanding = (r: ServiceRecord) =>
  r.section === "assets" && !["returned", "cancelled"].includes(r.status);
export function serviceManager(s: State, a: Actor, employeeId: string) {
  return a.employeeId !== employeeId && canManageEmployee(s, a, employeeId);
}
export function serviceVisible(s: State, a: Actor, r: ServiceRecord) {
  return r.employeeId === a.employeeId || serviceManager(s, a, r.employeeId);
}
function hr(s: State, a: Actor, id: string) {
  return isHR(a) && serviceManager(s, a, id);
}
export function serviceFor(s: State, a: Actor, id: string) {
  const r = s.employeeServices[id];
  if (!r || !serviceVisible(s, a, r)) notFound();
  return r;
}
function changed(
  s: State,
  a: Actor,
  r: ServiceRecord,
  action: string,
  reason: string,
) {
  r.version++;
  r.history.push(event(s, a, action, reason));
  audit(
    s,
    a,
    "employee_services." + action,
    r.id,
    {
      employeeId: r.employeeId,
      section: r.section,
      version: r.version,
      status: r.status,
    },
    reason,
  );
}
function taskAllowed(s: State, a: Actor, r: ServiceRecord, t: ServiceTask) {
  return t.owner === "employee"
    ? r.employeeId === a.employeeId
    : t.owner === "hr"
      ? hr(s, a, r.employeeId)
      : serviceManager(s, a, r.employeeId) &&
        (s.employees[r.employeeId]?.managerId === a.employeeId || isHR(a));
}
export function serviceBlockers(s: State, r: ServiceRecord) {
  if (r.section !== "offboarding" || r.status !== "in_progress") return [];
  const blockers: string[] = [];
  if (r.endDate > businessDate()) blockers.push("Chưa đến ngày làm việc cuối.");
  if (r.tasks.some((t) => !t.completedAt))
    blockers.push("Chưa hoàn tất các mục bàn giao.");
  if (
    Object.values(s.employeeServices).some(
      (x) => x.employeeId === r.employeeId && outstanding(x),
    )
  )
    blockers.push("Nhân viên còn tài sản chưa thu hồi.");
  if (
    Object.values(s.employees).some(
      (e) => e.managerId === r.employeeId && e.status !== "terminated",
    )
  )
    blockers.push("Cần điều chuyển nhân viên cấp dưới.");
  return blockers;
}
export function serviceAllowed(
  s: State,
  a: Actor,
  r: ServiceRecord,
  action: ServiceAction,
) {
  const self = r.employeeId === a.employeeId,
    manage = hr(s, a, r.employeeId),
    reviewer = serviceManager(s, a, r.employeeId);
  if (action === "cancel")
    return manage && ["issued", "in_progress"].includes(r.status);
  if (r.section === "assets")
    return action === "acknowledge"
      ? self && r.status === "issued"
      : action === "request-return"
        ? self && r.status === "in_use"
        : action === "receive-return"
          ? manage && ["in_use", "return_requested"].includes(r.status)
          : false;
  if (r.section === "training")
    return action === "submit-learning"
      ? self && r.status === "in_progress"
      : action === "accept-learning" || action === "revise-learning"
        ? reviewer && r.status === "completion_requested"
        : false;
  return action === "complete" && manage && r.status === "in_progress";
}
export function serviceView(s: State, a: Actor, r: ServiceRecord): ServiceView {
  return {
    ...r,
    employeeName: s.employees[r.employeeId]?.name || "",
    employeeCode: s.employees[r.employeeId]?.employeeCode || "",
    canEdit:
      hr(s, a, r.employeeId) && ["issued", "in_progress"].includes(r.status),
    canAddTask:
      r.section === "offboarding" &&
      hr(s, a, r.employeeId) &&
      r.status === "in_progress",
    editableTasks:
      r.status === "in_progress"
        ? r.tasks.filter((t) => taskAllowed(s, a, r, t)).map((t) => t.id)
        : [],
    actions: serviceActions.filter((action) => serviceAllowed(s, a, r, action)),
    blockers: serviceBlockers(s, r),
  };
}
export function saveService(s: State, a: Actor, b: ServiceSetup, id?: string) {
  const old = id ? serviceFor(s, a, id) : undefined;
  assert(
    hr(s, a, old?.employeeId || b.employeeId),
    403,
    "FORBIDDEN",
    "Chỉ nhân sự có thẩm quyền được lập hồ sơ cho cấp dưới.",
  );
  assert(
    s.employees[b.employeeId]?.status !== "terminated",
    409,
    "EMPLOYEE_INACTIVE",
    "Nhân viên đã kết thúc làm việc.",
  );
  if (old) {
    assertVersion(old, b.version);
    assert(
      old.section === b.section &&
        old.employeeId === b.employeeId &&
        old.sourceRequestId ===
          ("sourceRequestId" in b ? b.sourceRequestId : ""),
      400,
      "IMMUTABLE_REFERENCE",
      "Không thể đổi nhân viên hoặc phiếu nguồn.",
    );
    assert(
      serviceView(s, a, old).canEdit,
      409,
      "RECORD_LOCKED",
      "Hồ sơ không còn cho phép chỉnh sửa.",
    );
    if (b.section === "assets")
      assert(
        b.assetCode === old.assetCode,
        400,
        "IMMUTABLE_REFERENCE",
        "Không thể đổi mã tài sản đã cấp.",
      );
  } else assert(b.version === 0, 409, "VERSION_CONFLICT", "Hồ sơ đã thay đổi.");
  const linkedUid = s.employees[b.employeeId].uid;
  const selfService = !!linkedUid && !!s.memberships[linkedUid]?.active;
  if (!old && b.section !== "offboarding")
    assert(
      selfService,
      409,
      "ACCOUNT_REQUIRED",
      "Cần cấp tài khoản đang hoạt động trước khi giao tài sản hoặc ghi danh đào tạo.",
    );
  const others = Object.values(s.employeeServices).filter((r) => r.id !== id);
  if (b.section === "assets")
    assert(
      !others.some((r) => r.assetCode === b.assetCode && outstanding(r)),
      409,
      "ASSET_IN_USE",
      "Tài sản đang được cấp cho một nhân viên khác.",
    );
  if (b.section === "offboarding") {
    assert(
      employeeRole(s, b.employeeId) !== "Admin",
      403,
      "ADMIN_PROTECTED",
      "Tài khoản Admin cần được bàn giao quyền quản trị trước khi nghỉ việc.",
    );
    assert(
      b.endDate >= s.employees[b.employeeId].hireDate,
      400,
      "INVALID_DATE",
      "Ngày nghỉ việc phải sau ngày nhận việc.",
    );
    assert(
      !others.some(
        (r) =>
          r.employeeId === b.employeeId &&
          r.section === "offboarding" &&
          r.status === "in_progress",
      ),
      409,
      "DUPLICATE_PLAN",
      "Nhân viên đã có hồ sơ bàn giao đang mở.",
    );
  }
  if ("sourceRequestId" in b && b.sourceRequestId) {
    const request = s.internalRequests[b.sourceRequestId];
    assert(
      request?.employeeId === b.employeeId &&
        request.status === "approved" &&
        request.kind === (b.section === "assets" ? "equipment" : "training"),
      409,
      "REQUEST_NOT_APPROVED",
      "Phiếu nguồn chưa được duyệt hoặc không khớp nhân viên và loại đề nghị.",
    );
    const used = others.filter(
      (r) =>
        r.sourceRequestId === b.sourceRequestId && r.status !== "cancelled",
    ).length;
    assert(
      used < (b.section === "assets" ? (request.quantity ?? 1) : 1),
      409,
      "REQUEST_FULFILLED",
      "Phiếu đề nghị đã được thực hiện đủ.",
    );
  }
  const r: ServiceRecord = {
    id: randomUUID(),
    createdBy: a.uid,
    createdAt: new Date().toISOString(),
    status: b.section === "assets" ? "issued" : "in_progress",
    startDate: businessDate(),
    sourceRequestId: "",
    assetCode: "",
    provider: "",
    documentUrl: "",
    outcome: "",
    tasks: [],
    history: [],
    ...old,
    ...b,
  };
  if (!old && b.section === "offboarding")
    r.tasks = [
      {
        owner: selfService ? "employee" : "hr",
        title: "Bàn giao công việc và hồ sơ",
      },
      { owner: "manager", title: "Xác nhận công việc đã bàn giao" },
      { owner: "hr", title: "Đối soát quyền lợi và tài sản" },
    ].map((t) => ({
      id: randomUUID(),
      title: t.title,
      owner: t.owner as ServiceTask["owner"],
      completedAt: "",
      completedBy: "",
      note: "",
    }));
  changed(s, a, r, old ? "updated" : "created", b.notes || b.title);
  s.employeeServices[r.id] = r;
  return r;
}
export function actService(
  s: State,
  a: Actor,
  id: string,
  action: ServiceAction,
  b: ServiceActionInput,
) {
  const r = serviceFor(s, a, id);
  assertVersion(r, b.version);
  assert(
    serviceAllowed(s, a, r, action),
    403,
    "ACTION_FORBIDDEN",
    "Bạn không có quyền thực hiện thao tác này hoặc trạng thái đã thay đổi.",
  );
  if (action === "complete") {
    const blockers = serviceBlockers(s, r);
    assert(!blockers.length, 409, "HANDOVER_INCOMPLETE", blockers.join(" "));
    const e = s.employees[r.employeeId];
    saveEmployee(
      s,
      a,
      {
        name: e.name,
        email: e.email,
        phone: e.phone,
        address: e.address,
        departmentId: e.departmentId,
        positionId: e.positionId,
        managerId: e.managerId,
        hireDate: e.hireDate,
        status: "terminated",
      },
      e.id,
    );
    for (const m of Object.values(s.memberships))
      if (m.employeeId === e.id) m.active = false;
    for (const c of Object.values(s.employmentContracts))
      if (c.employeeId === e.id && c.status === "active") {
        c.status = c.startDate > r.endDate ? "cancelled" : "ended";
        c.endDate = c.startDate > r.endDate ? c.endDate : r.endDate;
        c.version++;
        c.history.push(event(s, a, "offboarding", b.reason));
        audit(
          s,
          a,
          "employment.offboarding",
          c.id,
          { employeeId: e.id, status: c.status },
          b.reason,
        );
      }
    r.status = "completed";
  } else if (action === "acknowledge") r.status = "in_use";
  else if (action === "request-return") r.status = "return_requested";
  else if (action === "receive-return") r.status = "returned";
  else if (action === "submit-learning") {
    assert(
      r.startDate <= businessDate(),
      409,
      "TRAINING_NOT_STARTED",
      "Khóa đào tạo chưa bắt đầu.",
    );
    r.outcome = b.reason;
    r.documentUrl = b.documentUrl;
    r.status = "completion_requested";
  } else if (action === "accept-learning") r.status = "completed";
  else if (action === "revise-learning") r.status = "in_progress";
  else r.status = "cancelled";
  changed(s, a, r, action, b.reason);
  return r;
}
export function addServiceTask(
  s: State,
  a: Actor,
  id: string,
  b: { version: number; title: string; owner: ServiceTask["owner"] },
) {
  const r = serviceFor(s, a, id);
  assertVersion(r, b.version);
  assert(
    serviceView(s, a, r).canAddTask,
    403,
    "FORBIDDEN",
    "Không được thêm mục bàn giao.",
  );
  const ownerUid = s.employees[r.employeeId].uid;
  assert(
    b.owner !== "employee" || (!!ownerUid && s.memberships[ownerUid]?.active),
    409,
    "ACCOUNT_REQUIRED",
    "Nhân viên cần có tài khoản đang hoạt động để nhận mục bàn giao.",
  );
  assert(r.tasks.length < 30, 400, "TASK_LIMIT", "Tối đa 30 mục bàn giao.");
  r.tasks.push({
    id: randomUUID(),
    title: b.title,
    owner: b.owner,
    completedAt: "",
    completedBy: "",
    note: "",
  });
  changed(s, a, r, "task-added", b.title);
  return r;
}
export function updateServiceTask(
  s: State,
  a: Actor,
  id: string,
  b: { version: number; taskId: string; done: boolean; reason: string },
) {
  const r = serviceFor(s, a, id);
  assertVersion(r, b.version);
  const task = r.tasks.find((t) => t.id === b.taskId);
  assert(
    task &&
      r.section === "offboarding" &&
      r.status === "in_progress" &&
      taskAllowed(s, a, r, task),
    403,
    "FORBIDDEN",
    "Bạn không phụ trách mục bàn giao này.",
  );
  task.completedAt = b.done ? new Date().toISOString() : "";
  task.completedBy = b.done ? a.uid : "";
  task.note = b.reason;
  changed(s, a, r, b.done ? "task-completed" : "task-reopened", b.reason);
  return r;
}
export function authorizeServiceReplay(
  s: State,
  a: Actor,
  route: string,
  result: unknown,
  body?: unknown,
) {
  const id = (result as { id?: string })?.id;
  assert(id, 403, "REPLAY_FORBIDDEN", "Không còn quyền xem hồ sơ.");
  const r = serviceFor(s, a, id);
  const action = route.split("/")[3];
  if (!action || action === "tasks")
    assert(
      hr(s, a, r.employeeId),
      403,
      "FORBIDDEN",
      "Không còn quyền thực hiện.",
    );
  else if (
    ["acknowledge", "request-return", "submit-learning"].includes(action)
  )
    assert(
      a.employeeId === r.employeeId,
      403,
      "FORBIDDEN",
      "Không còn quyền thực hiện.",
    );
  else if (action === "task") {
    const task = r.tasks.find(
      (t) => t.id === (body as { taskId?: string })?.taskId,
    );
    assert(
      task && taskAllowed(s, a, r, task),
      403,
      "FORBIDDEN",
      "Không còn quyền thực hiện.",
    );
  } else
    assert(
      serviceManager(s, a, r.employeeId) &&
        (["accept-learning", "revise-learning"].includes(action) || isHR(a)),
      403,
      "FORBIDDEN",
      "Không còn quyền thực hiện.",
    );
}
