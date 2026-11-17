import { describe, it, expect } from "vitest";
import {
  serviceDefaults,
  safeCsv,
} from "../src/pages/employee-services/service-model";
import { serviceSetupSchema } from "@hoosoo/shared";
import {
  changePasswordSchema,
  localTokenLogging,
} from "../src/pages/security/security-model";
describe("employee service forms and exports", () => {
  it("prefills an approved request while preserving typed source and employee", () => {
    const d = serviceDefaults("assets", "2026-11-15", undefined, {
      id: "req",
      employeeId: "employee",
      title: "Laptop",
      kind: "equipment",
      resource: "Máy tính",
    });
    expect(d.employeeId).toBe("employee");
    expect(d.title).toBe("Máy tính");
    expect(
      serviceSetupSchema.safeParse({ ...d, assetCode: "LT-1" }).success,
    ).toBe(true);
  });
  it("does not submit hidden irrelevant fields for offboarding", () => {
    const d = serviceDefaults("offboarding", "2026-11-15");
    expect(
      serviceSetupSchema.safeParse({
        ...d,
        employeeId: "employee",
        title: "Bàn giao",
        notes: "Kết thúc hợp đồng",
      }).success,
    ).toBe(true);
    expect(d).not.toHaveProperty("assetCode");
  });
  it("escapes spreadsheet formulas, delimiters, quotes and newlines", () => {
    const out = safeCsv([
      ["=1+2", " @SUM(A1)", "Name, note", 'He said "Hi"', "line\nline"],
    ]);
    expect(out).toContain('"\'=1+2"');
    expect(out).toContain('"\' @SUM(A1)"');
    expect(out).toContain('"Name, note"');
    expect(out).toContain('"He said ""Hi"""');
    expect(out.startsWith("\ufeff")).toBe(true);
  });
});
describe("password and local developer tools", () => {
  const value = {
    currentPassword: "previous phrase",
    newPassword: "a new long passphrase",
    confirmation: "a new long passphrase",
  };
  it("requires current password, a new long password and matching confirmation", () => {
    expect(changePasswordSchema.safeParse(value).success).toBe(true);
    for (const patch of [
      { currentPassword: "" },
      { newPassword: "short", confirmation: "short" },
      { confirmation: "different" },
      {
        newPassword: value.currentPassword,
        confirmation: value.currentPassword,
      },
    ])
      expect(
        changePasswordSchema.safeParse({ ...value, ...patch }).success,
      ).toBe(false);
  });
  it("never logs API tokens on a production build or a remote dev host", () => {
    expect(localTokenLogging(true, "127.0.0.1")).toBe(true);
    expect(localTokenLogging(false, "127.0.0.1")).toBe(false);
    expect(localTokenLogging(true, "preview.example.com")).toBe(false);
  });
});
