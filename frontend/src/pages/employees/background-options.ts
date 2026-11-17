import { t } from "../../i18n";

// Store the same text values as existing profiles; no data migration is needed.
export const qualifications = [
  "Trung học phổ thông",
  "Trung cấp",
  "Cao đẳng",
  "Đại học",
  "Thạc sĩ",
  "Tiến sĩ",
];
export const studyFields = [
  "Công nghệ thông tin",
  "Kỹ thuật phần mềm",
  "Khoa học máy tính",
  "Hệ thống thông tin",
  "Khoa học dữ liệu",
  "Trí tuệ nhân tạo",
  "An toàn thông tin",
  "Quản trị kinh doanh",
  "Quản trị nhân lực",
  "Kế toán",
  "Tài chính",
  "Marketing",
  "Thiết kế đồ họa",
  "Ngôn ngữ Anh",
];
export const experiencePositions = [
  "Thực tập sinh",
  "Lập trình viên Frontend",
  "Lập trình viên Backend",
  "Lập trình viên Full-stack",
  "Lập trình viên Mobile",
  "Kỹ sư phần mềm",
  "Chuyên viên kiểm thử (QA/QC)",
  "Chuyên viên phân tích nghiệp vụ (BA)",
  "Nhà thiết kế UI/UX",
  "Kỹ sư DevOps",
  "Chuyên viên phân tích dữ liệu",
  "Product Owner",
  "Quản lý dự án (PM)",
  "Trưởng nhóm",
  "Trưởng phòng",
  "Chuyên viên nhân sự",
  "Chuyên viên tuyển dụng",
  "Kế toán viên",
  "Chuyên viên kinh doanh",
  "Chuyên viên Marketing",
];
export const certificateNames = [
  "IELTS",
  "TOEIC",
  "TOEFL iBT",
  "MOS",
  "ICDL",
  "ISTQB CTFL",
  "AWS Certified Cloud Practitioner",
  "Microsoft Azure Fundamentals (AZ-900)",
  "Cisco CCNA",
  "Google Data Analytics",
  "PMP",
  "Professional Scrum Master I (PSM I)",
  "Professional Scrum Product Owner I (PSPO I)",
];
export const certificateIssuers = [
  "ETS",
  "British Council",
  "IDP",
  "Microsoft",
  "Certiport",
  "ICDL",
  "ISTQB",
  "Amazon Web Services",
  "Cisco",
  "Google",
  "PMI",
  "Scrum.org",
];
export const skillGroups = [
  {
    label: "Kỹ năng chung",
    items: [
      "Giao tiếp",
      "Làm việc nhóm",
      "Giải quyết vấn đề",
      "Quản lý thời gian",
      "Tiếng Anh",
      "Microsoft Excel",
    ],
  },
  {
    label: "Phát triển phần mềm",
    items: [
      "JavaScript",
      "TypeScript",
      "React",
      "Node.js",
      "Java",
      "Python",
      "SQL",
      "Git",
      "REST API",
    ],
  },
  {
    label: "Kiểm thử & phân tích",
    items: [
      "Kiểm thử thủ công",
      "Kiểm thử tự động",
      "Kiểm thử API",
      "Phân tích nghiệp vụ",
      "Phân tích dữ liệu",
      "Power BI",
    ],
  },
  {
    label: "Sản phẩm & thiết kế",
    items: [
      "Quản lý dự án",
      "Agile / Scrum",
      "Quản lý sản phẩm",
      "Figma",
      "Thiết kế UI/UX",
      "Nghiên cứu người dùng",
    ],
  },
  {
    label: "Hạ tầng & vận hành",
    items: [
      "Linux",
      "Docker",
      "Kubernetes",
      "CI/CD",
      "AWS",
      "Bảo mật ứng dụng",
    ],
  },
  {
    label: "Nhân sự & kinh doanh",
    items: [
      "Tuyển dụng",
      "Đào tạo nhân sự",
      "Tiền lương & phúc lợi",
      "Đánh giá hiệu suất",
      "Chăm sóc khách hàng",
      "Đàm phán",
    ],
  },
];
export const skillOptions = skillGroups.flatMap((group) => group.items);
const skillKey = (value: string) => value.trim().toLocaleLowerCase("vi");
const skillCategoryByName = new Map(
  skillGroups.flatMap((group) =>
    group.items.map((item) => [skillKey(item), group.label] as const),
  ),
);

// Group only for display. Keep the saved text and its order within each group,
// including custom or legacy values that do not belong to a preset category.
export function groupBackgroundSkills(
  skills: readonly string[],
  includeCertificates = false,
) {
  const categories = includeCertificates
    ? new Map([
        ...skillCategoryByName,
        ...certificateNames.map((name) => [skillKey(name), "Chứng chỉ"] as const),
      ])
    : skillCategoryByName;
  return [
    ...skillGroups.map(({ label }) => label),
    ...(includeCertificates ? ["Chứng chỉ"] : []),
    "Kỹ năng khác",
  ]
    .map((label) => ({
      label,
      items: skills.filter(
        (skill) =>
          (categories.get(skillKey(skill)) ?? "Kỹ năng khác") === label,
      ),
    }))
    .filter((group) => group.items.length > 0);
}

export const presetLabel = (value: string, options: readonly string[]) =>
  options.includes(value) ? t(value) : value;
export const searchKey = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
