/** Access roles are assigned by Admin. A display job title never grants access. */
export const roles = [
  "Admin",
  "Director",
  "HR",
  "Manager",
  "DeputyManager",
  "ProjectManager",
  "TeamLead",
  "Developer",
  "QA",
  "QC",
  "BA",
  "Designer",
  "DevOps",
  "Employee",
] as const;
export type Role = (typeof roles)[number];
export type AccessScope = "organization" | "department" | "reports" | "self";
export type WorkArea =
  "delivery" | "engineering" | "quality" | "analysis" | "design" | "operations";
export interface RoleDefinition {
  label: string;
  rank: number;
  scope: AccessScope;
  description: string;
  areas: readonly WorkArea[];
}
export const workAreas: Record<WorkArea, string> = {
  delivery: "Điều phối dự án",
  engineering: "Phát triển phần mềm",
  quality: "Đảm bảo chất lượng",
  analysis: "Phân tích nghiệp vụ",
  design: "Thiết kế sản phẩm",
  operations: "Vận hành kỹ thuật",
};
const allAreas = Object.keys(workAreas) as WorkArea[];
export const roleDefinitions: Record<Role, RoleDefinition> = {
  Admin: {
    label: "Quản trị viên",
    rank: 100,
    scope: "organization",
    description:
      "Quản trị cao nhất: tài khoản, phân quyền, hạ tầng và dữ liệu toàn hệ thống.",
    areas: allAreas,
  },
  Director: {
    label: "Giám đốc phòng ban",
    rank: 90,
    scope: "department",
    description:
      "Theo dõi phòng ban, duyệt cấp dưới, giám sát tuyển dụng và công việc chuyên môn. Không quản trị tài khoản.",
    areas: allAreas,
  },
  HR: {
    label: "Nhân sự",
    rank: 80,
    scope: "organization",
    description:
      "Quản lý nghiệp vụ nhân sự toàn doanh nghiệp; chỉ sửa và xử lý hồ sơ cấp thấp hơn. Không sửa Admin, Giám đốc hoặc cấp ngang hàng.",
    areas: [],
  },
  Manager: {
    label: "Trưởng phòng",
    rank: 80,
    scope: "department",
    description:
      "Theo dõi phòng ban, duyệt cấp dưới và điều phối chuyên môn; không sửa hồ sơ nhân sự hay phân quyền.",
    areas: allAreas,
  },
  DeputyManager: {
    label: "Phó phòng",
    rank: 70,
    scope: "reports",
    description:
      "Theo dõi và duyệt nhân viên trực thuộc được phân công; điều phối công việc trong nhóm phụ trách.",
    areas: allAreas,
  },
  ProjectManager: {
    label: "Quản lý dự án (PM)",
    rank: 60,
    scope: "reports",
    description:
      "Điều phối bàn giao, tiến độ và công việc của nhân viên trực thuộc; không có quyền quản trị nhân sự.",
    areas: allAreas,
  },
  TeamLead: {
    label: "Trưởng nhóm / Tech Lead",
    rank: 60,
    scope: "reports",
    description:
      "Giao việc, rà soát kết quả và duyệt đề nghị của nhóm trực thuộc.",
    areas: allAreas,
  },
  Developer: {
    label: "Lập trình viên",
    rank: 10,
    scope: "self",
    description: "Xử lý nhiệm vụ phát triển được giao và các thủ tục cá nhân.",
    areas: ["engineering"],
  },
  QA: {
    label: "Đảm bảo chất lượng (QA)",
    rank: 10,
    scope: "self",
    description:
      "Lập kế hoạch đảm bảo chất lượng, tiêu chí kiểm thử và theo dõi công việc chất lượng được giao.",
    areas: ["quality"],
  },
  QC: {
    label: "Kiểm soát chất lượng (QC)",
    rank: 10,
    scope: "self",
    description:
      "Ghi nhận kiểm thử, lỗi và bằng chứng kết quả trong công việc được giao.",
    areas: ["quality"],
  },
  BA: {
    label: "Phân tích nghiệp vụ (BA)",
    rank: 10,
    scope: "self",
    description:
      "Quản lý yêu cầu nghiệp vụ, tiêu chí nghiệm thu và kết quả phân tích được giao.",
    areas: ["analysis"],
  },
  Designer: {
    label: "Thiết kế sản phẩm",
    rank: 10,
    scope: "self",
    description:
      "Theo dõi yêu cầu thiết kế, liên kết bàn giao và phản hồi cho công việc được giao.",
    areas: ["design"],
  },
  DevOps: {
    label: "Kỹ sư DevOps",
    rank: 10,
    scope: "self",
    description:
      "Theo dõi vận hành, triển khai và kết quả xử lý được giao; không tự có quyền hạ tầng HooSoo.",
    areas: ["operations"],
  },
  Employee: {
    label: "Nhân viên",
    rank: 10,
    scope: "self",
    description:
      "Hồ sơ, chấm công, nghỉ phép, lịch làm việc và phiếu đề nghị cá nhân.",
    areas: [],
  },
};
export const businessRoles: Role[] = ["Admin", "HR"];
export const supervisorRoles: Role[] = [
  "Admin",
  "Director",
  "HR",
  "Manager",
  "DeputyManager",
  "ProjectManager",
  "TeamLead",
];
export const isSupervisorRole = (role: Role) => supervisorRoles.includes(role);
export const isDepartmentRole = (role: Role) =>
  roleDefinitions[role].scope === "department";
export const isPersonalRole = (role: Role) =>
  roleDefinitions[role].scope === "self";
export const outranks = (actor: Role, target: Role) =>
  actor === "Admin" ||
  roleDefinitions[actor].rank > roleDefinitions[target].rank;
export const scopeLabels: Record<AccessScope, string> = {
  organization: "Toàn doanh nghiệp",
  department: "Phòng ban phụ trách",
  reports: "Nhân viên trực thuộc",
  self: "Cá nhân",
};
export const itPositionTemplates = [
  ["it-director", "Giám đốc phòng ban"],
  ["it-head", "Trưởng phòng"],
  ["it-deputy", "Phó phòng"],
  ["it-pm", "Quản lý dự án (PM)"],
  ["it-lead", "Trưởng nhóm / Tech Lead"],
  ["it-architect", "Kiến trúc sư phần mềm"],
  ["it-senior", "Lập trình viên Senior"],
  ["it-developer", "Lập trình viên"],
  ["it-junior", "Lập trình viên Junior"],
  ["it-intern", "Thực tập sinh công nghệ"],
  ["it-qa", "Đảm bảo chất lượng (QA)"],
  ["it-qc", "Kiểm soát chất lượng (QC)"],
  ["it-ba", "Phân tích nghiệp vụ (BA)"],
  ["it-designer", "Thiết kế UI/UX"],
  ["it-devops", "Kỹ sư DevOps"],
  ["it-data", "Kỹ sư dữ liệu"],
  ["it-security", "Kỹ sư an toàn thông tin"],
] as const;
