import { createHash, randomUUID } from "node:crypto";

export const identityTables = [
  "employees",
  "memberships",
  "employeeSequences",
  "accountJobs",
  "attendanceRecords",
  "leaveRequests",
  "leaveBalances",
  "leaveBalanceTransactions",
  "workRegistrations",
  "internalRequests",
  "workItems",
  "recruitmentJobs",
  "candidates",
  "chatRooms",
  "chatMessages",
  "auditLogs",
  "receipts",
] as const;

export interface IdentityDocument {
  table: string;
  id: string;
  data: Record<string, unknown>;
}
export interface IdentityChange {
  oldId: string;
  id: string;
  oldName: string;
  name: string;
  oldCode: string;
  code: string;
  uid: string;
}
export interface IdentityWrite extends IdentityDocument {
  previousId: string;
}
export const directRoomId = (members: string[]) =>
  createHash("sha256")
    .update("direct|" + [...new Set(members)].sort().join("|"))
    .digest("hex");

const text = (value: unknown) => (typeof value === "string" ? value : "");
const referenceKey = (key: string) =>
  /(^id$|Ids?$)/.test(key) ||
  [
    "by",
    "createdBy",
    "confirmedBy",
    "evaluatedBy",
    "managerApprovedBy",
  ].includes(key);
const isPlain = (value: unknown): value is Record<string, unknown> =>
  !!value &&
  typeof value === "object" &&
  Object.getPrototypeOf(value) === Object.prototype;

/** Plan only: no Firebase calls. Identity references change; user-authored text does not. */
export function planAccountIdentities(
  documents: IdentityDocument[],
  newId: () => string = randomUUID,
) {
  const employees = documents.filter((d) => d.table === "employees");
  const sequence = documents.find(
    (d) => d.table === "employeeSequences" && d.id === "main",
  );
  const saved = sequence?.data.lastNumber ?? 0;
  if (
    !Number.isSafeInteger(saved) ||
    Number(saved) < 0 ||
    Number(saved) > 999999
  )
    throw new Error("Invalid employee sequence");
  let lastNumber = Math.max(
    Number(saved),
    ...employees.map((d) =>
      Number(/^HS-(\d{6})$/i.exec(text(d.data.employeeCode))?.[1] ?? 0),
    ),
  );
  const changes: IdentityChange[] = employees
    .filter((d) =>
      /demo/i.test([d.id, d.data.employeeCode, d.data.name].join(" ")),
    )
    .sort((a, b) =>
      text(a.data.employeeCode).localeCompare(text(b.data.employeeCode)),
    )
    .map((d) => {
      const oldName = text(d.data.name),
        oldCode = text(d.data.employeeCode);
      const name = oldName
        .replace(/\bdemo\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!name || /demo/i.test(name))
        throw new Error("A replacement name is required");
      const code = /demo/i.test(oldCode)
        ? `HS-${String(++lastNumber).padStart(6, "0")}`
        : oldCode;
      if (lastNumber > 999999) throw new Error("Employee code range exhausted");
      return {
        oldId: d.id,
        id: /demo/i.test(d.id) ? newId() : d.id,
        oldName,
        name,
        oldCode,
        code,
        uid: text(d.data.uid),
      };
    });
  const ids = new Map(changes.map((c) => [c.oldId, c.id]));
  const names = new Map(changes.map((c) => [c.oldName, c.name]));
  const codes = new Map(changes.map((c) => [c.oldCode, c.code]));
  // Deterministic business keys must move with their employee, otherwise the
  // next check-in/registration/allocation would create a duplicate record.
  for (const d of documents) {
    const employeeId = text(d.data.employeeId),
      id = ids.get(employeeId);
    if (id && employeeId !== id) {
      if (["attendanceRecords", "workRegistrations"].includes(d.table))
        ids.set(d.id, `${id}_${text(d.data.date)}`);
      if (d.table === "leaveBalances") ids.set(d.id, `${id}_${d.data.year}`);
      if (
        d.table === "leaveBalanceTransactions" &&
        d.id === `allocation_${employeeId}_${d.data.year}`
      )
        ids.set(d.id, `allocation_${id}_${d.data.year}`);
    }
  }
  for (const d of documents.filter(
    (d) => d.table === "chatRooms" && d.data.kind === "direct",
  )) {
    const members = d.data.memberIds as string[];
    if (members.some((id) => ids.has(id)))
      ids.set(d.id, directRoomId(members.map((id) => ids.get(id) ?? id)));
  }
  for (const d of documents.filter((d) => d.table === "chatMessages")) {
    const room = ids.get(text(d.data.roomId));
    if (room)
      ids.set(d.id, `${room}_${String(d.data.sequence).padStart(12, "0")}`);
  }
  function rewrite(value: unknown, key = "", historical = false): unknown {
    if (typeof value === "string") {
      if (referenceKey(key)) return ids.get(value) ?? value;
      if (!historical && /(^name$|Name$)/.test(key))
        return names.get(value) ?? value;
      if (!historical && key === "employeeCode")
        return codes.get(value) ?? value;
      return value;
    }
    if (Array.isArray(value))
      return value.map((v) => rewrite(v, key, historical));
    // Preserve Firestore Timestamps and all other typed values verbatim.
    if (isPlain(value))
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, rewrite(v, k, historical)]),
      );
    return value;
  }
  const writes: IdentityWrite[] = [];
  const after = documents.map((d) => {
    const id = ids.get(d.id) ?? d.id;
    // Audit facts retain the names/codes recorded at the time. Only their
    // references move, so the history still belongs to the same employee.
    const data = rewrite(d.data, "", d.table === "auditLogs") as Record<
      string,
      unknown
    >;
    if (JSON.stringify(data) !== JSON.stringify(d.data) || id !== d.id)
      writes.push({ table: d.table, previousId: d.id, id, data });
    return { table: d.table, id, data };
  });
  if (lastNumber !== saved) {
    const data = { ...sequence?.data, id: "main", lastNumber };
    writes.push({
      table: "employeeSequences",
      previousId: "main",
      id: "main",
      data,
    });
    const row = after.find(
      (d) => d.table === "employeeSequences" && d.id === "main",
    );
    if (row) row.data = data;
    else after.push({ table: "employeeSequences", id: "main", data });
  }
  const paths = after.map((d) => `${d.table}/${d.id}`);
  if (new Set(paths).size !== paths.length)
    throw new Error("Identity destination already exists");
  const employeeCodes = after
    .filter((d) => d.table === "employees")
    .map((d) => d.data.employeeCode);
  if (new Set(employeeCodes).size !== employeeCodes.length)
    throw new Error("Duplicate employee code");
  const writeCount =
    writes.length +
    writes.filter((d) => d.id !== d.previousId).length +
    changes.length +
    1;
  if (writeCount > 450)
    throw new Error("Migration exceeds the safe atomic write limit");
  return { changes, writes, after, writeCount };
}
