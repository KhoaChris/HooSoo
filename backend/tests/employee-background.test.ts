import { describe, it, expect } from "vitest";
import {
  employeeBackgroundChangeSchema,
  educationEntrySchema,
  experienceEntrySchema,
  certificateEntrySchema,
  mutationCollections,
  employeeBackgroundSchema,
  candidateHireSchema,
  defaultRecruitmentStages,
  type Role,
} from "@hoosoo/shared";
import { fixture, actor, fields } from "./fixture";
import { updateEmployeeBackground } from "../src/modules/employees/employee-background.service";
import { employeeView } from "../src/common/authorization";
import { saveEmployee } from "../src/modules/employees/employees.service";
import {
  saveJob,
  createCandidate,
  decideCandidate,
  onboardCandidate,
} from "../src/modules/recruitment/recruitment.service";
const change = (patch: Record<string, unknown> = {}) =>
  employeeBackgroundChangeSchema.parse({
    section: "skills",
    version: 0,
    items: ["TypeScript", "Quản lý dự án"],
    ...patch,
  });
const school = {
  id: "school",
  school: "Đại học",
  qualification: "Cử nhân",
  field: "CNTT",
  startYear: "2018",
  endYear: "2022",
  description: "",
};
const work = {
  id: "work",
  company: "Công ty",
  position: "Kỹ sư",
  startYear: "2022",
  endYear: "current",
  description: "Phát triển sản phẩm",
};
const certificate = {
  id: "certificate",
  name: "Cloud",
  issuer: "Provider",
  issuedYear: "2024",
  expiresYear: "2027",
  credentialUrl: "https://example.test/certificate",
};
describe("employee professional background", () => {
  it.each(["Admin", "HR", "Manager", "Employee"] as Role[])(
    "allows %s to update only their own background without changing work or account data",
    (role) => {
      const s = fixture(),
        a = actor(role),
        before = structuredClone(s),
        result = updateEmployeeBackground(s, a, a.employeeId, change());
      expect(result.background?.skills).toHaveLength(2);
      expect(result.background?.version).toBe(1);
      expect(s.memberships).toEqual(before.memberships);
      expect(s.employees[a.employeeId].status).toBe("active");
      const { background: _background, ...after } = s.employees[a.employeeId];
      expect(after).toEqual(before.employees[a.employeeId]);
    },
  );
  it.each([
    ["Admin", "hr"],
    ["HR", "employee"],
    ["Admin", "admin"],
  ] as [Role, string][])("allows %s to edit permitted %s", (role, id) => {
    expect(
      updateEmployeeBackground(fixture(), actor(role), id, change()).background
        ?.version,
    ).toBe(1);
  });
  it.each([
    ["HR", "admin"],
    ["Manager", "employee"],
    ["Manager", "outsider"],
    ["Employee", "manager"],
    ["Employee", "outsider"],
  ] as [Role, string][])("blocks %s editing %s", (role, id) => {
    const s = fixture(),
      before = structuredClone(s);
    expect(() =>
      updateEmployeeBackground(s, actor(role), id, change()),
    ).toThrow();
    expect(s).toEqual(before);
  });
  it("blocks HR editing another HR", () => {
    const s = fixture();
    s.memberships["test-outsider"].role = "HR";
    expect(() =>
      updateEmployeeBackground(s, actor("HR"), "outsider", change()),
    ).toThrow();
  });
  it("exposes read-only background to the scoped manager, hiding it from peers or superior targets", () => {
    const s = fixture();
    updateEmployeeBackground(s, actor("Employee"), "employee", change());
    expect(
      employeeView(s.employees.employee, actor("Manager"), s),
    ).toMatchObject({
      canEditBackground: false,
      background: { skills: ["TypeScript", "Quản lý dự án"] },
    });
    expect(
      employeeView(s.employees.employee, actor("Manager", "manager2"), s)
        .background,
    ).toBeUndefined();
    expect(
      employeeView(s.employees.employee, actor("Employee", "outsider"), s)
        .background,
    ).toBeUndefined();
    updateEmployeeBackground(s, actor("Admin"), "admin", change());
    expect(
      employeeView(s.employees.admin, actor("HR"), s).background,
    ).toBeUndefined();
  });
  it("preserves other sections, rejects stale writes and clears only the selected section", () => {
    const s = fixture(),
      a = actor("Employee");
    updateEmployeeBackground(
      s,
      a,
      "employee",
      change({ section: "education", items: [school] }),
    );
    updateEmployeeBackground(
      s,
      a,
      "employee",
      change({ section: "experience", version: 1, items: [work] }),
    );
    expect(() =>
      updateEmployeeBackground(s, a, "employee", change({ version: 1 })),
    ).toThrow(/thay đổi/);
    updateEmployeeBackground(
      s,
      a,
      "employee",
      change({ section: "certificates", version: 2, items: [certificate] }),
    );
    const result = updateEmployeeBackground(
      s,
      a,
      "employee",
      change({ section: "education", version: 3, items: [] }),
    );
    expect(result.background).toMatchObject({
      version: 4,
      education: [],
      experience: [work],
      certificates: [certificate],
    });
    expect(Object.keys(s.auditLogs)).toHaveLength(4);
    expect(JSON.stringify(s.auditLogs)).not.toContain("credentialUrl");
  });
  it("does not erase background when normal employee fields are saved", () => {
    const s = fixture();
    updateEmployeeBackground(s, actor("HR"), "employee", change());
    const { background, ...input } = fields(s.employees.employee);
    expect(
      saveEmployee(s, actor("HR"), { ...input, name: "Updated" }, "employee")
        .background,
    ).toEqual(background);
  });
  it.each([
    ["education", Array(11).fill(school)],
    ["experience", Array(16).fill(work)],
    ["certificates", Array(21).fill(certificate)],
    ["skills", Array(31).fill("skill")],
  ])("bounds %s entries", (section, items) => {
    expect(() => change({ section, items })).toThrow();
  });
  it("rejects duplicate ids, duplicate skills, unknown fields, role injection and bad versions", () => {
    for (const patch of [
      { items: ["Skill", "skill"] },
      { section: "education", items: [school, school] },
      { role: "Admin" },
      { employeeId: "admin" },
      { version: -1 },
      { version: 1.5 },
      { section: "unknown" },
    ])
      expect(() => change(patch)).toThrow();
  });
  it.each(["invalid", "1800", "2100", "2026-01", ""])(
    "rejects invalid year %s",
    (startYear) =>
      expect(
        educationEntrySchema.safeParse({ ...school, startYear }).success,
      ).toBe(false),
  );
  it("validates chronology and supports ongoing work", () => {
    expect(
      educationEntrySchema.safeParse({ ...school, endYear: "2010" }).success,
    ).toBe(false);
    expect(experienceEntrySchema.safeParse(work).success).toBe(true);
    expect(
      certificateEntrySchema.safeParse({ ...certificate, expiresYear: "2020" })
        .success,
    ).toBe(false);
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,hi",
    "http://example.test",
    "https://u:p@example.test",
  ])("rejects unsafe link %s", (credentialUrl) =>
    expect(
      certificateEntrySchema.safeParse({ ...certificate, credentialUrl })
        .success,
    ).toBe(false),
  );
  it("invalidates employee/profile/history caches only", () => {
    expect(mutationCollections("/me/background")).toEqual([
      "employees",
      "auditLogs",
    ]);
    expect(mutationCollections("/employees/employee/background")).toEqual([
      "employees",
      "auditLogs",
    ]);
  });
});

