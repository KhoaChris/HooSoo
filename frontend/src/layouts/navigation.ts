import { compensationReaders } from "@hoosoo/shared";
import { WalletCards } from "lucide-react";
import { professionalRoles } from "@hoosoo/shared";
import { supervisorRoles } from "@hoosoo/shared";
import {
  Target,
  MessageCircle,
  LayoutDashboard,
  CalendarRange,
  FileText,
  UserRoundSearch,
  Users,
  Network,
  Clock,
  CalendarDays,
  ClipboardCheck,
  ChartNoAxesCombined,
  Settings,
  ShieldCheck,
  Activity,
  ScrollText,
  BriefcaseBusiness,
  Building2,
  UserRound,
} from "lucide-react";
import { roles, type Role } from "@hoosoo/shared";

const all: Role[] = [...roles],
  hr: Role[] = ["Admin", "HR"],
  supervisors: Role[] = supervisorRoles;
export const navigation = [
  {
    label: "Bản tin & chính sách",
    path: "/workforce/announcements",
    icon: FileText,
    roles: all,
  },
  {
    label: "Lịch & nhắc hạn",
    path: "/workforce/calendar",
    icon: CalendarDays,
    roles: all,
  },
  {
    label: "Bảo mật tài khoản",
    path: "/security",
    icon: ShieldCheck,
    roles: all,
  },
  {
    label: "Tài sản & phát triển của tôi",
    path: "/employee-services/my",
    icon: ClipboardCheck,
    roles: all,
  },
  {
    label: "Dịch vụ nhân sự",
    path: "/employee-services",
    icon: ClipboardCheck,
    roles: supervisors,
  },
  {
    label: "Tổng quan",
    path: "/dashboard",
    icon: LayoutDashboard,
    roles: all,
    group: "Không gian chung",
  },
  { label: "Tin nhắn", path: "/chat", icon: MessageCircle, roles: all },
  { label: "Sơ đồ tổ chức", path: "/organization", icon: Network, roles: all },
  {
    label: "Hồ sơ của tôi",
    path: "/profile",
    icon: UserRound,
    roles: all,
    group: "Cá nhân",
  },
  {
    label: "Chấm công của tôi",
    path: "/attendance/my",
    icon: Clock,
    roles: all,
  },
  {
    label: "Nghỉ phép của tôi",
    path: "/leave/my",
    icon: CalendarDays,
    roles: all,
  },
  {
    label: "Lịch làm việc của tôi",
    path: "/work-schedule",
    icon: CalendarRange,
    roles: all,
  },
  {
    label: "Phiếu đề nghị của tôi",
    path: "/requests/my",
    icon: FileText,
    roles: all,
  },
  {
    label: "Kết quả đánh giá",
    path: "/performance/my",
    icon: Target,
    roles: all,
  },
  {
    label: "Lương & phúc lợi của tôi",
    path: "/compensation/my",
    icon: WalletCards,
    roles: all,
  },
  {
    label: "Hành trình của tôi",
    path: "/employment/my",
    icon: ClipboardCheck,
    roles: all,
  },
  {
    label: "Vai trò & quyền truy cập",
    path: "/access",
    icon: ShieldCheck,
    roles: all,
  },
  {
    label: "Công việc chuyên môn",
    path: "/professional",
    icon: BriefcaseBusiness,
    roles: professionalRoles,
    group: "Chuyên môn",
  },
  {
    label: "Nhân viên",
    path: "/employees",
    icon: Users,
    roles: supervisors,
    group: "Quản lý nhân sự",
  },
  {
    label: "Đánh giá hiệu suất",
    path: "/performance",
    icon: Target,
    roles: supervisors,
  },
  {
    label: "Lương & phúc lợi",
    path: "/compensation",
    icon: WalletCards,
    roles: compensationReaders,
  },
  {
    label: "Vòng đời nhân sự",
    path: "/employment",
    icon: FileText,
    roles: supervisors,
  },
  { label: "Phòng ban", path: "/departments", icon: Building2, roles: hr },
  {
    label: "Chức danh",
    path: "/positions",
    icon: BriefcaseBusiness,
    roles: hr,
  },
  {
    label: "Bảng chấm công",
    path: "/attendance",
    icon: Clock,
    roles: supervisors,
  },
  {
    label: "Duyệt nghỉ phép",
    path: "/leave/approvals",
    icon: ClipboardCheck,
    roles: supervisors,
  },
  {
    label: "Duyệt lịch làm việc",
    path: "/work-schedule/approvals",
    icon: CalendarRange,
    roles: supervisors,
  },
  {
    label: "Duyệt phiếu đề nghị",
    path: "/requests/approvals",
    icon: FileText,
    roles: supervisors,
  },
  {
    label: "Theo dõi tuyển dụng",
    path: "/recruitment",
    icon: UserRoundSearch,
    roles: supervisors,
  },
  {
    label: "Báo cáo",
    path: "/reports",
    icon: ChartNoAxesCombined,
    roles: supervisors,
  },
  {
    label: "Chính sách nhân sự",
    path: "/settings/hr",
    icon: Settings,
    roles: hr,
  },
  {
    label: "Doanh nghiệp",
    path: "/settings",
    icon: Building2,
    roles: ["Admin"] as Role[],
    group: "Quản trị",
  },
  {
    label: "Tài khoản & quyền",
    path: "/settings/users",
    icon: ShieldCheck,
    roles: ["Admin"] as Role[],
  },
  {
    label: "Trạng thái hệ thống",
    path: "/settings/system",
    icon: Activity,
    roles: ["Admin"] as Role[],
  },
  {
    label: "Nhật ký thao tác",
    path: "/audit-logs",
    icon: ScrollText,
    roles: ["Admin"] as Role[],
  },
];

