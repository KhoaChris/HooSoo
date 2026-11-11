import { readFileSync, existsSync, writeFileSync, chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { env, ORG_ID } from "../src/config/env";
import {
  auth,
  db,
  ensureFirebaseCredentials,
} from "../src/config/firebase-admin";
import {
  mutate,
  readState,
  readiness,
  tables,
  timeout,
} from "../src/database/store";
import {
  bootstrapDemoState,
  demoBootstrapId,
  demoUsers,
} from "./lib/demo-bootstrap";
import { provisionAccount } from "../src/modules/accounts/accounts.service";
import { command } from "../src/common/command";
import {
  checkIn,
  checkOut,
} from "../src/modules/attendance/attendance.service";
import {
  createLeave,
  transitionLeave,
} from "../src/modules/leave/leave.service";
import { businessDate, workDates } from "../src/utils/time";

// Explicit cloud-only setup for this authorized demo; not a general reset/seed.
if (
  env.FIREBASE_MODE !== "cloud" ||
  env.FIREBASE_PROJECT_ID !== "hoosoo-37881" ||
  ORG_ID !== "hoosoo" ||
  process.argv[2] !== "--project" ||
  process.argv[3] !== env.FIREBASE_PROJECT_ID
) {
  throw new Error(
    "Use --project hoosoo-37881 with its cloud environment; no other target is allowed",
  );
}
const admin = z
  .object({
    projectId: z.literal("hoosoo-37881"),
    email: z.literal("admin@hoosoo.example"),
    uid: z.string().min(1),
    password: z.string().min(10),
  })
  .parse(
    JSON.parse(
      readFileSync(
        new URL("../.secrets/demo-access.json", import.meta.url),
        "utf8",
      ),
    ),
  );
const accessFile = fileURLToPath(
  new URL("../.secrets/demo-accounts.json", import.meta.url),
);
const accountSchema = z.object({
  email: z.email(),
  password: z.string().min(10),
  uid: z.string().optional(),
});
const saved = existsSync(accessFile)
  ? z
      .object({
        projectId: z.literal("hoosoo-37881"),
        accounts: z.record(z.string(), accountSchema),
      })
      .parse(JSON.parse(readFileSync(accessFile, "utf8")))
  : {
      projectId: "hoosoo-37881",
      accounts: {} as Record<string, z.infer<typeof accountSchema>>,
    };
function saveAccess() {
  writeFileSync(accessFile, JSON.stringify(saved, null, 2) + "\n", {
    mode: 0o600,
  });
  chmodSync(accessFile, 0o600);
}

try {
  await timeout(ensureFirebaseCredentials(), 30000);
  await readiness();
  const user = await auth.getUser(admin.uid);
  if (user.email !== admin.email || user.disabled)
    throw new Error(
      "The existing demo Admin identity is missing, disabled or mismatched",
    );
  const created = await mutate((s) => bootstrapDemoState(s, admin.uid, ORG_ID));
  console.log(
    created
      ? "Initialized base organization records."
      : "Preserved existing demo records.",
  );
  saved.accounts.Admin = {
    email: admin.email,
    password: admin.password,
    uid: admin.uid,
  };
  for (const user of demoUsers.filter((u) => u.role !== "Admin")) {
    const existing = saved.accounts[user.role];
    if (existing && existing.email !== user.email)
      throw new Error("Saved demo identity mismatch");
    saved.accounts[user.role] ||= {
      email: user.email,
      password: "Hs!" + randomBytes(21).toString("base64url"),
    };
    saveAccess();
    const result = await provisionAccount(
      admin.uid,
      {
        employeeId: user.employeeId,
        role: user.role,
        password: saved.accounts[user.role].password,
      },
      `cloud_demo_account_${user.role}_v1`,
    );
    saved.accounts[user.role].uid = result.uid;
    saveAccess();
    console.log(`Linked ${user.role} demo account.`);
  }
  const state = await readState();
  const initializedAt = (
    state.receipts[demoBootstrapId].result as { initializedAt: string }
  ).initializedAt;
  const anchor = new Date(initializedAt);
  const previousDays = workDates(
    businessDate(new Date(anchor.getTime() - 14 * 86400000)),
    businessDate(new Date(anchor.getTime() - 86400000)),
    state.settings.main.schedule,
  );
  const attendanceDate = previousDays.at(-1)!;
  const employeeUid = saved.accounts.Employee.uid!;
  await command(
    employeeUid,
    "cloud_demo_checkin_v1",
    "POST /attendance/check-in",
    {},
    (s, a) => checkIn(s, a, new Date(`${attendanceDate}T08:00:00+07:00`)),
  );
  await command(
    employeeUid,
    "cloud_demo_checkout_v1",
    "POST /attendance/check-out",
    {},
    (s, a) => checkOut(s, a, new Date(`${attendanceDate}T17:00:00+07:00`)),
  );
  const futureDays = workDates(
    businessDate(new Date(anchor.getTime() + 86400000)),
    businessDate(new Date(anchor.getTime() + 14 * 86400000)),
    state.settings.main.schedule,
  );
  const leaveDate = futureDays[0];
  const leaveInput = {
    leaveTypeId: "annual",
    startDate: leaveDate,
    endDate: leaveDate,
    reason: "Đơn nghỉ phép giả lập để kiểm tra đồng bộ API và Firestore",
  };
  const leave = await command(
    employeeUid,
    "cloud_demo_leave_v1",
    "POST /leave-requests",
    leaveInput,
    (s, a) => createLeave(s, a, leaveInput),
  );
  await command(
    saved.accounts.Manager.uid!,
    "cloud_demo_approve_v1",
    `POST /leave-requests/${leave.id}/approve`,
    { reason: "Duyệt đơn demo" },
    (s, a) => transitionLeave(s, a, leave.id, "approve", "Duyệt đơn demo"),
  );
  const finalState = await readState();
  const counts = Object.fromEntries(
    tables.map((table) => [table, Object.keys(finalState[table]).length]),
  );
  if (Object.values(counts).some((n) => n === 0))
    throw new Error("A required collection is still empty");
  console.log(
    JSON.stringify(
      {
        projectId: env.FIREBASE_PROJECT_ID,
        organization: ORG_ID,
        collections: counts,
        accessFile,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Cloud demo setup failed",
  );
  // Stop pending SDK work on failure; a rerun resumes from persisted receipts.
  process.exit(1);
} finally {
  await db.terminate();
}
