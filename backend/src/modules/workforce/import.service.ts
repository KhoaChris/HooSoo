import {
  employeeSchema,
  type State,
  type Actor,
  type ImportPreview,
  type ImportRow,
} from "@hoosoo/shared";
import { requireRole } from "../../common/authorization";
import { saveEmployee } from "../employees/employees.service";
import { assert } from "../../utils/errors";
import { audit } from "../../common/audit";
import { digest, record } from "./core";
const columns = [
  "employeeCode",
  "name",
  "email",
  "phone",
  "address",
  "departmentId",
  "positionId",
  "managerId",
  "hireDate",
  "status",
];
export function previewImport(
  s: State,
  a: Actor,
  rows: Record<string, string>[],
): ImportPreview {
  requireRole(a, ["Admin", "HR"]);
  assert(
    rows.length > 0 && rows.length <= 20,
    400,
    "IMPORT_LIMIT",
    "Mỗi lần nhập tối đa 20 dòng.",
  );
  const copy = structuredClone(s),
    seen = new Set<string>();
  const result: ImportRow[] = [];
  for (const [i, row] of rows.entries()) {
    const errors: string[] = [],
      code = (row.employeeCode ?? "").trim().toUpperCase(),
      old = Object.values(copy.employees).find((e) => e.employeeCode === code);
    if (Object.keys(row).some((k) => !columns.includes(k)))
      errors.push("Có cột không hỗ trợ. Dùng tệp mẫu và loại bỏ cột thừa.");
    if (code && !old)
      errors.push("Mã nhân viên không tồn tại. Để trống mã khi thêm mới.");
    const raw = Object.fromEntries(
      columns
        .filter((k) => k !== "employeeCode")
        .map((k) => [
          k,
          row[k]?.trim() ||
            (old
              ? String(old[k as keyof typeof old] ?? "")
              : k === "status"
                ? "active"
                : ""),
        ]),
    );
    for (const table of ["departments", "positions"] as const) {
      const key = table === "departments" ? "departmentId" : "positionId";
      if (!s[table][raw[key]]) {
        const matches = Object.values(s[table]).filter(
          (v) => v.name.toLowerCase() === raw[key].toLowerCase(),
        );
        if (matches.length === 1) raw[key] = matches[0].id;
      }
    }
    if (raw.managerId && !s.employees[raw.managerId])
      raw.managerId =
        Object.values(s.employees).find(
          (e) => e.employeeCode.toUpperCase() === raw.managerId.toUpperCase(),
        )?.id ?? raw.managerId;
    if (old) raw.employeeCode = old.employeeCode;
    if (raw.status === "terminated")
      errors.push("Thao tác nghỉ việc phải thực hiện qua quy trình bàn giao.");
    const email = (raw.email ?? "").toLowerCase();
    raw.email = email;
    if (seen.has(code || email)) errors.push("Dòng bị trùng trong tệp.");
    seen.add(code || email);
    if (
      Object.values(copy.employees).some(
        (e) => e.id !== old?.id && e.email.toLowerCase() === email,
      )
    )
      errors.push("Email đã được sử dụng.");
    const parsed = employeeSchema.safeParse(raw);
    if (!parsed.success)
      errors.push(
        ...parsed.error.issues.map((e) => e.path.join(".") + ": " + e.message),
      );
    const input = parsed.success
      ? parsed.data
      : (raw as unknown as ImportRow["input"]);
    const changes = columns.filter(
      (k) =>
        k !== "employeeCode" &&
        (!old ||
          String(old[k as keyof typeof old] ?? "") !== String(raw[k] ?? "")),
    );
    if (parsed.success && !errors.length) {
      try {
        saveEmployee(copy, a, input, old?.id);
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
    result.push({
      row: i + 2,
      mode: old ? "update" : "create",
      employeeId: old?.id ?? "",
      input,
      errors,
      changes,
    });
  }
  const fingerprint = digest({
    rows,
    result: result.map((r) => ({
      mode: r.mode,
      employeeId: r.employeeId,
      input: r.input,
      errors: r.errors,
    })),
    employees: Object.values(s.employees).sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
    departments: s.departments,
    positions: s.positions,
    memberships: s.memberships,
    sequence: s.employeeSequences.main ?? null,
  });
  return {
    rows: result,
    canCommit: result.every((r) => !r.errors.length),
    fingerprint,
  };
}
export function commitImport(
  s: State,
  a: Actor,
  input: { rows: Record<string, string>[]; fingerprint: string },
) {
  const preview = previewImport(s, a, input.rows);
  assert(
    preview.canCommit,
    400,
    "IMPORT_INVALID",
    "Sửa các dòng lỗi trước khi nhập.",
  );
  assert(
    preview.fingerprint === input.fingerprint,
    409,
    "IMPORT_STALE",
    "Dữ liệu đã thay đổi. Xem trước lại trước khi xác nhận.",
  );
  const imported = {
    ...record(s, a, ""),
    actorId: a.uid,
    createdIds: [] as string[],
    updatedIds: [] as string[],
    rowCount: preview.rows.length,
  };
  for (const row of preview.rows) {
    const e = saveEmployee(s, a, row.input, row.employeeId || undefined);
    (row.mode === "create" ? imported.createdIds : imported.updatedIds).push(
      e.id,
    );
  }
  s.employeeImports[imported.id] = imported;
  audit(
    s,
    a,
    "workforce.employees_imported",
    imported.id,
    { rowCount: imported.rowCount },
    "",
  );
  return imported;
}
