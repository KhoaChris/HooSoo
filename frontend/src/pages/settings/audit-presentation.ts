import { weekdayLabel } from "../../i18n/preferences";
import { t } from "../../i18n";
import {
  workKindLabels,
  workStatusLabels,
  labels,
  workflowLabels,
  requestLabels,
  type Audit,
} from "@hoosoo/shared";
import { dateText, timeText } from "../../utils/date-time";

export const auditActions: Record<string, string> = {
  "work.submitted": "Gửi lịch làm việc",
  "work.approve": "Duyệt lịch làm việc",
  "work.reject": "Từ chối lịch làm việc",
  "work.cancel": "Rút lịch làm việc",
  "request.submitted": "Gửi phiếu đề nghị",
  "request.approve": "Duyệt phiếu đề nghị",
  "request.reject": "Từ chối phiếu đề nghị",
  "request.cancel": "Rút phiếu đề nghị",
  "recruitment.employee_created": "Tạo hồ sơ nhân viên từ tuyển dụng",
  "recruitment.updated": "Cập nhật hồ sơ ứng viên",
  "recruitment.job_saved": "Cập nhật đợt tuyển dụng",
  "recruitment.created": "Tiếp nhận ứng viên",
  "recruitment.passed": "Đánh giá đạt vòng tuyển dụng",
  "recruitment.failed": "Đánh giá chưa đạt vòng tuyển dụng",
  "recruitment.moved": "Chuyển vòng tuyển dụng",
  "recruitment.interview_scheduled": "Đề xuất lịch phỏng vấn",
  "recruitment.interview_confirmed": "Duyệt lịch phỏng vấn",
  "recruitment.hired": "Xác nhận trúng tuyển",
  "recruitment.direct_hired": "Tuyển thẳng ứng viên",
  "recruitment.rejected": "Dừng tuyển dụng ứng viên",
  "recruitment.cv_uploaded": "Cập nhật CV ứng viên",
  "account.created": "Cấp tài khoản",
  "account.role": "Đổi vai trò",
  "positions.templates": "Bổ sung chức danh CNTT",
  "professional.created": "Tạo công việc chuyên môn",
  "professional.updated": "Cập nhật công việc chuyên môn",
  "professional.start": "Bắt đầu công việc",
  "professional.submit": "Gửi công việc rà soát",
  "professional.approve": "Nghiệm thu công việc",
  "professional.return": "Yêu cầu bổ sung công việc",
  "professional.cancel": "Hủy công việc",
  "account.status": "Thay đổi quyền truy cập",
  "employee.avatar_updated": "Đổi ảnh đại diện",
  "employee.avatar_removed": "Gỡ ảnh đại diện",
  "employee.created": "Tạo hồ sơ nhân viên",
  "employee.updated": "Cập nhật hồ sơ nhân viên",
  "attendance.adjusted": "Điều chỉnh chấm công",
  "attendance.check_in": "Vào ca",
  "attendance.check_out": "Kết thúc ca",
  "leave.created": "Tạo đơn nghỉ phép",
  "leave.approve": "Duyệt đơn nghỉ phép",
  "leave.reject": "Từ chối đơn nghỉ phép",
  "leave.cancel": "Hủy đơn nghỉ phép",
  "balance.adjusted": "Điều chỉnh quỹ phép",
  "settings.updated": "Cập nhật thông tin & chính sách",
  "profile.updated": "Cập nhật thông tin liên hệ",
  "departments.saved": "Lưu phòng ban",
  "positions.saved": "Lưu chức danh",
  "departments.status": "Thay đổi trạng thái phòng ban",
  "positions.status": "Thay đổi trạng thái chức danh",
  "leave_type.updated": "Cập nhật loại nghỉ phép",
  "seed.initialized": "Khởi tạo dữ liệu",
};
export type AuditLookups = {
  employees: Record<string, string>;
  accounts: Record<string, string>;
  departments: Record<string, string>;
  positions: Record<string, string>;
};
export type AuditChange = {
  key: string;
  label: string;
  before?: string;
  after: string;
};
const fieldLabels: Record<string, string> = {
  title: "Tiêu đề",
  kind: "Loại công việc / đề nghị",
  assignee: "Người phụ trách",
  added: "Chức danh được bổ sung",
  date: "Ngày làm việc",
  start: "Giờ bắt đầu",
  end: "Giờ kết thúc",
  stage: "Vòng tuyển dụng",
  job: "Vị trí tuyển dụng",
  rounds: "Các vòng tuyển dụng",
  name: "Tên",
  employeeCode: "Mã nhân viên",
  employeeId: "Nhân viên",
  departmentId: "Phòng ban",
  positionId: "Chức danh",
  managerId: "Người quản lý",
  hireDate: "Ngày vào làm",
  status: "Trạng thái",
  role: "Vai trò",
  active: "Quyền sử dụng",
  days: "Số ngày nghỉ",
  startDate: "Ngày bắt đầu nghỉ",
  endDate: "Ngày kết thúc nghỉ",
  checkIn: "Giờ vào ca",
  checkOut: "Giờ kết thúc ca",
  amount: "Điều chỉnh hạn mức",
  allowance: "Hạn mức sau điều chỉnh",
  annualAllowance: "Phép năm ban đầu",
  companyName: "Tên doanh nghiệp",
  deductsBalance: "Sử dụng quỹ phép",
  "schedule.start": "Bắt đầu ca",
  "schedule.end": "Kết thúc ca",
  "schedule.breakStart": "Bắt đầu nghỉ giữa ca",
  "schedule.breakEnd": "Kết thúc nghỉ giữa ca",
  "schedule.lateGraceMinutes": "Ngưỡng đi muộn",
  "schedule.workDays": "Ngày làm việc",
  "schedule.holidays": "Ngày nghỉ lễ",
};
const contactLabels: Record<string, string> = {
  phone: "Số điện thoại",
  address: "Địa chỉ",
};
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const at = (v: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((value, key) => record(value)[key], v);

export function auditActor(uid: string, lookups: AuditLookups) {
  if (uid === "seed" || uid === "system") return t("Hệ thống");
  return lookups.accounts[uid] || t("Tài khoản chưa xác định");
}
export function auditCategory(action: string) {
  const prefix = action.split(".")[0];
  return (
    (
      {
        professional: t("Công việc chuyên môn"),
        work: t("Lịch làm việc"),
        request: t("Phiếu đề nghị"),
        recruitment: t("Tuyển dụng"),
        account: t("Tài khoản"),
        employee: t("Hồ sơ nhân viên"),
        profile: t("Thông tin cá nhân"),
        attendance: t("Chấm công"),
        leave: t("Nghỉ phép"),
        balance: t("Quỹ phép"),
        settings: t("Doanh nghiệp & chính sách"),
        departments: t("Phòng ban"),
        positions: t("Chức danh"),
        leave_type: t("Loại nghỉ phép"),
        seed: t("Hệ thống"),
      } as Record<string, string>
    )[prefix] || t("Hoạt động khác")
  );
}
export function auditTitle(audit: Audit) {
  if (audit.action === "settings.updated") {
    const c = audit.changes;
    const companyChanged =
      at(c.before, "companyName") !== at(c.after, "companyName");
    const policyChanged =
      JSON.stringify(at(c.before, "schedule")) !==
        JSON.stringify(at(c.after, "schedule")) ||
      at(c.before, "annualAllowance") !== at(c.after, "annualAllowance");
    if (companyChanged && !policyChanged) return t("Đổi tên doanh nghiệp");
    if (!companyChanged && policyChanged)
      return t("Cập nhật chính sách nhân sự");
  }
  return t(auditActions[audit.action]) || t("Ghi nhận hoạt động");
}
function formatValue(
  key: string,
  value: unknown,
  lookups: AuditLookups,
): string {
  if (value === null || value === undefined || value === "")
    return t("Chưa có");
  const text = String(value);
  if (key === "employeeId" || key === "managerId")
    return (
      lookups.employees[text] ||
      (key === "managerId"
        ? t("Người quản lý trước đây")
        : t("Nhân viên trước đây"))
    );
  if (key === "departmentId")
    return lookups.departments[text] || t("Phòng ban trước đây");
  if (key === "positionId")
    return lookups.positions[text] || t("Chức danh trước đây");
  if (key === "active")
    return value === true
      ? t("Được phép sử dụng")
      : value === false
        ? t("Đã ngừng sử dụng")
        : t("Chưa xác định");
  if (key === "deductsBalance")
    return value === true
      ? t("Trừ vào phép năm")
      : value === false
        ? t("Không trừ phép năm")
        : t("Chưa xác định");
  if (key === "status" || key === "role")
    return (
      (workStatusLabels as Record<string, string>)[text] ||
      t(workflowLabels[text]) ||
      t(labels[text]) ||
      t("Chưa xác định")
    );
  if (key === "kind" && text in workKindLabels)
    return t(workKindLabels[text as keyof typeof workKindLabels]);
  if (key === "kind")
    return (
      t(requestLabels[text as keyof typeof requestLabels]) ||
      t("Đề nghị nội bộ")
    );
  if (key === "added" && Array.isArray(value))
    return value.length
      ? value.filter((v) => typeof v === "string").join(", ")
      : t("Không có chức danh mới");
  if (key === "rounds" && Array.isArray(value))
    return value.filter((v) => typeof v === "string").join(" → ");
  if (["days", "allowance", "annualAllowance", "amount"].includes(key))
    return typeof value === "number"
      ? t("{0}{1} ngày", [
          key === "amount" && value > 0 ? "+" : "",
          value.toLocaleString("vi-VN"),
        ])
      : t("Chưa xác định");
  if (key === "schedule.lateGraceMinutes") return t("{0} phút", [text]);
  if (key === "schedule.workDays")
    return Array.isArray(value)
      ? [1, 2, 3, 4, 5, 6, 0]
          .filter((day) => value.includes(day))
          .map((day) => weekdayLabel(day))
          .join(", ") || t("Chưa thiết lập")
      : t("Chưa thiết lập");
  if (key === "schedule.holidays")
    return Array.isArray(value)
      ? value
          .filter((v) => typeof v === "string")
          .map((v) => dateText(v))
          .join(", ") || t("Không có")
      : t("Không có");
  if (["date", "startDate", "endDate", "hireDate"].includes(key))
    return Number.isNaN(Date.parse(text)) ? t("Chưa xác định") : dateText(text);
  if (["checkIn", "checkOut"].includes(key))
    return Number.isNaN(Date.parse(text))
      ? t("Chưa xác định")
      : `${timeText(text)} · ${dateText(text)}`;
  return typeof value === "string" || typeof value === "number"
    ? text
    : t("Đã ghi nhận");
}

// Only known business fields are presented. Unknown/internal payloads never become UI copy.
export function auditChanges(
  audit: Audit,
  lookups: AuditLookups,
): { rows: AuditChange[]; comparison: boolean; note: string } {
  const changes = audit.changes || {};
  if (audit.action === "account.role")
    return {
      comparison: changes.before !== undefined,
      note: "",
      rows:
        changes.after === undefined
          ? []
          : [
              {
                key: "role",
                label: t("Vai trò"),
                ...(changes.before !== undefined
                  ? { before: formatValue("role", changes.before, lookups) }
                  : {}),
                after: formatValue("role", changes.after, lookups),
              },
            ],
    };
  if (audit.action === "profile.updated") {
    const fields = Array.isArray(changes.fields)
      ? changes.fields.filter(
          (f): f is string => typeof f === "string" && !!contactLabels[f],
        )
      : [];
    return {
      comparison: false,
      rows: fields.map((key) => ({
        key,
        label: contactLabels[key],
        after: t("Đã cập nhật"),
      })),
      note: t("Không lưu giá trị liên hệ trước và sau."),
    };
  }
  const hasSnapshots = Object.hasOwn(changes, "after");
  const comparison =
    hasSnapshots &&
    changes.before !== null &&
    typeof changes.before === "object";
  const before = record(changes.before),
    after = hasSnapshots ? record(changes.after) : changes;
  const rows = Object.entries(fieldLabels).flatMap(([key, label]) => {
    const prev = at(before, key),
      next = at(after, key);
    if (next === undefined && prev === undefined) return [];
    if (hasSnapshots && JSON.stringify(prev) === JSON.stringify(next))
      return [];
    return [
      {
        key,
        label:
          key === "name" && audit.action.startsWith("employee.")
            ? t("Họ tên")
            : label,
        ...(comparison ? { before: formatValue(key, prev, lookups) } : {}),
        after: formatValue(key, next, lookups),
      },
    ];
  });
  return {
    rows,
    comparison,
    note:
      !hasSnapshots && rows.length ? t("Không có dữ liệu trước thay đổi.") : "",
  };
}
export function auditSubject(audit: Audit, lookups: AuditLookups) {
  const c = audit.changes;
  const name = at(c.after, "name") ?? c.name ?? at(c.before, "name");
  if (typeof name === "string" && name) return name;
  if (audit.action.startsWith("account."))
    return (
      lookups.accounts[audit.targetId] ||
      lookups.employees[String(c.employeeId)] ||
      t("Tài khoản nhân viên")
    );
  if (
    audit.action.startsWith("employee.") ||
    audit.action === "profile.updated"
  )
    return lookups.employees[audit.targetId] || t("Hồ sơ nhân viên");
  if (audit.action.startsWith("departments."))
    return lookups.departments[audit.targetId] || t("Phòng ban");
  if (audit.action.startsWith("positions."))
    return lookups.positions[audit.targetId] || t("Chức danh");
  if (audit.action.startsWith("leave.")) return t("Đơn nghỉ phép");
  return auditCategory(audit.action);
}
export function auditSummary(audit: Audit, lookups: AuditLookups) {
  const { rows, comparison } = auditChanges(audit, lookups);
  if (comparison) return t("{0} thông tin thay đổi", [rows.length]);
  return (
    rows
      .slice(0, 2)
      .map((row) => `${row.label}: ${row.after}`)
      .join(" · ") || t("Hoạt động đã được ghi nhận")
  );
}
