import type { Router } from "express";

export interface RouteGroup {
  id: string;
  name: string;
  router: Router;
}

type RegisteredLayer = {
  route?: { path: string; methods: Record<string, boolean> };
};

const resources: Record<string, string> = {
  "employee-services": "Tài sản, đào tạo & bàn giao",
  compensation: "Lương & phúc lợi",
  "admin-band": "Band lương Admin",
  records: "Hồ sơ lương",
  reviews: "Đánh giá hiệu suất",
  reports: "Báo cáo đánh giá",
  contracts: "Hợp đồng",
  probations: "Thử việc",
  onboarding: "Tiếp nhận",
  tasks: "Mục tiếp nhận",
  me: "Hồ sơ cá nhân",
  profile: "Thông tin cá nhân",
  background: "Học vấn, kinh nghiệm & kỹ năng",
  avatar: "Ảnh đại diện",
  users: "Tài khoản",
  employees: "Nhân viên",
  history: "Lịch sử thay đổi",
  departments: "Phòng ban",
  positions: "Chức danh",
  templates: "Chức danh ngành CNTT",
  dashboard: "Tổng quan",
  tree: "Sơ đồ tổ chức",
  attendance: "Chấm công",
  today: "Chấm công hôm nay",
  "check-in": "Vào ca",
  "check-out": "Kết thúc ca",
  adjustment: "Điều chỉnh chấm công",
  "leave-types": "Loại phép",
  "leave-requests": "Đơn nghỉ phép",
  "leave-balances": "Quỹ phép",
  adjustments: "Điều chỉnh quỹ phép",
  settings: "Thiết lập doanh nghiệp",
  "audit-logs": "Nhật ký thao tác",
  usage: "Thống kê sử dụng API",
  status: "Trạng thái",
  role: "Vai trò",
  export: "Xuất báo cáo CSV",
  leave: "Báo cáo nghỉ phép",
  balances: "Báo cáo quỹ phép",
  "work-registrations": "Lịch làm việc",
  "internal-requests": "Phiếu đề nghị",
  jobs: "Đợt tuyển dụng",
  candidates: "Ứng viên",
  evaluate: "Đánh giá ứng viên",
  move: "Chuyển vòng tuyển dụng",
  interview: "Đề xuất phỏng vấn",
  "confirm-interview": "Xác nhận phỏng vấn",
  hire: "Tuyển ứng viên",
  "direct-hire": "Tuyển thẳng",
  employee: "Tạo hồ sơ nhận việc",
  cv: "CV ứng viên",
  workspace: "Không gian chuyên môn",
  "work-items": "Công việc",
  people: "Danh bạ đồng nghiệp",
  rooms: "Cuộc trò chuyện",
  messages: "Tin nhắn",
  lifecycle: "Lưu trữ, rời hoặc giải tán nhóm",
  notifications: "Thông báo",
  events: "Luồng cập nhật SSE",
};
const actions: Record<string, string> = {
  "request-return": "Đề nghị thu hồi",
  "receive-return": "Xác nhận thu hồi",
  "submit-learning": "Gửi kết quả đào tạo",
  "accept-learning": "Công nhận hoàn thành",
  "revise-learning": "Yêu cầu bổ sung",
  task: "Xác nhận bàn giao",
  publish: "Công bố",
  finalize: "Chốt kết quả",
  launch: "Mở đánh giá",
  manager: "Đánh giá nhân viên",
  activate: "Phát hành",
  acknowledge: "Xác nhận đã nhận",
  end: "Kết thúc",
  review: "Đánh giá",
  "self-review": "Tự đánh giá",
  confirm: "Xác nhận",
  extend: "Gia hạn",
  decline: "Không đạt",
  approve: "Duyệt",
  reject: "Từ chối",
  cancel: "Hủy",
  submit: "Gửi duyệt",
  start: "Bắt đầu",
  complete: "Hoàn thành",
  return: "Trả lại",
  reopen: "Mở lại",
};

function titleFor(method: string, path: string) {
  const parts = path.split("/").filter((part) => part && !part.startsWith(":"));
  const last = parts.at(-1)!;
  if (path === "/system/status") return "Kiểm tra kết nối Firestore";
  if (actions[last])
    return `${actions[last]} · ${resources[parts.at(-2)!] ?? parts.at(-2)}`;
  const name = resources[last] ?? last;
  if (method === "GET")
    return path.includes("/reports/") ? `Báo cáo · ${name}` : name;
  if (
    [
      "evaluate",
      "move",
      "interview",
      "confirm-interview",
      "hire",
      "direct-hire",
      "employee",
      "check-in",
      "check-out",
      "adjustment",
      "adjustments",
    ].includes(last)
  )
    return name;
  return `${method === "POST" ? "Tạo" : "Cập nhật"} · ${name}`;
}

