import { Router } from "express";
import { handlers, query, context } from "../../routes/helpers";
import type { State, Actor, Query, Table } from "@hoosoo/shared";
import { requireRole } from "../../common/authorization";
import { paginate } from "../../common/query";
import { employeeList } from "../employees/employees.queries";
import { attendanceList } from "../attendance/attendance.queries";
import { leaveList } from "../leave/leave.queries";
import { balanceList } from "../leave/balances.queries";
import { AppError, assert } from "../../utils/errors";
import { csv } from "../../utils/time";

export const reportsRoutes = Router();
const api = reportsRoutes;
const { get } = handlers(api);
function reportTables(kind: string): Table[] {
  switch (kind) {
    case "employees":
      return ["departments", "positions"];
    case "attendance":
      return ["attendanceRecords", "leaveRequests"];
    case "leave":
      return ["leaveRequests"];
    case "balances":
      return [
        "settings",
        "leaveBalances",
        "leaveRequests",
        "leaveBalanceTransactions",
      ];
    default:
      throw new AppError(400, "INVALID_REPORT", "Loại báo cáo không hợp lệ.");
  }
}
function report(s: State, a: Actor, q: Query, kind: string) {
  requireRole(a, ["Admin", "HR", "Manager"]);
  switch (kind) {
    case "employees":
      return employeeList(s, a, q);
    case "attendance":
      return attendanceList(s, a, q);
    case "leave":
      return leaveList(s, a, q);
    case "balances":
      return balanceList(s, a, q);
    default:
      throw new AppError(400, "INVALID_REPORT", "Loại báo cáo không hợp lệ.");
  }
}
api.get("/reports/export", async (req, res) => {
  const q = query(req),
    kind = q.kind || "employees";
  const { s, a } = await context(res, reportTables(kind), false, {
    path: "/reports/" + kind,
    query: q,
    params: {},
  });
  const rows = report(s, a, q, kind);
  assert(
    rows.length <= 5000,
    400,
    "EXPORT_TOO_LARGE",
    "Tối đa 5.000 dòng; hãy thu hẹp bộ lọc.",
  );
  const flat = rows.map((r) => {
    if ("checkIn" in r)
      return {
        "Mã nhân viên": r.employeeCode,
        "Họ tên": r.employeeName,
        Ngày: r.date,
        "Giờ vào": r.checkIn,
        "Giờ ra": r.checkOut,
        "Phút hiện diện": r.presenceMinutes,
        "Phút tính công": r.paidMinutes,
        "Trạng thái": r.status,
      };
    if ("workDates" in r)
      return {
        "Mã nhân viên": r.employeeCode,
        "Họ tên": r.employeeName,
        "Loại phép": r.typeName,
        "Từ ngày": r.startDate,
        "Đến ngày": r.endDate,
        "Số ngày": r.days,
        "Trạng thái": r.status,
      };
    if ("allowance" in r)
      return {
        "Họ tên": r.employeeName,
        Năm: r.year,
        "Hạn mức": r.allowance,
        "Đã dùng": r.used,
        "Chờ duyệt": r.pending,
        "Còn khả dụng": r.available,
      };
    return {
      "Mã nhân viên": r.employeeCode,
      "Họ tên": r.name,
      "Email công việc": r.email,
      "Phòng ban": s.departments[r.departmentId]?.name,
      "Chức danh": s.positions[r.positionId]?.name,
      "Trạng thái": r.status,
    };
  });
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="hoosoo-${kind}.csv"`,
  );
  res.type("text/csv; charset=utf-8").send(csv(flat));
});
for (const kind of ["employees", "attendance", "leave", "balances"])
  get("/reports/" + kind, reportTables(kind), (s, a, q) => {
    const rows = report(s, a, q, kind);
    return {
      ...paginate<unknown>(rows, q),
      summary: { total: rows.length },
      exportScope: "Toàn bộ kết quả đã lọc, tối đa 5.000 dòng",
    };
  });
