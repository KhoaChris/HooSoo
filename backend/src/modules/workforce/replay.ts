import type { State, Actor } from "@hoosoo/shared";
import { requireRole } from "../../common/authorization";
import { sections, type WorkforceSection } from "./reads";
import { allowed, payRead, visible } from "./core";
import { payrollView } from "./payroll.service";
import { documentRead } from "./documents.service";
import { announcementVisible } from "./announcements.service";
export function workforceReplay(
  s: State,
  a: Actor,
  route: string,
  result: unknown,
) {
  const [, , section, id, verb] = route.split("/");
  if (section === "documents" && verb === "download") {
    allowed(documentRead(s, a, s.personnelDocuments[id]?.employeeId));
    return;
  }
  const r = result as { id?: string; employeeId?: string };
  if (section === "imports") {
    requireRole(a, ["Admin", "HR"]);
    return;
  }
  const table = sections[section as WorkforceSection],
    old = r?.id ? s[table][r.id] : undefined;
  allowed(old);
  if (section === "announcements") {
    allowed(announcementVisible(s, a, s.announcements[r.id!]));
    return;
  }
  const eid = r.employeeId!;
  allowed(
    section === "payroll"
      ? payRead(s, a, eid)
      : section === "documents"
        ? documentRead(s, a, eid)
        : visible(s, a, eid),
  );
  if (section === "payroll") payrollView(s, a, s.payrollStatements[r.id!]);
}