const pagination = ["page", "pageSize"];
const scope = ["departmentId", "employeeId", "positionId"];
const dates = ["startDate", "endDate"];
function queriesFor(path: string): string[] {
  if (path === "/employee-services") return ["section", "scope"];
  if (path === "/compensation") return ["scope", "employeeId"];
  if (path.startsWith("/employment/") || path === "/performance/reviews")
    return ["scope"];
  if (path.endsWith("/messages")) return ["after", "before"];
  if (["/work-registrations", "/internal-requests"].includes(path))
    return ["approvals", ...dates];
  if (path === "/audit-logs") return [...pagination, "search", ...dates];
  if (path === "/dashboard") return [...dates, "year", ...scope];
  if (["/departments", "/positions", "/leave-types"].includes(path))
    return pagination;
  if (["/employees", "/reports/employees"].includes(path))
    return [...pagination, "search", ...scope, "status"];
  if (["/attendance", "/reports/attendance"].includes(path))
    return [...pagination, ...dates, ...scope, "status", "mine"];
  if (["/leave-requests", "/reports/leave"].includes(path))
    return [...pagination, ...dates, ...scope, "status", "mine", "approvals"];
  if (["/leave-balances", "/reports/balances"].includes(path))
    return [...pagination, "year", ...scope, "mine"];
  if (path === "/reports/export")
    return ["kind", ...scope, ...dates, "year", "status", "search"];
  return [];
}

function describeRoute(
  method: string,
  path: string,
  group: string,
  isPublic = false,
) {
  const stream = path === "/events";
  const readiness = path === "/api/ready" || path === "/system/status";
  const health = path === "/api/health";
  const fullPath = isPublic ? path : `/api/v1${path}`;
  const adminOnly =
    path.startsWith("/users") ||
    path === "/audit-logs" ||
    path.startsWith("/system/");
  const queryParameters = method === "GET" ? queriesFor(path) : [];
  return {
    id: `${method} ${fullPath}`,
    method,
    path: fullPath,
    group,
    title: health
      ? "Kiểm tra API"
      : isPublic
        ? "Kiểm tra kết nối Firestore"
        : titleFor(method, path),
    authentication: isPublic ? "public" : "bearer",
    access: isPublic
      ? "Công khai"
      : adminOnly
        ? "Quản trị viên"
        : "Theo vai trò & phạm vi được cấp",
    effect: health
      ? "none"
      : stream
        ? "stream"
        : method === "GET"
          ? "read"
          : "write",
    note: health
      ? "Chỉ kiểm tra tiến trình API. Không đọc Firestore."
      : readiness
        ? "Có kiểm tra Firestore trực tiếp khi gửi yêu cầu."
        : stream
          ? "Kết nối cập nhật liên tục. Trang này không mở luồng SSE."
          : method === "GET"
            ? "Có thể đọc Firestore khi cần. Áp dụng cache và phân quyền hiện có."
            : "Thay đổi dữ liệu thật. Thực hiện qua ứng dụng hoặc API client.",
    testable: method === "GET" && !stream,
    queryParameters,
    idempotency: !isPublic && method !== "GET",
    response: stream
      ? "text/event-stream"
      : path.endsWith("/cv") && method === "GET"
        ? "application/pdf"
        : path.endsWith("/export")
          ? "text/csv"
          : "application/json",
    bodyType:
      method === "GET"
        ? null
        : path.endsWith("/cv")
          ? "application/pdf"
          : "application/json",
  };
}

export function createCatalog(groups: RouteGroup[]) {
  const routes = [
    describeRoute("GET", "/api/health", "system", true),
    describeRoute("GET", "/api/ready", "system", true),
    ...groups.flatMap((group) =>
      (group.router.stack as RegisteredLayer[]).flatMap((layer) => {
        if (!layer.route) return [];
        return Object.entries(layer.route.methods)
          .filter(([, enabled]) => enabled)
          .map(([method]) =>
            describeRoute(method.toUpperCase(), layer.route!.path, group.id),
          );
      }),
    ),
  ];
  return {
    version: "v1",
    groups: [
      { id: "system", name: "Kết nối hệ thống" },
      ...groups.map(({ id, name }) => ({ id, name })),
    ].map((group) => ({
      ...group,
      count: routes.filter((r) => r.group === group.id).length,
    })),
    routes,
  };
}
