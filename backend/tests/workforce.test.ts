import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  timeRequestSchema,
  payrollSetupSchema,
  personnelChangeSchema,
  personnelDocumentSchema,
  announcementSchema,
  type State,
  type Table,
} from "@hoosoo/shared";
import { fixture, actor } from "./fixture";
import {
  createTime,
  actTime,
  timeView,
  pendingDays,
} from "../src/modules/workforce/time.service";
import { createLeave } from "../src/modules/leave/leave.service";
import {
  payrollSource,
  savePayroll,
  actPayroll,
  payrollView,
} from "../src/modules/workforce/payroll.service";
import {
  saveChange,
  actChange,
} from "../src/modules/workforce/changes.service";
import {
  saveAnnouncement,
  actAnnouncement,
  announcementVisible,
  announcementView,
  acknowledgementReport,
} from "../src/modules/workforce/announcements.service";
import {
  saveDocument,
  archiveDocument,
  downloadDocument,
  documentView,
  employmentLetter,
} from "../src/modules/workforce/documents.service";
import {
  previewImport,
  commitImport,
} from "../src/modules/workforce/import.service";
import { deadlines } from "../src/modules/workforce/deadlines.service";
import { commandState } from "../src/common/command-state";
import { workforceReplay } from "../src/modules/workforce/replay";
import {
  emptyState,
  type ReadPlan,
  type ReadSelection,
} from "../src/database/store";
import {
  parseCsv,
  mapRows,
  checkWorkbookSize,
  readImport,
} from "../../frontend/src/pages/workforce/import-model";
const hr = actor("HR"),
  admin = actor("Admin"),
  manager = actor("Manager"),
  employee = actor("Employee"),
  outsider = actor("Employee", "outsider"),
  reason = "Reviewed supporting evidence";
const action = (version: number) => ({ version, reason });
const request = (patch: Record<string, unknown> = {}) =>
  timeRequestSchema.parse({
    kind: "hourly_leave",
    date: "2026-10-19",
    start: "08:00",
    end: "12:00",
    leaveTypeId: "annual",
    reason,
    ...patch,
  });
function salary(s: State) {
  s.compensationRecords.salary = {
    id: "salary",
    employeeId: "employee",
    effectiveDate: "2026-01-01",
    status: "published",
    version: 1,
    history: [],
    reason,
    sourceCandidateId: "",
    package: {
      currency: "VND",
      basis: "gross_monthly",
      baseSalary: 23_000_000,
      probationSalary: null,
      allowances: [],
      benefits: [],
      bonusPolicy: "",
    },
  };
}
const payroll = (patch: Record<string, unknown> = {}) =>
  payrollSetupSchema.parse({
    employeeId: "employee",
    period: "2026-10",
    version: 0,
    earnings: [],
    deductions: [],
    overtimeRate: 100_000,
    reason,
    ...patch,
  });
const proposal = (patch: Record<string, unknown> = {}) =>
  personnelChangeSchema.parse({
    employeeId: "employee",
    kind: "transfer",
    departmentId: "b",
    positionId: "dev",
    managerId: "manager2",
    effectiveDate: "2026-11-16",
    version: 0,
    reason,
    ...patch,
  });
const document = (patch: Record<string, unknown> = {}) =>
  personnelDocumentSchema.parse({
    employeeId: "employee",
    title: "Qualification record",
    category: "qualification",
    expiresOn: "2026-11-20",
    fileName: "qualification.pdf",
    mime: "application/pdf",
    data: Buffer.from("%PDF-1.7\nQA fixture").toString("base64"),
    version: 0,
    reason,
    ...patch,
  });
