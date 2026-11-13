import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  FieldValue,
  Timestamp,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import {
  auth,
  db,
  ensureFirebaseCredentials,
} from "../src/config/firebase-admin";
import { env, ORG_ID } from "../src/config/env";
import {
  identityTables,
  planAccountIdentities,
  type IdentityDocument,
} from "./lib/account-identities";

// This is an explicit, one-time cloud migration, never part of server startup.
// Default: read-only preview. Existing Auth UIDs, emails and passwords are kept.
const apply = process.argv.includes("--apply");
if (
  env.FIREBASE_MODE !== "cloud" ||
  env.FIREBASE_PROJECT_ID !== "hoosoo-37881" ||
  ORG_ID !== "hoosoo" ||
  !process.argv.includes("--project=hoosoo-37881")
)
  throw new Error(
    "Expected --project=hoosoo-37881 and the matching cloud environment",
  );

function backupValue(value: unknown): unknown {
  if (value instanceof Timestamp)
    return { __firestoreTimestamp: [value.seconds, value.nanoseconds] };
  if (Array.isArray(value)) return value.map(backupValue);
  if (value && typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype)
      throw new Error("Unsupported backup value");
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, backupValue(v)]),
    );
  }
  return value;
}
const org = db.collection("organizations").doc(ORG_ID);
const rows = (
  docs: QueryDocumentSnapshot[],
  table: string,
): IdentityDocument[] => docs.map((d) => ({ table, id: d.id, data: d.data() }));

try {
  await ensureFirebaseCredentials();
  const result = await db.runTransaction(async (tx) => {
    const root = await tx.get(org);
    const snapshots = await Promise.all(
      identityTables.map((table) => tx.get(org.collection(table).limit(501))),
    );
    if (snapshots.some((s) => s.size > 500))
      throw new Error("Collection exceeds small-migration limit");
    const documents = snapshots.flatMap((s, i) =>
      rows(s.docs, identityTables[i]),
    );
    const plan = planAccountIdentities(documents);
    const admin = documents.find(
      (d) =>
        d.table === "memberships" && d.data.role === "Admin" && d.data.active,
    );
    if (!admin) throw new Error("No active administrator");
    if (apply && plan.writes.length) {
      // Complete backup is written successfully before any database mutation.
      const directory = new URL(
        "../.secrets/identity-migrations/",
        import.meta.url,
      );
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const backup = new URL(`${Date.now()}-${randomUUID()}.json`, directory);
      writeFileSync(
        backup,
        JSON.stringify(
          backupValue({
            project: env.FIREBASE_PROJECT_ID,
            orgId: ORG_ID,
            root: root.data(),
            documents,
            changes: plan.changes,
          }),
          null,
          2,
        ),
        { flag: "wx", mode: 0o600 },
      );
      for (const row of plan.writes) {
        tx.set(org.collection(row.table).doc(row.id), {
          ...row.data,
          // Keep audit event time/facts; this operation only moves its references.
          ...(row.table === "auditLogs"
            ? {}
            : { updatedAt: FieldValue.serverTimestamp() }),
        });
        if (row.id !== row.previousId)
          tx.delete(org.collection(row.table).doc(row.previousId));
      }
      for (const change of plan.changes) {
        const id = randomUUID();
        tx.create(org.collection("auditLogs").doc(id), {
          id,
          actorId: admin.id,
          action: "employee.updated",
          targetId: change.id,
          reason: "Chuẩn hóa tên tài khoản và mã nhân viên",
          changes: {
            before: { name: change.oldName, employeeCode: change.oldCode },
            after: { name: change.name, employeeCode: change.code },
          },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      const collections = new Set([
        ...plan.writes.map((d) => d.table),
        "auditLogs",
      ]);
      const chatMemberVersions = { ...(root.get("chatMemberVersions") ?? {}) };
      for (const change of plan.changes) {
        delete chatMemberVersions[change.oldId];
        chatMemberVersions[change.id] =
          (chatMemberVersions[change.id] ?? 0) + 1;
      }
      tx.update(org, {
        revision: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
        collectionVersions: {
          ...(root.get("collectionVersions") ?? {}),
          ...Object.fromEntries(
            [...collections].map((k) => [
              k,
              (root.get("collectionVersions")?.[k] ?? 0) + 1,
            ]),
          ),
        },
        chatMemberVersions,
        "maintenance.accountIdentitiesV1": FieldValue.serverTimestamp(),
      });
    }
    return {
      changes: plan.changes,
      writes: plan.writes.length,
      writeCount: plan.writeCount,
      accounts: plan.after
        .filter((d) => d.table === "employees" && d.data.uid)
        .map((d) => ({ uid: String(d.data.uid), name: String(d.data.name) })),
    };
  });
  // Auth profile updates are independently retryable on the next run. They do
  // not recreate accounts or revoke current sessions.
  let authProfilesUpdated = 0;
  if (apply && result.accounts.length) {
    const users = await auth.getUsers(
      result.accounts.map((a) => ({ uid: a.uid })),
    );
    if (users.notFound.length)
      throw new Error("Linked Auth account is missing");
    for (const account of result.accounts) {
      if (
        users.users.find((u) => u.uid === account.uid)?.displayName !==
        account.name
      ) {
        await auth.updateUser(account.uid, { displayName: account.name });
        authProfilesUpdated++;
      }
    }
  }
  console.log(
    JSON.stringify(
      {
        mode: apply ? "applied" : "preview",
        changes: result.changes,
        changedDocuments: result.writes,
        atomicOperations: result.writeCount,
        authProfilesUpdated,
      },
      null,
      2,
    ),
  );
} finally {
  await db.terminate();
}
