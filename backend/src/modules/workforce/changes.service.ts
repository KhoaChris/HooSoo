import {
  employeeSchema,
  type State,
  type Actor,
  type PersonnelChangeInput,
  type PersonnelChange,
  type PersonnelChangeView,
  type WorkforceAction,
} from "@hoosoo/shared";
import { saveEmployee } from "../employees/employees.service";
import { businessDate } from "../../utils/time";
import { assert, notFound } from "../../utils/errors";
import {
  allowed,
  change,
  expected,
  manages,
  record,
  stateIs,
  visible,
  digest,
} from "./core";
function proposal(s: State, r: PersonnelChangeInput) {
  const e = s.employees[r.employeeId];
  if (!e) notFound();
  return employeeSchema.parse({
    employeeCode: e.employeeCode,
    name: e.name,
    email: e.email,
    phone: e.phone,
    address: e.address,
    hireDate: e.hireDate,
    status: e.status,
    departmentId: r.departmentId,
    positionId: r.positionId,
    managerId: r.managerId,
  });
}
function validate(s: State, a: Actor, r: PersonnelChangeInput) {
  stateIs(s.employees[r.employeeId]?.status !== "terminated");
  const copy = structuredClone(s);
  saveEmployee(copy, a, proposal(s, r), r.employeeId);
  if (r.salaryRecordId)
    assert(
      s.compensationRecords[r.salaryRecordId]?.employeeId === r.employeeId &&
        s.compensationRecords[r.salaryRecordId].status === "published" &&
        s.compensationRecords[r.salaryRecordId].effectiveDate ===
          r.effectiveDate,
      400,
      "CHANGE_SALARY",
      "Chọn hồ sơ lương đã công bố của nhân viên, cùng ngày hiệu lực.",
    );
  if (r.contractId)
    assert(
      s.employmentContracts[r.contractId]?.employeeId === r.employeeId &&
        s.employmentContracts[r.contractId].status === "active",
      400,
      "CHANGE_CONTRACT",
      "Hợp đồng liên kết phải còn hiệu lực và thuộc nhân viên này.",
    );
}
export function changeActions(s: State, a: Actor, r: PersonnelChange) {
  if (!manages(s, a, r.employeeId)) return [];
  return r.status === "draft"
    ? ["edit", "submit", "cancel"]
    : r.status === "pending"
      ? [
          ...(a.uid !== (r.preparedBy ?? r.createdBy)
            ? ["approve", "reject"]
            : []),
          "cancel",
        ]
      : r.status === "approved"
        ? [...(r.effectiveDate <= businessDate() ? ["apply"] : []), "cancel"]
        : [];
}
export function changeView(
  s: State,
  a: Actor,
  r: PersonnelChange,
): PersonnelChangeView {
  allowed(visible(s, a, r.employeeId));
  return {
    ...r,
    employeeName: s.employees[r.employeeId].name,
    actions: changeActions(s, a, r),
  };
}
export function saveChange(
  s: State,
  a: Actor,
  input: PersonnelChangeInput,
  id?: string,
) {
  allowed(manages(s, a, input.employeeId));
  const old = id ? s.personnelChanges[id] : undefined;
  if (id && !old) notFound();
  expected(old, input.version);
  stateIs(
    !old || (old.status === "draft" && old.employeeId === input.employeeId),
  );
  assert(
    input.effectiveDate >= businessDate(),
    400,
    "CHANGE_DATE",
    "Ngày hiệu lực phải từ hôm nay trở đi.",
  );
  const e = s.employees[input.employeeId];
  stateIs(
    !Object.values(s.personnelChanges).some(
      (r) =>
        r.id !== id &&
        r.employeeId === e.id &&
        ["draft", "pending", "approved"].includes(r.status),
    ),
  );
  validate(s, a, input);
  const r: PersonnelChange = {
    ...(old ?? record(s, a, input.reason)),
    ...input,
    preparedBy: a.uid,
    status: "draft",
    before: {
      departmentId: e.departmentId,
      positionId: e.positionId,
      managerId: e.managerId,
    },
    approvedBy: "",
  };
  s.personnelChanges[r.id] = r;
  change(s, a, r, "change_saved", input.reason);
  return changeView(s, a, r);
}
export function actChange(
  s: State,
  a: Actor,
  id: string,
  action: string,
  input: WorkforceAction,
) {
  const r = s.personnelChanges[id];
  if (!r) notFound();
  allowed(changeActions(s, a, r).includes(action));
  expected(r, input.version);
  if (["submit", "approve", "apply"].includes(action)) {
    const e = s.employees[r.employeeId];
    assert(
      digest(r.before) ===
        digest({
          departmentId: e.departmentId,
          positionId: e.positionId,
          managerId: e.managerId,
        }),
      409,
      "CHANGE_STALE",
      "Thông tin công việc đã thay đổi. Hủy đề nghị cũ và tạo lại.",
    );
    validate(s, a, r);
  }
  if (action === "apply") {
    assert(
      r.effectiveDate <= businessDate(),
      409,
      "CHANGE_NOT_DUE",
      "Chưa đến ngày hiệu lực.",
    );
    saveEmployee(s, a, proposal(s, r), r.employeeId);
    r.status = "applied";
  } else if (action === "approve") {
    r.status = "approved";
    r.approvedBy = a.uid;
  } else
    r.status =
      action === "submit"
        ? "pending"
        : action === "reject"
          ? "rejected"
          : "cancelled";
  change(s, a, r, `change_${action}`, input.reason);
  return changeView(s, a, r);
}
