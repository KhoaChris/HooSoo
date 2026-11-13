import {
  candidateHireSchema,
  employeeSchema,
  type State,
  type Actor,
  type Candidate,
  type RecruitmentJob,
  type CandidateHireInput,
} from "@hoosoo/shared";
import { saveEmployee } from "../employees/employees.service";
import { assert } from "../../utils/errors";

// Runs inside the same command transaction as the hiring decision. A linked
// employee is never overwritten or provisioned with login/access permissions.
export function createHiredEmployee(
  s: State,
  a: Actor,
  c: Candidate,
  job: RecruitmentJob,
  input: CandidateHireInput,
) {
  assert(
    !c.employeeId,
    409,
    "EMPLOYEE_ALREADY_CREATED",
    "Ứng viên đã có hồ sơ nhân viên. Mở hồ sơ để chỉnh sửa thông tin.",
  );
  const hire = candidateHireSchema.parse(input);
  const emails = new Set([c.email.toLowerCase(), hire.workEmail]);
  assert(
    !Object.values(s.employees).some(
      (e) =>
        e.recruitmentCandidateId === c.id || emails.has(e.email.toLowerCase()),
    ),
    409,
    "EMPLOYEE_ALREADY_EXISTS",
    "Email này đã gắn với hồ sơ nhân viên. Kiểm tra hồ sơ hiện có để tránh tạo trùng.",
  );
  const manager = s.employees[job.hiringManagerId];
  assert(
    manager?.uid && s.memberships[manager.uid]?.active,
    409,
    "HIRING_MANAGER_UNAVAILABLE",
    "Người phụ trách tuyển dụng không còn tài khoản quản lý hoạt động. Cập nhật người phụ trách trước khi tạo hồ sơ.",
  );
  const employee = saveEmployee(
    s,
    a,
    employeeSchema.parse({
      name: c.name,
      email: hire.workEmail,
      phone: c.phone,
      address: c.address,
      departmentId: job.departmentId,
      positionId: hire.positionId,
      managerId: job.hiringManagerId,
      hireDate: hire.hireDate,
      status: hire.employmentStatus,
    }),
  );
  employee.recruitmentCandidateId = c.id;
  c.employeeId = employee.id;
  return employee;
}
