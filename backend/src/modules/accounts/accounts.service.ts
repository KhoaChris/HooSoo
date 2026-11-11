import { createHash } from "node:crypto";
import type { Role } from "@hoosoo/shared";
import { auth } from "../../config/firebase-admin";
import { ORG_ID } from "../../config/env";
import { mutate } from "../../database/store";
import { actorFor, requireRole } from "../../common/authorization";
import { audit } from "../../common/audit";
import { AppError, assert } from "../../utils/errors";

export async function provisionAccount(
  actorUid: string,
  input: { employeeId: string; role: Role; password: string },
  key: string,
) {
  assert(
    /^[A-Za-z0-9_-]{8,100}$/.test(key),
    400,
    "IDEMPOTENCY_KEY_REQUIRED",
    "Thiếu mã chống gửi lặp hợp lệ.",
  );
  const uid =
    "hs_" +
    createHash("sha256")
      .update(ORG_ID + input.employeeId)
      .digest("hex")
      .slice(0, 32);
  const receiptId = createHash("sha256")
    .update(actorUid + "|" + key)
    .digest("hex");
  // The random request key salts the fingerprint; no password or reusable
  // password hash is persisted in a business record.
  const fingerprint = createHash("sha256")
    .update(key + "|POST /users|" + JSON.stringify(input))
    .digest("hex");
  const plan = {
    employees: true,
    memberships: true,
    accountJobs: { ids: [uid] },
    receipts: { ids: [receiptId] },
  } as const;
  const job = await mutate((s) => {
    const a = actorFor(s, actorUid);
    requireRole(a, ["Admin"]);
    assert(
      !s.receipts[receiptId] ||
        s.receipts[receiptId].fingerprint === fingerprint,
      409,
      "IDEMPOTENCY_CONFLICT",
      "Mã yêu cầu đã dùng cho nội dung khác.",
    );
    const e = s.employees[input.employeeId];
    assert(
      e && e.status !== "terminated",
      400,
      "INVALID_EMPLOYEE",
      "Hồ sơ không hợp lệ hoặc đã nghỉ việc.",
    );
    const old = s.accountJobs[uid];
    if (old?.status === "complete") {
      assert(
        e.uid === uid && old.role === input.role,
        409,
        "ACCOUNT_LINKED",
        "Hồ sơ đã có tài khoản.",
      );
      s.receipts[receiptId] = {
        id: receiptId,
        fingerprint,
        actorId: actorUid,
        result: {
          uid,
          employeeId: old.employeeId,
          role: old.role,
          status: "complete",
        },
      };
      return old;
    }
    assert(!e.uid, 409, "ACCOUNT_LINKED", "Hồ sơ đã liên kết tài khoản.");
    assert(
      !old ||
        old.status === "failed" ||
        Date.now() - Date.parse(old.updatedAt || old.createdAt || "") > 60000,
      409,
      "ACCOUNT_PROVISIONING",
      "Tài khoản đang được khởi tạo. Chờ một phút trước khi thử khôi phục.",
    );
    const next = {
      id: uid,
      uid,
      employeeId: e.id,
      email: e.email,
      role: input.role,
      status: "pending" as const,
      actorId: a.uid,
      createdAt: old?.createdAt || new Date().toISOString(),
    };
    s.accountJobs[uid] = next;
    s.receipts[receiptId] = {
      id: receiptId,
      fingerprint,
      actorId: actorUid,
      result: {
        uid,
        employeeId: next.employeeId,
        role: next.role,
        status: "pending",
      },
    };
    return next;
  }, plan);
  if (job.status === "complete")
    return {
      uid,
      employeeId: job.employeeId,
      role: job.role,
      status: "complete",
    };
  try {
    try {
      await auth.createUser({
        uid,
        email: job.email,
        password: input.password,
        displayName: "HooSoo member",
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "auth/uid-already-exists") {
        const existing = await auth.getUser(uid);
        assert(
          existing.email === job.email,
          409,
          "ACCOUNT_ID_CONFLICT",
          "Tài khoản khôi phục không khớp hồ sơ.",
        );
      } else if (code === "auth/email-already-exists")
        throw new AppError(
          409,
          "EMAIL_EXISTS",
          "Email đã có tài khoản khác. Hãy dùng email chưa được cấp tài khoản.",
        );
      else throw error;
    }
    return await mutate((s) => {
      const a = actorFor(s, actorUid);
      requireRole(a, ["Admin"]);
      const e = s.employees[job.employeeId];
      assert(
        e && e.status !== "terminated" && e.email === job.email,
        409,
        "EMPLOYEE_CHANGED",
        "Hồ sơ đã thay đổi trong khi cấp tài khoản.",
      );
      assert(
        !e.uid || e.uid === uid,
        409,
        "ACCOUNT_LINKED",
        "Hồ sơ đã có tài khoản khác.",
      );
      e.uid = uid;
      s.memberships[uid] = {
        id: uid,
        orgId: ORG_ID,
        employeeId: e.id,
        email: e.email,
        role: job.role,
        active: true,
      };
      s.accountJobs[uid].status = "complete";
      audit(s, a, "account.created", uid, { employeeId: e.id, role: job.role });
      const result = {
        uid,
        employeeId: e.id,
        role: job.role,
        status: "complete",
      };
      s.receipts[receiptId] = {
        id: receiptId,
        fingerprint,
        actorId: actorUid,
        result,
      };
      return result;
    }, plan);
  } catch (error) {
    try {
      await mutate(
        (s) => {
          if (s.accountJobs[uid]?.status !== "complete") {
            s.accountJobs[uid].status = "failed";
            s.accountJobs[uid].error =
              error instanceof AppError
                ? error.code
                : "PROVISIONING_INCOMPLETE";
          }
        },
        { accountJobs: { ids: [uid] } },
      );
    } catch {
      /* The durable pending job remains visible for recovery after the database returns. */
    }
    if (error instanceof AppError) throw error;
    throw new AppError(
      503,
      "PROVISIONING_INCOMPLETE",
      "Chưa hoàn tất liên kết tài khoản. Yêu cầu đã được lưu; thử cấp lại cùng hồ sơ để khôi phục an toàn.",
    );
  }
}
