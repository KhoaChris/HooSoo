import { randomUUID } from "node:crypto";
import {
  compensationReaders,
  compensationWriters,
  compensationPhase,
  roleDefinitions,
  type Actor,
  type State,
  type CompensationRecord,
  type CompensationSetup,
  type CompensationActionInput,
  type CompensationPerson,
} from "@hoosoo/shared";
import { employeeRole, inScope } from "../../common/authorization";
import { assert, notFound } from "../../utils/errors";
import { event, assertVersion } from "../workflows/approval";
import { audit } from "../../common/audit";
import { businessDate } from "../../utils/time";

function below(s: State, a: Actor, employeeId: string) {
  const role = employeeRole(s, employeeId),
    employee = s.employees[employeeId];
  return (
    !!employee &&
    employeeId !== a.employeeId &&
    role !== null &&
    roleDefinitions[a.role].rank > roleDefinitions[role].rank &&
    inScope(s, a, employee)
  );
}
export function canReadCompensation(s: State, a: Actor, employeeId: string) {
  return (
    !!s.employees[employeeId] &&
    (a.employeeId === employeeId ||
      (compensationReaders.includes(a.role) && below(s, a, employeeId)))
  );
}
export function canManageCompensation(s: State, a: Actor, employeeId: string) {
  return (
    compensationWriters.includes(a.role) &&
    below(s, a, employeeId) &&
    s.employees[employeeId].status !== "terminated"
  );
}
export function assertManageCompensation(
  s: State,
  a: Actor,
  employeeId: string,
) {
  assert(
    canManageCompensation(s, a, employeeId),
    403,
    "COMPENSATION_FORBIDDEN",
    "Bạn không được cập nhật lương của bản thân, cấp ngang hàng, cấp trên hoặc ngoài phạm vi phụ trách.",
  );
}
function recordsFor(s: State, employeeId: string) {
  return Object.values(s.compensationRecords).filter(
    (r) => r.employeeId === employeeId,
  );
}
function changed(
  s: State,
  a: Actor,
  record: CompensationRecord,
  action: string,
  reason: string,
) {
  record.version++;
  record.updatedAt = new Date().toISOString();
  record.history.push(event(s, a, action, reason));
  // Financial values and private explanations stay in the protected record.
  audit(
    s,
    a,
    `compensation.${action}`,
    record.id,
    { employeeId: record.employeeId, version: record.version },
    "",
  );
}
function validDate(s: State, r: CompensationSetup, today = businessDate()) {
  assert(
    r.effectiveDate >= s.employees[r.employeeId].hireDate,
    400,
    "COMPENSATION_DATE",
    "Ngày hiệu lực không được trước ngày vào làm.",
  );
  const published = recordsFor(s, r.employeeId).filter(
    (x) => x.status === "published",
  );
  assert(
    !published.length || r.effectiveDate >= today,
    409,
    "COMPENSATION_DATE",
    "Điều chỉnh mới phải có hiệu lực từ hôm nay trở đi.",
  );
}
export function saveCompensation(
  s: State,
  a: Actor,
  input: CompensationSetup,
  id?: string,
) {
  const old = id ? s.compensationRecords[id] : undefined;
  if (id && !old) notFound();
  assertManageCompensation(s, a, old?.employeeId ?? input.employeeId);
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
      "COMPENSATION_LOCKED",
      "Hồ sơ đã công bố. Tạo điều chỉnh mới để lưu lịch sử.",
    );
    assertVersion(old, input.version);
  } else
    assert(input.version === 0, 409, "VERSION_CONFLICT", "Hồ sơ đã thay đổi.");
  validDate(s, input);
  const record: CompensationRecord = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    createdBy: a.uid,
    history: [],
    sourceCandidateId: "",
    ...old,
    ...input,
    version: old?.version ?? 0,
    status: "draft",
  };
  changed(s, a, record, old ? "updated" : "created", input.reason);
  s.compensationRecords[record.id] = record;
  return record;
}
export function compensationAction(
  s: State,
  a: Actor,
  id: string,
  action: "publish" | "cancel",
  input: CompensationActionInput,
) {
  const record = s.compensationRecords[id];
  if (!record) notFound();
  assertManageCompensation(s, a, record.employeeId);
  assertVersion(record, input.version);
  if (action === "publish") {
    assert(
      record.status === "draft",
      409,
      "COMPENSATION_LOCKED",
      "Chỉ công bố hồ sơ nháp.",
    );
    validDate(s, record);
    assert(
      !recordsFor(s, record.employeeId).some(
        (r) =>
          r.id !== id &&
          r.status === "published" &&
          r.effectiveDate === record.effectiveDate,
      ),
      409,
      "COMPENSATION_DATE_CONFLICT",
      "Đã có mức lương được công bố cho ngày hiệu lực này.",
    );
    record.status = "published";
  } else {
    assert(
      record.status === "draft" ||
        (record.status === "published" &&
          record.effectiveDate > businessDate()),
      409,
      "COMPENSATION_LOCKED",
      "Chỉ hủy hồ sơ nháp hoặc điều chỉnh chưa có hiệu lực.",
    );
    record.status = "cancelled";
  }
  changed(s, a, record, action, input.reason);
  return record;
}
export function compensationPerson(
  s: State,
  a: Actor,
  employeeId: string,
): CompensationPerson {
  if (!canReadCompensation(s, a, employeeId)) notFound();
  const employee = s.employees[employeeId],
    canManage = canManageCompensation(s, a, employeeId),
    today = businessDate();
  const records = recordsFor(s, employeeId);
  return {
    id: employee.id,
    name: employee.name,
    employeeCode: employee.employeeCode,
    status: employee.status,
    hireDate: employee.hireDate,
    canManage,
    records: records
      .filter((r) => r.status === "published" || canManage)
      .map((r) => ({
        ...r,
        phase: compensationPhase(r, records, today),
        canEdit: canManage && r.status === "draft",
        canPublish: canManage && r.status === "draft",
        canCancel:
          canManage &&
          (r.status === "draft" ||
            (r.status === "published" && r.effectiveDate > today)),
      }))
      .sort(
        (x, y) =>
          y.effectiveDate.localeCompare(x.effectiveDate) ||
          (y.createdAt ?? "").localeCompare(x.createdAt ?? ""),
      ),
  };
}
export function authorizeCompensationReplay(
  s: State,
  a: Actor,
  result: unknown,
) {
  const id = (result as { id?: string })?.id,
    record = id ? s.compensationRecords[id] : undefined;
  assert(
    record,
    403,
    "REPLAY_FORBIDDEN",
    "Không còn quyền truy cập hồ sơ lương.",
  );
  assertManageCompensation(s, a, record.employeeId);
}