const announcement = (patch: Record<string, unknown> = {}) =>
  announcementSchema.parse({
    title: "Company policy",
    body: "Read and acknowledge this updated policy",
    kind: "policy",
    departmentIds: ["a"],
    requiresAcknowledgement: true,
    pinned: false,
    publishOn: "2026-11-15",
    expiresOn: "",
    version: 0,
    ...patch,
  });
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-15T06:00:00Z"));
});
afterEach(() => vi.useRealTimers());
describe("hourly leave and overtime", () => {
  it("excludes break, reserves balance, debits and refunds once", () => {
    const s = fixture(),
      r = createTime(s, employee, request({ end: "13:00" }));
    expect(r.minutes).toBe(240);
    expect(r.days).toBe(0.4444);
    expect(pendingDays(s, "employee", 2026)).toBe(r.days);
    const approved = actTime(s, manager, r.id, "approve", action(r.version));
    expect(s.leaveBalances.employee_2026.used).toBe(r.days);
    expect(() =>
      actTime(s, manager, r.id, "cancel", action(approved.version)),
    ).toThrow();
    const cancelled = actTime(s, hr, r.id, "cancel", action(approved.version));
    expect(s.leaveBalances.employee_2026.used).toBe(0);
    expect(() =>
      actTime(s, hr, r.id, "cancel", action(cancelled.version)),
    ).toThrow();
  });
  it("blocks self approval and out-of-scope reviewers", () => {
    const s = fixture(),
      r = createTime(s, employee, request());
    for (const a of [employee, actor("Manager", "manager2"), outsider])
      expect(() => actTime(s, a, r.id, "approve", action(r.version))).toThrow();
    expect(() =>
      timeView(s, actor("Manager", "manager2"), s.timeRequests[r.id]),
    ).toThrow();
    expect(actTime(s, manager, r.id, "reject", action(r.version)).status).toBe(
      "rejected",
    );
  });
  it("reserves pending hours against full-day leave", () => {
    const s = fixture();
    s.leaveBalances.employee_2026 = {
      id: "employee_2026",
      employeeId: "employee",
      year: 2026,
      allowance: 1,
      used: 0,
    };
    createTime(s, employee, request());
    expect(() =>
      createLeave(s, employee, {
        leaveTypeId: "annual",
        startDate: "2026-10-20",
        endDate: "2026-10-20",
        reason,
      }),
    ).toThrow();
  });
  it("blocks full-day and hourly overlap in both directions", () => {
    const leave = {
        leaveTypeId: "annual",
        startDate: "2026-10-19",
        endDate: "2026-10-19",
        reason,
      },
      s = fixture();
    createTime(s, employee, request());
    expect(() =>
      createTime(s, employee, request({ start: "10:00", end: "15:00" })),
    ).toThrow();
    expect(() => createLeave(s, employee, leave)).toThrow();
    const other = fixture();
    createLeave(other, employee, leave);
    expect(() => createTime(other, employee, request())).toThrow();
  });
  it.each([
    { start: "12:00", end: "13:00" },
    { start: "07:00", end: "08:00" },
    { date: "2026-10-18" },
    { kind: "overtime", start: "08:00", end: "12:00" },
  ])("rejects invalid hours %j", (patch) =>
    expect(() => createTime(fixture(), employee, request(patch))).toThrow(),
  );
  it("rejects stale decisions and allows own pending cancellation", () => {
    const s = fixture(),
      r = createTime(
        s,
        employee,
        request({
          kind: "overtime",
          start: "18:00",
          end: "20:00",
          leaveTypeId: "",
        }),
      );
    expect(() =>
      actTime(s, manager, r.id, "approve", action(r.version - 1)),
    ).toThrow();
    expect(actTime(s, employee, r.id, "cancel", action(r.version)).status).toBe(
      "cancelled",
    );
  });
});
describe("payroll snapshots and scope", () => {
  it("uses effective salary, attendance-matched overtime and explicit adjustments", () => {
    const s = fixture();
    salary(s);
    s.attendanceRecords.att = {
      id: "att",
      employeeId: "employee",
      date: "2026-10-19",
      checkIn: "2026-10-19T01:00:00Z",
      checkOut: "2026-10-19T12:00:00Z",
      schedule: s.settings.main.schedule,
      adjustments: [],
    };
    const time = createTime(
      s,
      employee,
      request({ kind: "overtime", start: "18:00", end: "20:00" }),
    );
    actTime(s, manager, time.id, "approve", action(time.version));
    const src = payrollSource(s, "employee", "2026-10");
    expect(src.baseAmount).toBe(23_000_000);
    expect(src.overtimeMinutes).toBe(60);
    const r = savePayroll(
      s,
      hr,
      payroll({
        earnings: [{ label: "Bonus", amount: 500_000 }],
        deductions: [{ label: "Deduction", amount: 100_000 }],
      }),
    );
    expect(r.netAmount).toBe(23_500_000);
    expect(r.source.missingAttendanceDates.length).toBeGreaterThan(0);
    expect(() => savePayroll(s, hr, payroll())).toThrow();
  });
  it("requires independent approval, protects drafts and retains immutable revisions", () => {
    const s = fixture();
    salary(s);
    let r = savePayroll(s, hr, payroll());
    expect(() => payrollView(s, employee, r)).toThrow();
    expect(() => savePayroll(s, manager, payroll())).toThrow();
    r = actPayroll(s, hr, r.id, "submit", action(r.version));
    expect(() =>
      actPayroll(s, hr, r.id, "approve", action(r.version)),
    ).toThrow();
    r = actPayroll(s, admin, r.id, "approve", action(r.version));
    r = actPayroll(s, admin, r.id, "publish", action(r.version));
    expect(payrollView(s, employee, r).netAmount).toBe(23_000_000);
    expect(() => payrollView(s, outsider, r)).toThrow();
    expect(() => createTime(s, employee, request())).toThrow();
    s.compensationRecords.salary.package.baseSalary = 25_000_000;
    expect(r.source.baseAmount).toBe(23_000_000);
    r = actPayroll(s, admin, r.id, "void", action(r.version));
    r = actPayroll(s, admin, r.id, "reissue", action(r.version));
    expect(r.revisions[0].source.baseAmount).toBe(23_000_000);
    expect(r.status).toBe("draft");
  });
  it("detects source drift, pending requests and unfinished months", () => {
    const s = fixture();
    salary(s);
    let r = savePayroll(s, hr, payroll());
    s.compensationRecords.salary.version++;
    expect(() =>
      actPayroll(s, hr, r.id, "submit", action(r.version)),
    ).toThrow();
    r = savePayroll(s, hr, payroll({ version: r.version }));
    const tr = createTime(s, employee, request());
    expect(() =>
      actPayroll(s, hr, r.id, "submit", action(r.version)),
    ).toThrow();
    actTime(s, employee, tr.id, "cancel", action(tr.version));
    r = savePayroll(s, hr, payroll({ period: "2026-11" }));
    expect(() =>
      actPayroll(s, hr, r.id, "submit", action(r.version)),
    ).toThrow();
  });
  it("forbids HR payroll for Admin and self processing", () => {
    const s = fixture();
    expect(() =>
      savePayroll(s, hr, payroll({ employeeId: "admin" })),
    ).toThrow();
    expect(() =>
      savePayroll(s, admin, payroll({ employeeId: "admin" })),
    ).toThrow();
  });
  it("prorates a midmonth salary change", () => {
    const s = fixture();
    salary(s);
    s.compensationRecords.raise = {
      ...structuredClone(s.compensationRecords.salary),
      id: "raise",
      effectiveDate: "2026-10-16",
      package: {
        ...structuredClone(s.compensationRecords.salary.package),
        baseSalary: 46_000_000,
      },
    };
    const amount = payrollSource(s, "employee", "2026-10").baseAmount;
    expect(amount).toBeGreaterThan(23_000_000);
    expect(amount).toBeLessThan(46_000_000);
  });
});
describe("effective personnel changes", () => {
  it("requires independent approval and waits for effective date", () => {
    const s = fixture();
    let r = saveChange(s, hr, proposal());
    r = actChange(s, hr, r.id, "submit", action(r.version));
    expect(() =>
      actChange(s, hr, r.id, "approve", action(r.version)),
    ).toThrow();
    r = actChange(s, admin, r.id, "approve", action(r.version));
    expect(() => actChange(s, hr, r.id, "apply", action(r.version))).toThrow();
    vi.setSystemTime(new Date("2026-11-16T06:00:00Z"));
    r = actChange(s, hr, r.id, "apply", action(r.version));
    expect(r.status).toBe("applied");
    expect(s.employees.employee.departmentId).toBe("b");
    expect(s.employees.employee.managerId).toBe("manager2");
  });
  it("protects Admin, stale fields and manager assignment", () => {
    const s = fixture();
    expect(() =>
      saveChange(s, hr, proposal({ employeeId: "admin" })),
    ).toThrow();
    expect(() =>
      saveChange(s, hr, proposal({ managerId: "manager" })),
    ).toThrow();
    let r = saveChange(s, hr, proposal());
    s.employees.employee.managerId = "";
    expect(() => actChange(s, hr, r.id, "submit", action(r.version))).toThrow();
    r = actChange(s, hr, r.id, "cancel", action(r.version));
    expect(r.status).toBe("cancelled");
  });
});
describe("protected documents", () => {
  it("keeps version bytes and excludes chunks from list data", () => {
    const s = fixture();
    let r = saveDocument(s, employee, document());
    const before = downloadDocument(s, employee, r.id, 1).sha256;
    r = saveDocument(
      s,
      employee,
      document({
        version: r.version,
        data: Buffer.from("%PDF-1.7\nUpdated").toString("base64"),
      }),
      r.id,
    );
    expect(r.files).toHaveLength(2);
    expect(downloadDocument(s, hr, r.id, 1).sha256).toBe(before);
    expect(
      JSON.stringify(documentView(s, employee, s.personnelDocuments[r.id])),
    ).not.toContain("objectKey");
    for (const a of [manager, outsider])
      expect(() => downloadDocument(s, a, r.id, 2)).toThrow();
    r = archiveDocument(s, employee, r.id, action(r.version));
    expect(r.canEdit).toBe(false);
    expect(() =>
      saveDocument(s, employee, document({ version: r.version }), r.id),
    ).toThrow();
  });
  it("rejects spoofed types, self-issued letters, Admin edits and corrupt chunks", () => {
    const s = fixture();
    expect(() =>
      saveDocument(s, employee, document({ mime: "image/png" })),
    ).toThrow();
    expect(() =>
      saveDocument(s, employee, document({ category: "employment_letter" })),
    ).toThrow();
    expect(() =>
      saveDocument(s, hr, document({ employeeId: "admin" })),
    ).toThrow();
    const r = saveDocument(s, employee, document());
    expect(() => downloadDocument(s, employee, r.id, 99)).toThrow();
  });
  it("generates letters from approved requests only", () => {
    const s = fixture();
    s.internalRequests.letter = {
      id: "letter",
      employeeId: "employee",
      managerId: "manager",
      managerApprovedBy: "",
      status: "pending_hr",
      version: 1,
      history: [],
      kind: "employment_certificate",
      title: "Confirm employment",
      reason,
      startDate: "2026-11-15",
      endDate: "2026-11-15",
      location: "",
      checkIn: "",
      checkOut: "",
      attendanceBefore: null,
      resolution: "",
    };
    expect(() => employmentLetter(s, employee, "letter")).toThrow();
    s.internalRequests.letter.status = "approved";
    expect(employmentLetter(s, employee, "letter").employeeName).toBe(
      "employee",
    );
    expect(() => employmentLetter(s, manager, "letter")).toThrow();
  });
});
describe("announcements", () => {
  it("enforces audience and version-specific acknowledgements", () => {
    const s = fixture();
    let r = saveAnnouncement(s, hr, announcement());
    expect(announcementVisible(s, employee, r)).toBe(false);
    r = actAnnouncement(s, hr, r.id, "publish", action(r.version));
    expect(announcementVisible(s, outsider, r)).toBe(false);
    r = actAnnouncement(s, employee, r.id, "acknowledge", action(r.version));
    expect(r.acknowledged).toBe(true);
    actAnnouncement(s, employee, r.id, "acknowledge", action(r.version));
    expect(Object.keys(s.announcementReceipts)).toHaveLength(1);
    expect(
      acknowledgementReport(s, hr, r.id).find((e) => e.id === "employee")
        ?.acknowledgedAt,
    ).toBeTruthy();
    r = saveAnnouncement(
      s,
      hr,
      announcement({
        version: r.version,
        body: "New revision requiring another acknowledgement",
      }),
      r.id,
    );
    r = actAnnouncement(s, hr, r.id, "publish", action(r.version));
    expect(announcementView(s, employee, r).acknowledged).toBe(false);
    expect(() =>
      actAnnouncement(s, employee, r.id, "acknowledge", action(r.version - 1)),
    ).toThrow();
  });
  it("hides drafts, scheduled and archived posts from employees", () => {
    const s = fixture();
    expect(() => saveAnnouncement(s, employee, announcement())).toThrow();
    let r = saveAnnouncement(
      s,
      admin,
      announcement({ publishOn: "2026-11-16" }),
    );
    r = actAnnouncement(s, admin, r.id, "publish", action(r.version));
    expect(announcementVisible(s, employee, r)).toBe(false);
    r = actAnnouncement(s, admin, r.id, "archive", action(r.version));
    expect(announcementVisible(s, employee, r)).toBe(false);
  });
});
describe("employee import", () => {
  const rows = () => [
    {
      name: "QA Example",
      email: "qa-unique@example.test",
      departmentId: "Dept a",
      positionId: "Developer",
      hireDate: "2026-11-15",
      status: "active",
      managerId: "MANAGER",
    },
  ];
  it("previews without writing and commits the validated batch", () => {
    const s = fixture(),
      before = JSON.stringify(s),
      preview = previewImport(s, hr, rows());
    expect(JSON.stringify(s)).toBe(before);
    expect(preview.canCommit).toBe(true);
    const result = commitImport(s, hr, {
      rows: rows(),
      fingerprint: preview.fingerprint,
    });
    expect(result.createdIds).toHaveLength(1);
    expect(s.employees[result.createdIds[0]].managerId).toBe("manager");
    expect(s.employees[result.createdIds[0]].employeeCode).toMatch(/^HS-/);
  });
  it("preserves background and omitted fields", () => {
    const s = fixture();
    s.employees.employee.background = {
      version: 2,
      education: [],
      experience: [],
      skills: ["Retained custom skill"],
      certificates: [],
    };
    const input = [
        {
          employeeCode: "EMPLOYEE",
          name: "Updated name",
          email: s.employees.employee.email,
        },
      ],
      preview = previewImport(s, hr, input);
    expect(preview.canCommit).toBe(true);
    commitImport(s, hr, { rows: input, fingerprint: preview.fingerprint });
    expect(s.employees.employee.background?.skills).toEqual([
      "Retained custom skill",
    ]);
    expect(s.employees.employee.phone).toBe("private phone");
  });
  it("blocks duplicates, Admin edits, added role columns, stale preview and manager writes", () => {
    const s = fixture();
    expect(previewImport(s, hr, [...rows(), ...rows()]).canCommit).toBe(false);
    expect(
      previewImport(s, hr, [
        {
          employeeCode: "ADMIN",
          name: "Overwrite",
          email: s.employees.admin.email,
        },
      ]).canCommit,
    ).toBe(false);
    expect(
      previewImport(s, hr, [{ ...rows()[0], role: "Admin" }]).canCommit,
    ).toBe(false);
    expect(() => previewImport(s, manager, rows())).toThrow();
    const preview = previewImport(s, hr, rows());
    s.employees.employee.name = "Concurrent edit";
    expect(() =>
      commitImport(s, hr, { rows: rows(), fingerprint: preview.fingerprint }),
    ).toThrow();
  });
  it("parses quoted CSV and rejects malformed headers and ZIP containers", () => {
    expect(
      parseCsv('name,email\r\n"Name, quoted",example@test.example'),
    ).toEqual([
      ["name", "email"],
      ["Name, quoted", "example@test.example"],
    ]);
    expect(
      mapRows([
        ["Họ tên", "email"],
        ["Name", "test@example.test"],
      ])[0].name,
    ).toBe("Name");
    expect(() =>
      mapRows([
        ["name", "name"],
        ["a", "b"],
      ]),
    ).toThrow();
    expect(() => checkWorkbookSize(new ArrayBuffer(30))).toThrow();
  });
});
describe("read boundaries", () => {
  function reader(source: State, plans: ReadPlan[]) {
    return async (plan: ReadPlan) => {
      plans.push(plan);
      const s = emptyState();
      for (const [table, selection] of Object.entries(plan)) {
        const match = (
          r: Record<string, unknown>,
          sel: ReadSelection,
        ): boolean => {
          if (sel === true) return true;
          if ("ids" in sel) return sel.ids.includes(String(r.id));
          if ("any" in sel) return sel.any.some((x) => match(r, x));
          if ("filters" in sel) return sel.filters.every((x) => match(r, x));
          if (sel.op === "in")
            return (sel.value as string[]).includes(String(r[sel.field]));
          return r[sel.field] === sel.value;
        };
        for (const item of Object.values(source[table as Table]))
          if (match(item as unknown as Record<string, unknown>, selection!))
            (s[table as Table] as Record<string, unknown>)[item.id] =
              structuredClone(item);
      }
      return s;
    };
  }
  it("loads payroll inputs by employee and never loads document bytes", async () => {
    const s = fixture();
    salary(s);
    const r = savePayroll(s, hr, payroll()),
      plans: ReadPlan[] = [];
    const loaded = await commandState(
      reader(s, plans),
      hr.uid,
      `/workforce/payroll/${r.id}/submit`,
      action(r.version),
      "receipt",
    );
    expect(loaded.compensationRecords.salary).toBeTruthy();
    expect(plans.some((p) => "personnelDocumentFiles" in p)).toBe(false);
    expect(
      plans
        .filter((p) => p.attendanceRecords)
        .every((p) => p.attendanceRecords !== true),
    ).toBe(true);
    expect(() =>
      workforceReplay(s, manager, "/workforce/time/missing/approve", {
        id: "missing",
        employeeId: "employee",
      }),
    ).toThrow();
  });
  it("projects deadlines without writes or cross-user disclosure", () => {
    const s = fixture();
    saveDocument(s, employee, document());
    saveDocument(
      s,
      outsider,
      document({ employeeId: "outsider", title: "Out of scope" }),
    );
    const before = JSON.stringify(s),
      rows = deadlines(s, employee, "2026-11-01", "2026-11-30");
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(s)).toBe(before);
    expect(rows[0].employeeName).toBe("employee");
  });
});

