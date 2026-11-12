import { Router } from "express";
import {
  workRegistrationSchema,
  internalRequestSchema,
  reviewSchema,
  type Query,
} from "@hoosoo/shared";
import { handlers, context, query, param } from "../../routes/helpers";
import { workflowRead } from "./workflows.reads";
import { approvalView, visible } from "./approval";
import {
  registerWork,
  createInternalRequest,
  actOnWorkflow,
} from "./workflows.service";
export const workflowsRoutes = Router();
const { write } = handlers(workflowsRoutes);
for (const [path, table] of [
  ["/work-registrations", "workRegistrations"],
  ["/internal-requests", "internalRequests"],
] as const) {
  workflowsRoutes.get(path, async (req, res) => {
    const q = query(req),
      { s, a } = await context(res, [], true);
    await workflowRead(s, a, table, q);
    const matches = (date: string, q: Query) =>
      (!q.startDate || date >= q.startDate) &&
      (!q.endDate || date <= q.endDate);
    const items = Object.values(s[table])
      .filter(
        (r) =>
          visible(s, a, r, q.approvals === "true") &&
          matches("date" in r ? r.date : r.startDate, q),
      )
      .map((r) => ({ ...r, ...approvalView(s, a, r) }))
      .sort((x, y) => (y.createdAt ?? "").localeCompare(x.createdAt ?? ""));
    res.json({ items, schedule: s.settings.main?.schedule });
  });
  for (const action of ["approve", "reject", "cancel"] as const)
    write("post", `${path}/:id/${action}`, reviewSchema, (s, a, input, req) =>
      actOnWorkflow(s, a, table, param(req, "id"), action, input),
    );
}
write("post", "/work-registrations", workRegistrationSchema, (s, a, input) =>
  registerWork(s, a, input),
);
write("post", "/internal-requests", internalRequestSchema, (s, a, input) =>
  createInternalRequest(s, a, input),
);
