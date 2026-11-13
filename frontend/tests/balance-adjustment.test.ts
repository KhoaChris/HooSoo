import { describe, expect, it } from "vitest";
import {
  adjustmentLimit,
  prepareBalanceAdjustment,
  previewBalanceAdjustment,
} from "../src/pages/settings/balance-adjustment-model";

const balance = {
  year: 2026,
  allowance: 12,
  used: 5,
  pending: 4,
  canAdjust: true,
};
const reason = "Cập nhật quỹ phép theo chính sách";

describe("leave allowance adjustment", () => {
  it("maps positive days and explicit direction to the existing API contract", () => {
    expect(
      prepareBalanceAdjustment(balance, "increase", "2", `  ${reason}  `),
    ).toEqual({ success: true, data: { year: 2026, amount: 2, reason } });
    expect(prepareBalanceAdjustment(balance, "decrease", "2", reason)).toEqual({
      success: true,
      data: { year: 2026, amount: -2, reason },
    });
  });
  it("rejects signed, fractional, empty, zero and out-of-range quantities", () => {
    for (const days of [
      "-2",
      "+2",
      "0",
      "",
      "1.5",
      "1e2",
      "NaN",
      "366",
      "99999999999999999999",
    ])
      expect(
        prepareBalanceAdjustment(balance, "increase", days, reason).success,
        days,
      ).toBe(false);
    expect(
      prepareBalanceAdjustment(balance, "increase", "365", reason).success,
    ).toBe(true);
  });
  it("protects approved leave and permits a zero remaining balance", () => {
    expect(adjustmentLimit(balance, "decrease")).toBe(7);
    expect(
      prepareBalanceAdjustment(balance, "decrease", "7", reason).success,
    ).toBe(true);
    expect(previewBalanceAdjustment(balance, "decrease", "7")).toEqual({
      amount: -7,
      allowance: 5,
      available: 0,
    });
    expect(
      prepareBalanceAdjustment(balance, "decrease", "8", reason).success,
    ).toBe(false);
    expect(adjustmentLimit({ ...balance, used: 12 }, "decrease")).toBe(0);
  });
  it("keeps pending leave separate, matching the server's available-balance rule", () => {
    expect(previewBalanceAdjustment(balance, "decrease", "4")).toEqual({
      amount: -4,
      allowance: 8,
      available: 3,
    });
    expect(
      prepareBalanceAdjustment(balance, "decrease", "4", reason).success,
    ).toBe(true);
  });
  it("revalidates against updated balances and permissions", () => {
    expect(
      prepareBalanceAdjustment(balance, "decrease", "5", reason).success,
    ).toBe(true);
    expect(
      prepareBalanceAdjustment(
        { ...balance, used: 10 },
        "decrease",
        "5",
        reason,
      ).success,
    ).toBe(false);
    expect(
      prepareBalanceAdjustment(
        { ...balance, canAdjust: false },
        "increase",
        "1",
        reason,
      ),
    ).toMatchObject({ success: false, field: "form" });
  });
  it("requires a meaningful reason and a valid year", () => {
    expect(
      prepareBalanceAdjustment(balance, "increase", "1", "    "),
    ).toMatchObject({ success: false, field: "reason" });
    expect(
      prepareBalanceAdjustment(balance, "increase", "1", "abc"),
    ).toMatchObject({ success: false, field: "reason" });
    expect(
      prepareBalanceAdjustment(balance, "increase", "1", "a".repeat(1001))
        .success,
    ).toBe(false);
    expect(
      prepareBalanceAdjustment(
        { ...balance, year: 2019 },
        "increase",
        "1",
        reason,
      ).success,
    ).toBe(false);
  });
});