describe("edited records and reporting changes", () => {
  it("uses edited payroll amounts and prevents the last editor from approving", () => {
    const s = fixture();
    salary(s);
    let r = savePayroll(s, hr, payroll());
    r = savePayroll(
      s,
      admin,
      payroll({
        version: r.version,
        earnings: [{ label: "Validated bonus", amount: 500000 }],
      }),
    );
    expect(r.earnings[0].amount).toBe(500000);
    expect(r.netAmount).toBe(r.source.baseAmount + 500000);
    r = actPayroll(s, admin, r.id, "submit", action(r.version));
    expect(() =>
      actPayroll(s, admin, r.id, "approve", action(r.version)),
    ).toThrow();
    expect(actPayroll(s, hr, r.id, "approve", action(r.version)).status).toBe(
      "approved",
    );
  });
  it("uses revised proposal and re-evaluates pending approvals against the new department", () => {
    const s = fixture(),
      pending = createTime(s, employee, request());
    let r = saveChange(s, hr, proposal());
    r = saveChange(
      s,
      admin,
      proposal({ version: r.version, reason: "Updated department assignment" }),
      r.id,
    );
    expect(r.reason).toBe("Updated department assignment");
    r = actChange(s, admin, r.id, "submit", action(r.version));
    expect(() =>
      actChange(s, admin, r.id, "approve", action(r.version)),
    ).toThrow();
    r = actChange(s, hr, r.id, "approve", action(r.version));
    vi.setSystemTime(new Date("2026-11-16T06:00:00Z"));
    actChange(s, hr, r.id, "apply", action(r.version));
    expect(() =>
      actTime(s, manager, pending.id, "approve", action(pending.version)),
    ).toThrow();
    expect(
      actTime(
        s,
        actor("Manager", "manager2"),
        pending.id,
        "approve",
        action(pending.version),
      ).status,
    ).toBe("approved");
  });
  it("reads a real XLSX workbook and rejects formulas", async () => {
    vi.useRealTimers();
    const ExcelJS = await import("exceljs"),
      book = new ExcelJS.Workbook(),
      sheet = book.addWorksheet("Employees");
    sheet.addRow(["name", "email"]);
    sheet.addRow(["XLSX Employee", "xlsx@example.test"]);
    const bytes = await book.xlsx.writeBuffer();
    const rows = await readImport(
      new File([bytes as unknown as BlobPart], "employees.xlsx"),
    );
    expect(rows[0].name).toBe("XLSX Employee");
    sheet.getCell("A2").value = { formula: "1+1", result: 2 };
    const unsafe = await book.xlsx.writeBuffer();
    await expect(
      readImport(new File([unsafe as unknown as BlobPart], "unsafe.xlsx")),
    ).rejects.toThrow();
  });
});
