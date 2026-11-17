import { createHash } from "node:crypto";
import type {
  State,
  Actor,
  PersonnelDocumentInput,
  PersonnelDocument,
  PersonnelDocumentView,
  WorkforceAction,
} from "@hoosoo/shared";
import { assert, notFound } from "../../utils/errors";
import { allowed, change, expected, manages, record, stateIs } from "./core";
export const documentRead = (s: State, a: Actor, id: string) =>
  !!s.employees[id] && (id === a.employeeId || manages(s, a, id));
export function documentEdit(
  s: State,
  a: Actor,
  r: Pick<PersonnelDocument, "employeeId" | "category">,
) {
  return (
    manages(s, a, r.employeeId) ||
    (a.employeeId === r.employeeId &&
      ["qualification", "identity", "other"].includes(r.category))
  );
}
export function documentView(
  s: State,
  a: Actor,
  r: PersonnelDocument,
): PersonnelDocumentView {
  allowed(documentRead(s, a, r.employeeId));
  return {
    ...r,
    files: r.files.map(({ objectKey: _, ...f }) => f),
    employeeName: s.employees[r.employeeId].name,
    canEdit: documentEdit(s, a, r) && r.status === "active",
  };
}
export function saveDocument(
  s: State,
  a: Actor,
  input: PersonnelDocumentInput,
  id?: string,
  objectKey?: string,
) {
  allowed(documentEdit(s, a, input));
  const old = id ? s.personnelDocuments[id] : undefined;
  if (id && !old) notFound();
  expected(old, input.version);
  stateIs(
    !old ||
      (old.status === "active" &&
        old.employeeId === input.employeeId &&
        old.category === input.category),
  );
  assert(
    (old?.files.length ?? 0) < 10,
    409,
    "DOCUMENT_VERSIONS",
    "Tối đa 10 phiên bản mỗi tài liệu.",
  );
  const bytes = validateDocumentFile(input);
  const r: PersonnelDocument = old ?? {
    ...record(s, a, input.reason),
    employeeId: input.employeeId,
    title: input.title,
    category: input.category,
    expiresOn: input.expiresOn,
    status: "active",
    files: [],
  };
  r.title = input.title;
  r.expiresOn = input.expiresOn;
  r.files.push({
    version: r.files.length + 1,
    fileName: input.fileName.replace(/[\r\n\\/]/g, "_"),
    mime: input.mime,
    bytes: bytes.length,
    objectKey: objectKey ?? createHash("sha256").update(bytes).digest("hex"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    uploadedAt: new Date().toISOString(),
    uploadedBy: a.uid,
  });
  s.personnelDocuments[r.id] = r;
  change(s, a, r, "document_uploaded", input.reason);
  return documentView(s, a, r);
}
export function archiveDocument(
  s: State,
  a: Actor,
  id: string,
  input: WorkforceAction,
) {
  const r = s.personnelDocuments[id];
  if (!r) notFound();
  allowed(documentEdit(s, a, r));
  expected(r, input.version);
  stateIs(r.status === "active");
  r.status = "archived";
  change(s, a, r, "document_archived", input.reason);
  return documentView(s, a, r);
}
export function downloadDocument(
  s: State,
  a: Actor,
  id: string,
  version: number,
) {
  const r = s.personnelDocuments[id];
  if (!r) notFound();
  allowed(documentRead(s, a, r.employeeId));
  const file = r.files.find((f) => f.version === version);
  if (!file) return notFound();
  return file;
}
export function employmentLetter(s: State, a: Actor, requestId: string) {
  const r = s.internalRequests[requestId];
  if (!r) notFound();
  allowed(documentRead(s, a, r.employeeId));
  stateIs(r.kind === "employment_certificate" && r.status === "approved");
  const e = s.employees[r.employeeId];
  return {
    requestId: r.id,
    reference: r.id.slice(0, 8).toUpperCase(),
    company: s.settings.main?.companyName ?? "HooSoo",
    employeeName: e.name,
    employeeCode: e.employeeCode,
    department: s.departments[e.departmentId]?.name ?? "",
    position: s.positions[e.positionId]?.name ?? "",
    hireDate: e.hireDate,
    purpose: r.reason,
    approvedAt:
      r.history.filter((h) => h.action === "approved_final").at(-1)?.at ?? "",
    reviewer:
      r.history.filter((h) => h.action === "approved_final").at(-1)?.name ?? "",
    resolution: r.resolution,
  };
}

export function validateDocumentFile(input: PersonnelDocumentInput) {
  const bytes = Buffer.from(input.data, "base64");
  assert(
    bytes.length > 0 &&
      bytes.length <= 512 * 1024 &&
      bytes.toString("base64") === input.data,
    400,
    "DOCUMENT_SIZE",
    "Tệp phải là PDF, PNG hoặc JPEG hợp lệ, tối đa 512 KB.",
  );
  const signature =
    input.mime === "application/pdf"
      ? bytes.subarray(0, 5).toString() === "%PDF-"
      : input.mime === "image/png"
        ? bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a"
        : bytes.subarray(0, 3).toString("hex") === "ffd8ff";
  assert(
    signature,
    400,
    "DOCUMENT_TYPE",
    "Nội dung tệp không khớp định dạng đã chọn.",
  );
  return bytes;
}
