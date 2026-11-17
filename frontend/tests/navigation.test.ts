import { describe, expect, it } from "vitest";
import { roles } from "@hoosoo/shared";
import {
  navigation,
  navigationFor,
  activeNavigation,
  normalizeNavigationSearch,
} from "../src/layouts/navigation";
describe("workspace navigation", () => {
  it.each(roles)("keeps %s routes unique and authorized", (role) => {
    const actual = navigationFor(role).flatMap((group) =>
      group.items.map((item) => item.path),
    );
    expect([...actual].sort()).toEqual(
      navigation
        .filter((item) => item.roles.includes(role))
        .map((item) => item.path)
        .sort(),
    );
    expect(new Set(actual).size).toBe(actual.length);
  });
  it.each([
    "/compensation/my",
    "/employment/my",
    "/performance/my",
    "/settings/hr",
    "/requests/approvals",
    "/attendance/my",
  ])("selects the most specific route for %s", (path) => {
    expect(activeNavigation(path)?.path).toBe(path);
  });
  it("matches detail routes and accent-free Vietnamese search", () => {
    expect(activeNavigation("/employees/person-1")?.path).toBe("/employees");
    expect(activeNavigation("/employees-other")).toBeUndefined();
    expect(normalizeNavigationSearch("Đãi Ngộ")).toBe("dai ngo");
  });
});
