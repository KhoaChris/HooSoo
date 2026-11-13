import { Router } from "express";
import { isSupervisorRole, type NotificationItem } from "@hoosoo/shared";
import { context } from "../../routes/helpers";
import { querySchema } from "@hoosoo/shared";
import { readState, mergeState, type ReadPlan } from "../../database/store";
import { canApprove, isHR } from "../../common/authorization";
import { canReview } from "../workflows/approval";

export const notificationsRoutes = Router();
notificationsRoutes.get("/notifications", async (_req, res) => {
  const { s, a } = await context(res, [], false, {
    path: "/notifications",
    query: querySchema.parse({}),
    params: {},
  });
  const own = { field: "employeeId", value: a.employeeId } as const;
  const plan: ReadPlan = {
    chatRooms: {
      field: "memberIds",
      op: "array-contains-any",
      value: [a.employeeId],
    },
    leaveRequests: {
      any: [
        own,
        ...(isSupervisorRole(a.role)
          ? [{ field: "status", value: "pending" }]
          : []),
      ],
    },
  };
  for (const table of ["workRegistrations", "internalRequests"] as const) {
    plan[table] = {
      any: [
        own,
        ...(isSupervisorRole(a.role)
          ? [
              isHR(a)
                ? {
                    field: "status",
                    op: "in" as const,
                    value: ["pending_manager", "pending_hr"],
                  }
                : { field: "managerId", value: a.employeeId },
            ]
          : []),
      ],
    };
  }
  mergeState(s, await readState([], plan));
  const items: NotificationItem[] = [];
  for (const room of Object.values(s.chatRooms)) {
    const last = room.lastMessage;
    if (
      !room.memberIds.includes(a.employeeId) ||
      !last ||
      last.senderId === a.employeeId
    )
      continue;
    items.push({
      id: `chat:${room.id}:${room.sequence}`,
      kind: "chat",
      subject: room.kind === "group" ? room.title : "",
      status: "message",
      at: last.sentAt,
      href: `/chat?room=${room.id}`,
      requiresAction: false,
    });
  }
  for (const r of Object.values(s.leaveRequests)) {
    const own = r.employeeId === a.employeeId,
      actionable = r.status === "pending" && canApprove(s, a, r.employeeId);
    if (!own && !actionable) continue;
    items.push({
      id: `leave:${r.id}:${r.status}`,
      kind: "leave",
      subject: own ? "" : (s.employees[r.employeeId]?.name ?? ""),
      status: r.status,
      at: r.updatedAt ?? r.createdAt ?? "",
      href: `/leave/${r.id}`,
      requiresAction: actionable,
    });
  }
  for (const [table, kind, href] of [
    ["workRegistrations", "work", "/work-schedule"],
    ["internalRequests", "request", "/requests"],
  ] as const) {
    for (const r of Object.values(s[table])) {
      const own = r.employeeId === a.employeeId;
      // Data from other scopes can share a cached query, but never the response.
      if (!own && !canReview(s, a, r)) continue;
      items.push({
        id: `${kind}:${r.id}:${r.version}`,
        kind,
        subject: own ? "" : (s.employees[r.employeeId]?.name ?? ""),
        status: r.status,
        at: r.updatedAt ?? r.createdAt ?? "",
        href: own
          ? kind === "work"
            ? href
            : href + "/my"
          : href + "/approvals",
        requiresAction: !own,
      });
    }
  }
  items.sort((x, y) => y.at.localeCompare(x.at));
  res.json({ items: items.slice(0, 40) });
});
