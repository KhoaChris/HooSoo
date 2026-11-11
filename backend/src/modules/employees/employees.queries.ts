import type { State, Actor, Query } from "@hoosoo/shared";
import { inScope, employeeView } from "../../common/authorization";
import { matchEmployee } from "../../common/query";

export function employeeList(s: State, a: Actor, q: Query) {
  const search = q.search?.toLocaleLowerCase("vi");
  return Object.values(s.employees)
    .filter(
      (e) =>
        inScope(s, a, e) &&
        matchEmployee(e, q) &&
        (!q.status || e.status === q.status) &&
        (!search ||
          [e.name, e.employeeCode, e.email].some((v) =>
            v.toLocaleLowerCase("vi").includes(search),
          )),
    )
    .sort((a, b) => a.employeeCode.localeCompare(b.employeeCode))
    .map((e) => employeeView(e, a));
}
