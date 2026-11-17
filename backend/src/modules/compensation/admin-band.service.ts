import type {
  Actor,
  State,
  AdminBandInput,
  AdminSalaryBand,
  AdminBandWorkspace,
} from "@hoosoo/shared";
import { requireRole } from "../../common/authorization";
import { audit } from "../../common/audit";
import { assertVersion } from "../workflows/approval";
import { compensationPerson } from "./compensation.service";

export function adminBandWorkspace(s: State, a: Actor): AdminBandWorkspace {
  requireRole(a, ["Admin"]);
  const current = compensationPerson(s, a, a.employeeId).records.find(
    (record) => record.phase === "current",
  );
  return {
    band: s.compensationBands.Admin ?? null,
    history: Object.values(s.compensationBands)
      .filter((band) => band.id !== "Admin")
      .sort((a, b) => b.version - a.version),
    existingPackage: current
      ? { ...current.package, probationSalary: null }
      : null,
  };
}
export function saveAdminBand(s: State, a: Actor, input: AdminBandInput) {
  requireRole(a, ["Admin"]);
  const old = s.compensationBands.Admin;
  assertVersion({ version: old?.version ?? 0 }, input.version);
  const band: AdminSalaryBand = {
    ...input,
    id: "Admin",
    role: "Admin",
    version: input.version + 1,
    createdAt: new Date().toISOString(),
    createdBy: a.uid,
    changedByName: s.employees[a.employeeId]?.name ?? "Admin",
  };
  s.compensationBands.Admin = band;
  s.compensationBands[`Admin-v${band.version}`] = {
    ...structuredClone(band),
    id: `Admin-v${band.version}`,
  };
  audit(
    s,
    a,
    "compensation.admin_band_updated",
    "Admin",
    { version: band.version },
    "",
  );
  return band;
}