export const navigationGroups = [
  {
    id: "shared",
    label: "Không gian chung",
    paths: [
      "/dashboard",
      "/chat",
      "/organization",
      "/workforce/announcements",
      "/workforce/calendar",
    ],
    collapsible: false,
  },
  {
    id: "personal",
    label: "Cá nhân",
    paths: [
      "/profile",
      "/attendance/my",
      "/leave/my",
      "/work-schedule",
      "/requests/my",
      "/performance/my",
      "/compensation/my",
      "/employment/my",
      "/employee-services/my",
      "/access",
      "/security",
    ],
    collapsible: true,
  },
  {
    id: "professional",
    label: "Chuyên môn",
    paths: ["/professional"],
    collapsible: false,
  },
  {
    id: "people",
    label: "Hồ sơ & tổ chức",
    paths: ["/employees", "/departments", "/positions", "/employee-services"],
    collapsible: true,
    hr: true,
  },
  {
    id: "hiring",
    label: "Tuyển dụng & tiếp nhận",
    paths: ["/recruitment", "/employment"],
    collapsible: true,
    hr: true,
  },
  {
    id: "operations",
    label: "Thời gian & phê duyệt",
    paths: [
      "/attendance",
      "/leave/approvals",
      "/work-schedule/approvals",
      "/requests/approvals",
    ],
    collapsible: true,
    hr: true,
  },
  {
    id: "rewards",
    label: "Hiệu suất & đãi ngộ",
    paths: ["/performance", "/compensation", "/reports", "/settings/hr"],
    collapsible: true,
    hr: true,
  },
  {
    id: "admin",
    label: "Quản trị",
    paths: ["/settings", "/settings/users", "/settings/system", "/audit-logs"],
    collapsible: true,
  },
];
export function activeNavigation(pathname: string) {
  const aliases: Record<string, string> = {
    "/workforce/payroll": "/compensation",
    "/workforce/time": "/requests",
    "/workforce/changes": "/employees",
    "/workforce/documents": "/employees",
    "/workforce/imports": "/employees",
  };
  pathname = aliases[pathname] ?? pathname;
  return [...navigation]
    .sort((a, b) => b.path.length - a.path.length)
    .find(
      (item) => pathname === item.path || pathname.startsWith(item.path + "/"),
    );
}
export function navigationFor(role: Role) {
  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.paths.flatMap((path) =>
        navigation.filter(
          (item) => item.path === path && item.roles.includes(role),
        ),
      ),
    }))
    .filter((group) => group.items.length);
}
export function normalizeNavigationSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
}
