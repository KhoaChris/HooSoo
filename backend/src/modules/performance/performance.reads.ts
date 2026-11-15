import {
  isSupervisorRole,
  supervisorRoles,
  type Actor,
  type State,
} from "@hoosoo/shared";
import {
  readState,
  mergeState,
  type StateReader,
  type ReadSelection,
} from "../../database/store";
import { loadEmployeeAccess } from "../../common/access-state";
import { isHR } from "../../common/authorization";
import { managesPerformance } from "./performance-access";
import { assert } from "../../utils/errors";

function groups(field: string, ids: string[]): ReadSelection[] {
  const result: ReadSelection[] = [];
  for (let i = 0; i < ids.length; i += 30)
    result.push({ field, op: "in", value: ids.slice(i, i + 30) });
  return result;
}
async function loadReviewAccess(
  read: StateReader,
  s: State,
  extra: string[] = [],
) {
  const reviews = Object.values(s.performanceReviews),
    reports = Object.values(s.performanceReports);
  const uids = [
    ...new Set(
      reviews
        .flatMap((r) => [r.createdBy, r.managerAssessment?.by])
        .filter((id): id is string => !!id && !s.memberships[id]),
    ),
  ];
  if (uids.length) mergeState(s, await read({ memberships: { ids: uids } }));
  const ids = [
    ...new Set(
      [
        ...extra,
        ...reviews.flatMap((r) => [
          r.employeeId,
          r.evaluatorId || "",
          s.memberships[r.createdBy || ""]?.employeeId || "",
          s.memberships[r.managerAssessment?.by || ""]?.employeeId || "",
        ]),
        ...reports.flatMap((r) => [r.senderId, r.reviewerId]),
      ].filter(Boolean),
    ),
  ];
  const missing = ids.filter((id) => !s.employees[id]);
  if (missing.length)
    mergeState(s, await read({ employees: { ids: missing } }));
  const managers = [
    ...new Set(
      ids
        .map((id) => s.employees[id]?.managerId)
        .filter((id) => !!id && !s.employees[id]),
    ),
  ];
  if (managers.length)
    mergeState(s, await read({ employees: { ids: managers } }));
  await loadEmployeeAccess(read, s, [...ids, ...managers]);
}
export async function performanceRead(s: State, a: Actor, team: boolean) {
  assert(
    !team || isSupervisorRole(a.role),
    403,
    "FORBIDDEN",
    "Bạn không có quyền xem danh sách này.",
  );
  const fresh: StateReader = (plan) => readState([], plan, { fresh: true });
  if (team) {
    mergeState(
      s,
      await fresh({
        employees: isHR(a)
          ? true
          : {
              field: "departmentId",
              value: s.employees[a.employeeId].departmentId,
            },
        memberships: { field: "role", op: "in", value: supervisorRoles },
      }),
    );
    const supervisors = Object.values(s.memberships)
      .filter((m) => m.active && isSupervisorRole(m.role))
      .map((m) => m.employeeId);
    const missing = supervisors.filter((id) => !s.employees[id]);
    if (missing.length)
      mergeState(s, await fresh({ employees: { ids: missing } }));
    await loadEmployeeAccess(fresh, s, Object.keys(s.employees));
  }
  const ids = Object.values(s.employees)
    .filter((e) =>
      team ? managesPerformance(s, a, e.id) : e.id === a.employeeId,
    )
    .map((e) => e.id);
  const selections = groups("employeeId", ids);
  if (selections.length)
    mergeState(
      s,
      await readState([], { performanceReviews: { any: selections } }),
    );
  if (team) {
    mergeState(
      s,
      await readState([], {
        performanceReports: {
          any: [
            ...groups("senderId", [a.employeeId, ...ids]),
            { field: "reviewerId", value: a.employeeId },
          ],
        },
      }),
    );
    const reviewIds = [
      ...new Set(
        Object.values(s.performanceReports).flatMap((r) => r.reviewIds),
      ),
    ].filter((id) => !s.performanceReviews[id]);
    if (reviewIds.length)
      mergeState(
        s,
        await readState([], { performanceReviews: { ids: reviewIds } }),
      );
  }
  const reportIds = [
    ...new Set(
      Object.values(s.performanceReviews)
        .map((r) => r.reportId)
        .filter((id): id is string => !!id && !s.performanceReports[id]),
    ),
  ];
  if (team && reportIds.length)
    mergeState(
      s,
      await readState([], { performanceReports: { ids: reportIds } }),
    );
  await loadReviewAccess(fresh, s);
}

export async function performanceCommand(
  read: StateReader,
  s: State,
  _a: Actor,
  route: string,
  body: unknown,
  replay?: { id?: string },
) {
  if (!route.startsWith("/performance/")) return false;
  const parts = route.split("/"),
    id = parts[3] || replay?.id;
  const input = body as {
    employeeId?: string;
    reviewerId?: string;
    reviews?: { id: string }[];
  };
  if (parts[2] === "reports") {
    if (id) mergeState(s, await read({ performanceReports: { ids: [id] } }));
    const reviewIds = id
      ? (s.performanceReports[id]?.reviewIds ?? [])
      : (input.reviews?.map((r) => r.id) ?? []);
    if (reviewIds.length)
      mergeState(s, await read({ performanceReviews: { ids: reviewIds } }));
  } else if (id)
    mergeState(s, await read({ performanceReviews: { ids: [id] } }));
  const reportIds = [
    ...new Set(
      Object.values(s.performanceReviews)
        .map((r) => r.reportId)
        .filter((id): id is string => !!id && !s.performanceReports[id]),
    ),
  ];
  if (reportIds.length)
    mergeState(s, await read({ performanceReports: { ids: reportIds } }));
  // Report authorization always checks every member, even when editing one entry.
  const missing = [
    ...new Set(Object.values(s.performanceReports).flatMap((r) => r.reviewIds)),
  ].filter((id) => !s.performanceReviews[id]);
  if (missing.length)
    mergeState(s, await read({ performanceReviews: { ids: missing } }));
  await loadReviewAccess(
    read,
    s,
    [input.employeeId, input.reviewerId].filter((id): id is string => !!id),
  );
  if (parts[2] === "reviews" && !id && input.employeeId)
    mergeState(
      s,
      await read({
        performanceReviews: { field: "employeeId", value: input.employeeId },
      }),
    );
  return true;
}
