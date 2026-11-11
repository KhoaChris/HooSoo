import { randomUUID } from "node:crypto";
import type { State, Actor, Role } from "@hoosoo/shared";
import { assert, notFound } from "../../utils/errors";
import { audit } from "../../common/audit";
import { requireRole } from "../../common/authorization";

const hr: Role[] = ["Admin", "HR"];
export function saveCatalog(
  s: State,
  a: Actor,
  table: "departments" | "positions",
  input: { name: string; description: string },
  id?: string,
) {
  requireRole(a, hr);
  const old = id ? s[table][id] : undefined;
  if (id && !old) notFound();
  assert(
    !Object.values(s[table]).some(
      (x) =>
        x.id !== id &&
        x.name.toLocaleLowerCase("vi") === input.name.toLocaleLowerCase("vi"),
    ),
    409,
    "NAME_EXISTS",
    "Tên đã được sử dụng.",
  );
  const result = {
    ...old,
    ...input,
    id: id || randomUUID(),
    active: old?.active ?? true,
  };
  s[table][result.id] = result;
  audit(s, a, table + ".saved", result.id, { name: input.name });
  return result;
}
export function catalogStatus(
  s: State,
  a: Actor,
  table: "departments" | "positions",
  id: string,
  active: boolean,
) {
  requireRole(a, hr);
  const c = s[table][id];
  if (!c) notFound();
  if (!active)
    assert(
      !Object.values(s.employees).some(
        (e) =>
          e.status !== "terminated" &&
          e[table === "departments" ? "departmentId" : "positionId"] === id,
      ),
      409,
      "CATALOG_IN_USE",
      "Cần điều chuyển nhân viên đang làm việc trước khi ngừng sử dụng.",
    );
  c.active = active;
  audit(s, a, table + ".status", id, { active });
  return c;
}
