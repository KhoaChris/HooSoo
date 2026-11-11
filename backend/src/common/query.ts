import type { Query, Page } from "@hoosoo/shared";

export function paginate<T>(items: T[], q: Query): Page<T> {
  return {
    items: items.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
    total: items.length,
    page: q.page,
    pageSize: q.pageSize,
  };
}
export function matchesDates(date: string, q: Query) {
  return (
    (!q.startDate || date >= q.startDate) && (!q.endDate || date <= q.endDate)
  );
}
export function matchEmployee(
  e: { id: string; departmentId: string; positionId?: string },
  q: Query,
) {
  return (
    (!q.employeeId || e.id === q.employeeId) &&
    (!q.departmentId || e.departmentId === q.departmentId) &&
    (!q.positionId || e.positionId === q.positionId)
  );
}
