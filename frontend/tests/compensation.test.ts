import { describe, it, expect } from "vitest";
import {
  parseMoneyInput,
  nextCompensationDate,
  emptySalaryPackage,
} from "../src/pages/compensation/compensation-model";
import {
  salaryPackageSchema,
  queryAffected,
  mutationCollections,
  type CompensationPerson,
} from "@hoosoo/shared";
import { actionToast } from "../src/components/ui/action-toast";
describe("compensation form helpers", () => {
  it("accepts grouped whole VND amounts without changing invalid signs or decimals", () => {
    for (const input of ["25000000", "25.000.000", "25,000,000", "25 000 000"])
      expect(parseMoneyInput(input)).toBe(25_000_000);
    for (const input of ["-10", "1.5", "1,5", "1e6", "abc", "25.000,000"])
      expect(Number.isNaN(parseMoneyInput(input))).toBe(true);
    expect(parseMoneyInput("")).toBe(0);
    expect(salaryPackageSchema.safeParse(emptySalaryPackage()).success).toBe(
      false,
    );
  });
  it("chooses an available effective date without overwriting published history", () => {
    const p = {
      hireDate: "2026-01-01",
      records: [
        { status: "published", effectiveDate: "2026-11-15" },
        { status: "published", effectiveDate: "2026-11-16" },
      ],
    } as CompensationPerson;
    expect(nextCompensationDate(p, "2026-11-15")).toBe("2026-11-17");
    expect(
      nextCompensationDate({ ...p, hireDate: "2027-01-01" }, "2026-11-15"),
    ).toBe("2027-01-01");
  });
  it("refreshes compensation only on relevant changes including hiring", () => {
    expect(
      queryAffected(
        "/compensation?scope=my",
        mutationCollections("/recruitment/candidates/c/hire"),
      ),
    ).toBe(true);
    expect(
      queryAffected(
        "/compensation?scope=team",
        mutationCollections("/compensation/records/r/publish"),
      ),
    ).toBe(true);
    expect(queryAffected("/compensation?scope=my", ["attendanceRecords"])).toBe(
      false,
    );
  });
  it("uses red for cancellations and green for published compensation", () => {
    expect(actionToast({ path: "/compensation/records/r/cancel" }).tone).toBe(
      "error",
    );
    expect(actionToast({ path: "/compensation/records/r/publish" }).tone).toBe(
      "success",
    );
  });
});