describe("recruitment background at hiring", () => {
  const original = {
    education:
      "Bằng cấp / trình độ: Đại học\nChuyên ngành: Kỹ thuật phần mềm\n\nBằng cấp riêng · Trường thử\n2016–2020\nThành tích cũ.",
    experience:
      "Vị trí đảm nhiệm: Lập trình viên Frontend\n\nĐơn vị thử · 2020–2026\nNghiệp vụ riêng; nội dung cũ cần giữ nguyên.",
    skills:
      "Kỹ năng & chứng chỉ:\n• Giao tiếp\n• ISTQB CTFL\n• Kỹ năng riêng\n\nIELTS 6.5\nChứng chỉ nội bộ · Đơn vị A · 2024\nhttps://example.test/credential",
  };
  function setup(role: "Admin" | "HR" = "HR", route = "employee") {
    const s = fixture(),
      a = actor(role);
    const j = saveJob(s, a, {
      title: "Hiring test",
      departmentId: "a",
      hiringManagerId: "manager",
      description: "Test",
      openings: 1,
      stages: defaultRecruitmentStages,
      active: true,
      version: 0,
    });
    const c = createCandidate(s, a, {
      jobId: j.id,
      name: "Synthetic candidate",
      email: "hire@example.test",
      phone: "0900000000",
      address: "Test address",
      ...original,
      source: "sample",
      note: "Original note",
    });
    if (route === "employee") c.status = "hired";
    if (route === "hire") {
      c.stageId = j.stages.at(-1)!.id;
      c.rounds = j.stages.map((r) => ({
        stageId: r.id,
        stageName: r.name,
        result: "passed",
      }));
    }
    const input = () =>
      candidateHireSchema.parse({
        version: c.version,
        reason: "Test background retention",
        positionId: "dev",
        workEmail: c.email,
        hireDate: "2026-11-16",
        employmentStatus: "probation",
      });
    const run = (user = a) =>
      route === "employee"
        ? onboardCandidate(s, user, c.id, input())
        : decideCandidate(
            s,
            user,
            c.id,
            route as "hire" | "direct-hire",
            input(),
          );
    return { s, a, c, run };
  }
  it.each([
    ["Admin", "employee"],
    ["HR", "employee"],
    ["Admin", "hire"],
    ["HR", "hire"],
    ["Admin", "direct-hire"],
    ["HR", "direct-hire"],
  ] as const)(
    "copies complete preset, custom and certificate content for %s / %s",
    (role, route) => {
      const { s, c, run } = setup(role, route);
      const accounts = structuredClone(s.memberships);
      run();
      const e = s.employees[c.employeeId!];
      expect(e.background?.recruitment).toMatchObject({
        ...original,
        candidateId: c.id,
      });
      expect(employeeBackgroundSchema.safeParse(e.background).success).toBe(
        true,
      );
      expect(c).toMatchObject(original);
      expect(e).toMatchObject({
        recruitmentCandidateId: c.id,
        phone: c.phone,
        address: c.address,
      });
      expect(e.background).toMatchObject({
        version: 1,
        education: [],
        experience: [],
        skills: [],
        certificates: [],
      });
      expect(s.onboardingPlans[e.id].employeeId).toBe(e.id);
      expect(e.uid).toBeUndefined();
      expect(s.memberships).toEqual(accounts);
      // Replay must not create a second employee or overwrite its snapshot.
      const before = structuredClone(s);
      expect(() => run()).toThrow();
      expect(s).toEqual(before);
    },
  );
  it("retains the full allowed lengths and whitespace without truncating or fabricating entries", () => {
    const { s, c, run } = setup();
    c.education = " aa\n".repeat(1000);
    c.experience = " e\n".repeat(2000);
    c.skills = " s\n".repeat(666) + "ss";
    const before = {
      education: c.education,
      experience: c.experience,
      skills: c.skills,
    };
    run();
    expect(s.employees[c.employeeId!].background?.recruitment).toMatchObject(
      before,
    );
    expect(
      employeeBackgroundSchema.safeParse(s.employees[c.employeeId!].background)
        .success,
    ).toBe(true);
  });
  it("keeps empty legacy fields empty", () => {
    const { s, c, run } = setup();
    c.education = c.experience = c.skills = "";
    run();
    expect(s.employees[c.employeeId!].background?.recruitment).toMatchObject({
      education: "",
      experience: "",
      skills: "",
    });
  });
  it("retains the hiring snapshot through add/edit/delete and subsequent candidate changes", () => {
    const { s, a, c, run } = setup();
    run();
    const e = s.employees[c.employeeId!];
    const source = structuredClone(e.background!.recruitment);
    c.education = "Candidate changed later";
    for (const [section, items] of [
      ["education", [school]],
      ["experience", [work]],
      ["certificates", [certificate]],
      ["skills", ["TypeScript"]],
      ["education", [{ ...school, description: "Updated" }]],
      ["education", []],
      ["experience", []],
      ["certificates", []],
      ["skills", []],
    ] as const) {
      updateEmployeeBackground(
        s,
        a,
        e.id,
        employeeBackgroundChangeSchema.parse({
          section,
          items,
          version: e.background!.version,
        }),
      );
      expect(e.background!.recruitment).toEqual(source);
    }
    const { background: _background, ...input } = fields(e);
    saveEmployee(s, a, { ...input, name: "Updated name" }, e.id);
    expect(s.employees[e.id].background!.recruitment).toEqual(source);
    expect(() =>
      employeeBackgroundChangeSchema.parse({
        section: "skills",
        items: [],
        version: 1,
        recruitment: source,
      }),
    ).toThrow();
    expect(JSON.stringify(s.auditLogs)).not.toContain(original.skills);
  });
  it("protects the original background using the existing employee scope", () => {
    const { s, c, run } = setup();
    run();
    const e = s.employees[c.employeeId!];
    const self = { ...actor("Employee"), employeeId: e.id };
    for (const user of [actor("Admin"), actor("HR"), actor("Manager"), self])
      expect(employeeView(e, user, s).background?.recruitment).toMatchObject(
        original,
      );
    for (const user of [actor("Employee"), actor("Manager", "manager2")])
      expect(employeeView(e, user, s).background).toBeUndefined();
    expect(employeeView(e, actor("Manager"), s).canEditBackground).toBe(false);
  });
  it.each(["employee", "hire", "direct-hire"])(
    "blocks unauthorized conversion via %s without mutation",
    (route) => {
      for (const user of [
        actor("Employee"),
        actor("Manager"),
        actor("Manager", "manager2"),
      ]) {
        const { s, run } = setup("HR", route),
          before = structuredClone(s);
        expect(() => run(user)).toThrow();
        expect(s).toEqual(before);
      }
    },
  );
  it("does not overwrite an existing employee with the same email", () => {
    const { s, c, run } = setup();
    c.email = s.employees.employee.email;
    const before = structuredClone(s);
    expect(() => run()).toThrow();
    expect(s).toEqual(before);
  });
});
