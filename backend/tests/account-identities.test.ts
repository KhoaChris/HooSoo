import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import {
  directRoomId,
  planAccountIdentities,
  type IdentityDocument,
} from "../scripts/lib/account-identities";

const row = (
  table: string,
  id: string,
  data: Record<string, unknown> = {},
): IdentityDocument => ({ table, id, data: { id, ...data } });
const base = () => [
  row("employees", "demo-admin", {
    name: "Quản trị viên",
    employeeCode: "DEMO-001",
    uid: "auth-admin",
    managerId: "",
  }),
  row("employees", "demo-employee", {
    name: "Nhân viên Demo",
    employeeCode: "DEMO-004",
    uid: "auth-employee",
    managerId: "demo-admin",
  }),
  row("employees", "existing", {
    name: "Nguyễn An",
    employeeCode: "HS-000010",
    managerId: "demo-admin",
  }),
  row("memberships", "auth-employee", {
    employeeId: "demo-employee",
    role: "Employee",
    active: true,
  }),
];
const ids = () => {
  let n = 0;
  return () => `employee-${++n}`;
};

describe("account identity migration", () => {
  it("allocates codes after the live sequence and preserves existing identities/UIDs", () => {
    const result = planAccountIdentities(
      [...base(), row("employeeSequences", "main", { lastNumber: 15 })],
      ids(),
    );
    expect(result.changes.map((c) => c.code)).toEqual([
      "HS-000016",
      "HS-000017",
    ]);
    expect(result.after.find((d) => d.id === "employee-2")?.data).toMatchObject(
      { name: "Nhân viên", uid: "auth-employee", managerId: "employee-1" },
    );
    expect(
      result.after.find((d) => d.table === "memberships")?.data,
    ).toMatchObject({
      id: "auth-employee",
      employeeId: "employee-2",
      role: "Employee",
      active: true,
    });
    expect(result.after.find((d) => d.id === "existing")?.data).toMatchObject({
      name: "Nguyễn An",
      employeeCode: "HS-000010",
      managerId: "employee-1",
    });
    expect(planAccountIdentities(result.after, ids()).writes).toEqual([]);
  });
  it("moves derived keys, nested approval references and receipt results together", () => {
    const result = planAccountIdentities(
      [
        ...base(),
        row("attendanceRecords", "demo-employee_2026-11-10", {
          employeeId: "demo-employee",
          date: "2026-11-10",
        }),
        row("leaveBalances", "demo-employee_2026", {
          employeeId: "demo-employee",
          year: 2026,
          used: 3,
          allowance: 12,
        }),
        row("leaveBalanceTransactions", "allocation_demo-employee_2026", {
          employeeId: "demo-employee",
          year: 2026,
          amount: 12,
        }),
        row("workRegistrations", "demo-employee_2026-11-13", {
          employeeId: "demo-employee",
          date: "2026-11-13",
          managerId: "demo-admin",
          history: [{ by: "auth-admin", name: "Nhân viên Demo" }],
        }),
        row("receipts", "receipt", {
          fingerprint: "original",
          result: { id: "demo-employee_2026", employeeId: "demo-employee" },
        }),
      ],
      ids(),
    );
    expect(
      result.after.find((d) => d.table === "leaveBalances")?.data,
    ).toMatchObject({ id: "employee-2_2026", used: 3, allowance: 12 });
    expect(result.after.find((d) => d.table === "attendanceRecords")?.id).toBe(
      "employee-2_2026-11-10",
    );
    expect(
      result.after.find((d) => d.table === "leaveBalanceTransactions")?.id,
    ).toBe("allocation_employee-2_2026");
    expect(
      result.after.find((d) => d.table === "workRegistrations")?.data,
    ).toMatchObject({
      managerId: "employee-1",
      history: [{ by: "auth-admin", name: "Nhân viên" }],
    });
    expect(
      result.after.find((d) => d.table === "receipts")?.data,
    ).toMatchObject({
      fingerprint: "original",
      result: { id: "employee-2_2026", employeeId: "employee-2" },
    });
  });
  it("preserves direct/group conversations, message sequences, content and timestamp types", () => {
    const oldRoom = directRoomId(["demo-admin", "demo-employee"]),
      at = Timestamp.now();
    const result = planAccountIdentities(
      [
        ...base(),
        row("chatRooms", oldRoom, {
          kind: "direct",
          memberIds: ["demo-admin", "demo-employee"],
          ownerId: "demo-admin",
          sequence: 1,
          lastMessage: { text: "demo-admin", senderId: "demo-employee" },
        }),
        row("chatRooms", "group", {
          kind: "group",
          title: "Demo project",
          memberIds: ["demo-admin", "demo-employee"],
          ownerId: "demo-admin",
        }),
        row("chatMessages", `${oldRoom}_000000000001`, {
          roomId: oldRoom,
          sequence: 1,
          senderId: "demo-employee",
          text: "Nhân viên Demo",
          createdAt: at,
        }),
      ],
      ids(),
    );
    const newRoom = directRoomId(["employee-1", "employee-2"]);
    expect(result.after.find((d) => d.id === newRoom)?.data).toMatchObject({
      memberIds: ["employee-1", "employee-2"],
      ownerId: "employee-1",
      sequence: 1,
      lastMessage: { text: "demo-admin", senderId: "employee-2" },
    });
    expect(result.after.find((d) => d.id === "group")?.data.title).toBe(
      "Demo project",
    );
    const message = result.after.find((d) => d.table === "chatMessages")!;
    expect(message.id).toBe(`${newRoom}_000000000001`);
    expect(message.data).toMatchObject({
      roomId: newRoom,
      sequence: 1,
      senderId: "employee-2",
      text: "Nhân viên Demo",
    });
    expect(message.data.createdAt).toBe(at);
  });
  it("retains audit facts while relinking their targets", () => {
    const result = planAccountIdentities(
      [
        ...base(),
        row("auditLogs", "audit", {
          targetId: "demo-employee",
          changes: {
            before: { name: "Nhân viên Demo", employeeCode: "DEMO-004" },
          },
        }),
      ],
      ids(),
    );
    expect(
      result.after.find((d) => d.table === "auditLogs")?.data,
    ).toMatchObject({
      targetId: "employee-2",
      changes: { before: { name: "Nhân viên Demo", employeeCode: "DEMO-004" } },
    });
  });
  it("refuses collisions, ambiguous names, invalid or exhausted sequences", () => {
    expect(() => planAccountIdentities(base(), () => "existing")).toThrow(
      "destination",
    );
    expect(() =>
      planAccountIdentities(
        [row("employees", "demo", { name: "Demo", employeeCode: "DEMO-1" })],
        ids(),
      ),
    ).toThrow("replacement name");
    expect(() =>
      planAccountIdentities(
        [...base(), row("employeeSequences", "main", { lastNumber: -1 })],
        ids(),
      ),
    ).toThrow("Invalid");
    expect(() =>
      planAccountIdentities(
        [...base(), row("employeeSequences", "main", { lastNumber: 999999 })],
        ids(),
      ),
    ).toThrow("exhausted");
  });
});
