import { assertManageEmployee } from "../../common/authorization";
import { itPositionTemplates } from "@hoosoo/shared";
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
  if (id) protectCatalog(s, a, table, id);
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
  protectCatalog(s, a, table, id);
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

function protectCatalog(
  s: State,
  a: Actor,
  table: "departments" | "positions",
  id: string,
) {
  for (const e of Object.values(s.employees))
    if (e[table === "departments" ? "departmentId" : "positionId"] === id)
      assertManageEmployee(s, a, e.id);
}
export function addITPositions(s: State, a: Actor) {
  requireRole(a, ["Admin"]);
  const added: string[] = [];
  for (const [id, name] of itPositionTemplates) {
    if (
      s.positions[id] ||
      Object.values(s.positions).some(
        (p) => p.name.toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi"),
      )
    )
      continue;
    s.positions[id] = {
      id,
      name,
      description:
        "Chức danh chuyên môn CNTT. Quyền hệ thống được Admin cấp riêng trong Tài khoản & quyền.",
      active: true,
    };
    added.push(name);
  }
  audit(s, a, "positions.templates", "it-positions", { added });
  return { added };
}
