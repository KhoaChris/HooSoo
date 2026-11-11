import { Router } from "express";
import { handlers, context, query } from "../../routes/helpers";
import { settingsSchema } from "@hoosoo/shared";
import { requireRole } from "../../common/authorization";
import { audit } from "../../common/audit";
import { paginate } from "../../common/query";
import { settings } from "../../common/settings";
import { readiness, readState } from "../../database/store";
import { usageSnapshot } from "../../observability/firestore-usage";
import { readAuditPage } from "../../database/ordered-reads";
import { readCacheSnapshot } from "../../database/read-cache";

export const settingsRoutes = Router();
const api = settingsRoutes;
const { get, write } = handlers(api);
get("/settings", ["settings"], (s) => settings(s));
write("patch", "/settings", settingsSchema, (s, a, input) => {
  requireRole(a, ["Admin", "HR"]);
  if (input.companyName !== undefined) requireRole(a, ["Admin"]);
  const before = structuredClone(settings(s));
  Object.assign(s.settings.main, input);
  audit(s, a, "settings.updated", "main", { before, after: s.settings.main });
  return s.settings.main;
});
api.get("/audit-logs", async (req, res) => {
  const q = query(req);
  const { a } = await context(res, [], true);
  requireRole(a, ["Admin"]);
  if (!q.search) {
    res.json(await readAuditPage(q));
    return;
  }
  const s = await readState(["auditLogs"]);
  res.json(
    paginate(
      Object.values(s.auditLogs)
        .filter(
          (l) =>
            (!q.search ||
              [l.action, l.targetId, l.actorId].join(" ").includes(q.search)) &&
            (!q.startDate || (l.createdAt || "") >= q.startDate) &&
            (!q.endDate || (l.createdAt || "").slice(0, 10) <= q.endDate),
        )
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
      q,
    ),
  );
});
api.get("/system/status", async (_req, res) => {
  const { a } = await context(res, [], true);
  requireRole(a, ["Admin"]);
  res.json(await readiness());
});
api.get("/system/usage", async (_req, res) => {
  const { a } = await context(res, [], true);
  requireRole(a, ["Admin"]);
  res.json({ ...usageSnapshot(), cache: readCacheSnapshot() });
});
