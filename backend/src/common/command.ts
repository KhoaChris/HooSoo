import { workFor } from "../modules/professional/professional.service";
import { professionalRoles } from "@hoosoo/shared";
import { assertManageEmployee } from "./authorization";
import { supervisorRoles } from "@hoosoo/shared";
import {
  candidateFor,
  jobFor,
} from "../modules/recruitment/recruitment.service";
import { createHash } from "node:crypto";
import type { Actor, State } from "@hoosoo/shared";
import { mutate } from "../database/store";
import { actorFor, requireRole, scopedEmployee } from "./authorization";
import { assert } from "../utils/errors";
import { commandState } from "./command-state";

export async function command<T>(
  uid: string,
  key: string | undefined,
  path: string,
  body: unknown,
  fn: (s: State, a: Actor) => T,
) {
  assert(
    key && /^[A-Za-z0-9_-]{8,100}$/.test(key),
    400,
    "IDEMPOTENCY_KEY_REQUIRED",
    "Thiếu mã chống gửi lặp hợp lệ.",
  );
  const id = createHash("sha256")
    .update(uid + "|" + key)
    .digest("hex");
  const fingerprint = createHash("sha256")
    .update(path + "|" + JSON.stringify(body))
    .digest("hex");
  return mutate(
    (s) => {
      const a = actorFor(s, uid),
        receipt = s.receipts[id];
      if (receipt) {
        assert(
          receipt.fingerprint === fingerprint,
          409,
          "IDEMPOTENCY_CONFLICT",
          "Mã yêu cầu đã dùng cho nội dung khác.",
        );
        authorizeReplay(s, a, path, body, receipt.result);
        return receipt.result as T;
      }
      const result = fn(s, a);
      s.receipts[id] = { id, fingerprint, actorId: uid, result };
      return result;
    },
    (read) => commandState(read, uid, path.split(" ")[1], body, id),
  );
}

function authorizeReplay(
  s: State,
  a: Actor,
  path: string,
  body: unknown,
  result: unknown,
) {
  const route = path.split(" ")[1];
  if (route.startsWith("/professional/")) {
    requireRole(a, professionalRoles);
    const id = route.split("/")[3] ?? (result as { id: string }).id;
    if (s.workItems[id]) workFor(s, a, id);
    else
      assert(
        false,
        403,
        "REPLAY_FORBIDDEN",
        "Không còn quyền xem công việc này.",
      );
    return;
  }
  if (route.startsWith("/recruitment/")) {
    const parts = route.split("/").filter(Boolean);
    if (parts[1] === "jobs") {
      requireRole(a, ["Admin", "HR"]);
      if (parts[2]) jobFor(s, a, parts[2]);
    } else {
      if (parts[2]) candidateFor(s, a, parts[2]);
      else jobFor(s, a, (body as { jobId: string }).jobId);
      if (!["evaluate", "move", "interview"].includes(parts[3]))
        requireRole(a, ["Admin", "HR"]);
    }
    return;
  }
  if (route.startsWith("/users/")) requireRole(a, ["Admin"]);
  else if (
    [
      "/employees",
      "/departments",
      "/positions",
      "/leave-types",
      "/leave-balances",
      "/settings",
    ].some((p) => route.startsWith(p))
  )
    requireRole(a, ["Admin", "HR"]);
  const value = result as {
    employeeId?: string;
    id?: string;
    companyName?: string;
    history?: { action: string }[];
  };
  if (route.endsWith("/adjustment")) requireRole(a, ["Admin", "HR"]);
  if (
    route === "/settings" &&
    (body as { companyName?: string }).companyName !== undefined
  )
    requireRole(a, ["Admin"]);
  if (
    route.endsWith("/cancel") &&
    value.history?.some((h) => h.action === "approve")
  )
    requireRole(a, ["Admin", "HR"]);
  if (route.endsWith("/cancel") && value?.employeeId !== a.employeeId)
    requireRole(a, ["Admin", "HR"]);
  if (value?.employeeId) scopedEmployee(s, a, value.employeeId);
  if (route.startsWith("/employees") && value?.id)
    scopedEmployee(s, a, value.id);
  const protectedTarget = route.startsWith("/employees/")
    ? value?.id
    : route.endsWith("/adjustment") ||
        route.endsWith("/adjustments") ||
        route.endsWith("/approve") ||
        route.endsWith("/reject") ||
        (route.endsWith("/cancel") && value?.employeeId !== a.employeeId)
      ? value?.employeeId
      : undefined;
  if (
    protectedTarget &&
    !(route.endsWith("/avatar") && protectedTarget === a.employeeId)
  )
    assertManageEmployee(s, a, protectedTarget);
  if (route.endsWith("/approve") || route.endsWith("/reject")) {
    requireRole(a, supervisorRoles);
    assert(
      value?.employeeId !== a.employeeId,
      403,
      "SELF_APPROVAL_FORBIDDEN",
      "Không được tự xử lý đơn của mình.",
    );
  }
}
