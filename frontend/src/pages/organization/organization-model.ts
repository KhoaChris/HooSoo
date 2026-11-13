export interface OrganizationMember {
  id: string;
  name: string;
  avatarUrl?: string | null;
  employeeCode?: string;
  positionName?: string;
  managerName: string;
  self: boolean;
}
export interface OrganizationDepartment {
  id: string;
  name: string;
  description: string;
  employees: OrganizationMember[];
}
export interface Organization {
  companyName: string;
  departments: OrganizationDepartment[];
}
const searchable = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLocaleLowerCase("vi")
    .trim();
/** Filter the already cached tree; viewing the chart never needs another API. */
export function filterDepartments(
  departments: OrganizationDepartment[],
  departmentId: string,
  search: string,
) {
  const words = searchable(search).split(/\s+/).filter(Boolean);
  return departments
    .filter((d) => !departmentId || d.id === departmentId)
    .map((d) => ({
      ...d,
      totalEmployees: d.employees.length,
      employees: d.employees.filter((e) => {
        const text = searchable(
          [d.name, e.name, e.employeeCode, e.positionName, e.managerName].join(
            " ",
          ),
        );
        return words.every((word) => text.includes(word));
      }),
    }))
    .filter(
      (d) =>
        !words.length ||
        d.employees.length > 0 ||
        words.every((word) => searchable(d.name).includes(word)),
    );
}
export type VisibleDepartment = ReturnType<typeof filterDepartments>[number];
