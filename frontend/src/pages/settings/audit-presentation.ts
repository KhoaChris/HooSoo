import { labels, type Audit } from "@hoosoo/shared";
import { dateText, timeText } from "../../utils/date-time";

export const auditActions: Record<string, string> = {
  "account.created": "Cấp tài khoản",
  "account.role": "Đổi vai trò",
  "account.status": "Thay đổi quyền truy cập",
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
  if (uid === "seed" || uid === "system") return "Hệ thống";
  return lookups.accounts[uid] || "Tài khoản chưa xác định";
}
export function auditCategory(action: string) {
  const prefix = action.split(".")[0];
  return (
    (
      {
        account: "Tài khoản",
        employee: "Hồ sơ nhân viên",
        profile: "Thông tin cá nhân",
        attendance: "Chấm công",
        leave: "Nghỉ phép",
        balance: "Quỹ phép",
        settings: "Doanh nghiệp & chính sách",
        departments: "Phòng ban",
        positions: "Chức danh",
        leave_type: "Loại nghỉ phép",
        seed: "Hệ thống",
      } as Record<string, string>
    )[prefix] || "Hoạt động khác"
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
    if (companyChanged && !policyChanged) return "Đổi tên doanh nghiệp";
    if (!companyChanged && policyChanged) return "Cập nhật chính sách nhân sự";
  }
  return auditActions[audit.action] || "Ghi nhận hoạt động";
}
function formatValue(
  key: string,
  value: unknown,
  lookups: AuditLookups,
): string {
  if (value === null || value === undefined || value === "") return "Chưa có";
  const text = String(value);
  if (key === "employeeId" || key === "managerId")
    return (
      lookups.employees[text] ||
      (key === "managerId" ? "Người quản lý trước đây" : "Nhân viên trước đây")
    );
  if (key === "departmentId")
    return lookups.departments[text] || "Phòng ban trước đây";
  if (key === "positionId")
    return lookups.positions[text] || "Chức danh trước đây";
  if (key === "active")
    return value === true
      ? "Được phép sử dụng"
      : value === false
        ? "Đã ngừng sử dụng"
        : "Chưa xác định";
  if (key === "deductsBalance")
    return value === true
      ? "Trừ vào phép năm"
      : value === false
        ? "Không trừ phép năm"
        : "Chưa xác định";
  if (key === "status" || key === "role")
    return labels[text] || "Chưa xác định";
  if (["days", "allowance", "annualAllowance", "amount"].includes(key))
    return typeof value === "number"
      ? `${key === "amount" && value > 0 ? "+" : ""}${value.toLocaleString("vi-VN")} ngày`
      : "Chưa xác định";
  if (key === "schedule.lateGraceMinutes") return `${text} phút`;
  if (key === "schedule.workDays")
    return Array.isArray(value)
      ? [1, 2, 3, 4, 5, 6, 0]
          .filter((day) => value.includes(day))
          .map((day) => (day === 0 ? "Chủ nhật" : `Thứ ${day + 1}`))
          .join(", ") || "Chưa thiết lập"
      : "Chưa thiết lập";
  if (key === "schedule.holidays")
    return Array.isArray(value)
      ? value
          .filter((v) => typeof v === "string")
          .map((v) => dateText(v))
          .join(", ") || "Không có"
      : "Không có";
  if (["startDate", "endDate", "hireDate"].includes(key))
    return Number.isNaN(Date.parse(text)) ? "Chưa xác định" : dateText(text);
  if (["checkIn", "checkOut"].includes(key))
    return Number.isNaN(Date.parse(text))
      ? "Chưa xác định"
      : `${timeText(text)} · ${dateText(text)}`;
  return typeof value === "string" || typeof value === "number"
    ? text
    : "Đã ghi nhận";
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
                label: "Vai trò",
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
        after: "Đã cập nhật",
      })),
      note: "Nhật ký chỉ ghi nhận thông tin nào được cập nhật, không lưu giá trị liên hệ trước và sau.",
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
            ? "Họ tên"
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
      !hasSnapshots && rows.length
        ? "Nội dung được ghi nhận tại thời điểm thực hiện; nhật ký này không lưu giá trị trước thay đổi."
        : "",
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
      "Tài khoản nhân viên"
    );
  if (
    audit.action.startsWith("employee.") ||
    audit.action === "profile.updated"
  )
    return lookups.employees[audit.targetId] || "Hồ sơ nhân viên";
  if (audit.action.startsWith("departments."))
    return lookups.departments[audit.targetId] || "Phòng ban";
  if (audit.action.startsWith("positions."))
    return lookups.positions[audit.targetId] || "Chức danh";
  if (audit.action.startsWith("leave.")) return "Đơn nghỉ phép";
  return auditCategory(audit.action);
}
export function auditSummary(audit: Audit, lookups: AuditLookups) {
  const { rows, comparison } = auditChanges(audit, lookups);
  if (comparison) return `${rows.length} thông tin thay đổi`;
  return (
    rows
      .slice(0, 2)
      .map((row) => `${row.label}: ${row.after}`)
      .join(" · ") || "Hoạt động đã được ghi nhận"
  );
}
