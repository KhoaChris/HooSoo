import { describe, expect, it } from "vitest";
import {
  roles,
  professionalRoles,
  supervisorRoles,
  type WorkItemView,
} from "@hoosoo/shared";
import {
  dashboardRole,
  dashboardLinks,
  dashboardPaths,
  pendingWorkflowCount,
  priorityWork,
  isOverdueWork,
} from "../src/pages/dashboard/dashboard-model";
import { navigation } from "../src/layouts/navigation";
import { canonicalApiPath } from "../src/services/query-cache";
const range = { start: "2026-11-01", end: "2026-11-30" };

describe("role-specific dashboard", () => {
  it.each(roles)(
    "keeps %s links and resource requests within existing permissions",
    (role) => {
      const paths = dashboardPaths(role, range);
      expect(!!paths.work).toBe(professionalRoles.includes(role));
      expect(!!paths.recruitment).toBe(supervisorRoles.includes(role));
      expect(!!paths.leaves).toBe(supervisorRoles.includes(role));
      expect(paths.schedules.includes("approvals=true")).toBe(
        supervisorRoles.includes(role),
      );
      const allowed = navigation
        .filter((n) => n.roles.includes(role))
        .map((n) => n.path);
      expect(allowed).toContain(dashboardRole(role).primaryPath);
      for (const item of dashboardLinks(role))
        expect(allowed).toContain(item.path);
      expect(
        dashboardLinks(role).some((item) => item.section === "admin"),
      ).toBe(role === "Admin");
    },
  );
  it("separates HR, administration, management and professional focus", () => {
    expect(dashboardRole("Admin").focus).toBe("organization");
    expect(dashboardRole("HR").focus).toBe("recruitment");
    expect(dashboardRole("Manager").focus).toBe("team");
    expect(dashboardRole("Developer").focus).toBe("work");
    expect(dashboardRole("Employee").focus).toBe("personal");
    expect(new Set(roles.map((role) => dashboardRole(role).title)).size).toBe(
      roles.length,
    );
  });
  it("reuses feature cache keys and bounds workflow queries to the selected dates", () => {
    const paths = dashboardPaths("HR", range);
    expect(canonicalApiPath(paths.schedules)).toBe(
      canonicalApiPath(
        "/work-registrations?startDate=2026-11-01&endDate=2026-11-30&approvals=true",
      ),
    );
    for (const path of [
      paths.base,
      paths.requests,
      paths.schedules,
      paths.leaves!,
    ]) {
      const params = new URL(path, "http://local").searchParams;
      expect(params.get("startDate")).toBe(range.start);
      expect(params.get("endDate")).toBe(range.end);
    }
    expect(dashboardPaths("Developer", range).work).toBe(
      "/professional/workspace",
    );
    expect(
      Object.values(paths).some(
        (path) => path?.includes("candidates") || path?.includes("system"),
      ),
    ).toBe(false);
  });
  it("only counts actionable pending approvals for a supervisor", () => {
    const items = [
      { status: "pending_manager", canReview: true },
      { status: "pending_hr", canReview: false },
      { status: "approved", canReview: true },
      { status: "rejected", canReview: false },
      { status: "cancelled", canReview: false },
      { status: "pending_hr", canReview: true },
    ];
    expect(pendingWorkflowCount(items, true)).toBe(2);
    expect(pendingWorkflowCount(items, false)).toBe(3);
  });
});
const work = (id: string, patch: Partial<WorkItemView> = {}) =>
  ({
    id,
    status: "open",
    dueDate: "2026-11-20",
    priority: "normal",
    actions: [],
    ...patch,
  }) as WorkItemView;
describe("work attention ordering", () => {
  it("prioritizes review rights, overdue work, and changes requested without mutating cache", () => {
    const items = [
      work("normal"),
      work("done", { status: "done", dueDate: "2020-01-01" }),
      work("late", { dueDate: "2026-11-12" }),
      work("review", { status: "in_review", actions: ["approve"] }),
      work("cancelled", { status: "cancelled" }),
      work("returned", { status: "returned" }),
      work("urgent", { priority: "high" }),
    ];
    const before = items.map((item) => item.id);
    expect(priorityWork(items, "2026-11-13").map((item) => item.id)).toEqual([
      "review",
      "late",
      "returned",
      "urgent",
      "normal",
    ]);
    expect(items.map((item) => item.id)).toEqual(before);
    expect(
      isOverdueWork(work("today", { dueDate: "2026-11-13" }), "2026-11-13"),
    ).toBe(false);
    expect(isOverdueWork(items[1], "2026-11-13")).toBe(false);
  });
});
