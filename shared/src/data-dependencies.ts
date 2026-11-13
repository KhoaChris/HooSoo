import type { Table } from "./index";

export function queryCollections(path: string): Table[] | null {
  const route = path.split("?")[0];
  const authorization: Table[] = ["memberships", "employees"];
  let data: Table[];
  if (route === "/notifications")
    data = [
      "chatRooms",
      "leaveRequests",
      "workRegistrations",
      "internalRequests",
    ];
  else if (route === "/chat/people") data = [];
  else if (route.startsWith("/chat/rooms"))
    data = ["chatRooms", "chatMessages"];
  else if (route.startsWith("/professional"))
    data = ["workItems", "departments"];
  else if (route.startsWith("/work-registrations"))
    data = ["workRegistrations", "settings"];
  else if (route.startsWith("/internal-requests"))
    data = ["internalRequests", "attendanceRecords"];
  else if (
    route.startsWith("/recruitment/jobs") &&
    route.endsWith("/candidates")
  )
    data = ["candidates", "recruitmentJobs"];
  else if (route.startsWith("/recruitment/"))
    data = ["recruitmentJobs", "departments"];
  else if (route === "/me" || route === "/settings") data = ["settings"];
  else if (route === "/organization/tree")
    data = ["settings", "departments", "positions"];
  else if (route === "/departments") data = ["departments"];
  else if (route === "/positions") data = ["positions"];
  else if (route === "/users") data = ["accountJobs"];
  else if (route === "/audit-logs" || route.endsWith("/history"))
    data = ["auditLogs"];
  else if (route.startsWith("/employees")) data = [];
  else if (route.startsWith("/attendance") || route === "/reports/attendance")
    data = ["attendanceRecords", "leaveRequests"];
  else if (route.startsWith("/leave-requests") || route === "/reports/leave")
    data = ["leaveRequests"];
  else if (route === "/leave-types") data = ["leaveTypes"];
  else if (route === "/leave-balances" || route === "/reports/balances")
    data = [
      "settings",
      "leaveBalances",
      "leaveRequests",
      "leaveBalanceTransactions",
    ];
  else if (route === "/reports/employees") data = ["departments", "positions"];
  else if (route === "/dashboard")
    data = [
      "settings",
      "departments",
      "attendanceRecords",
      "leaveRequests",
      "leaveBalances",
      "leaveBalanceTransactions",
    ];
  else if (route.startsWith("/system/")) data = [];
  else return null;
  return [...authorization, ...data];
}

export function mutationCollections(path: string): Table[] | null {
  if (path.startsWith("/chat/")) return ["chatRooms", "chatMessages"];
  if (/^\/(me|employees\/[^/]+)\/avatar$/.test(path.split("?")[0]))
    return ["employees", "auditLogs"];
  if (
    /^\/recruitment\/candidates\/[^/]+\/(hire|direct-hire|employee)$/.test(
      path.split("?")[0],
    )
  )
    return ["candidates", "employees", "auditLogs"];
  if (path.startsWith("/recruitment/candidates"))
    return ["candidates", "auditLogs"];
  if (path.startsWith("/recruitment/jobs"))
    return ["recruitmentJobs", "auditLogs"];
  if (path.startsWith("/internal-requests") && !path.endsWith("/approve"))
    return ["internalRequests", "auditLogs"];
  const route = path.split("/").filter(Boolean)[0];
  const map: Record<string, Table[]> = {
    professional: ["workItems"],
    "work-registrations": ["workRegistrations"],
    "internal-requests": ["internalRequests", "attendanceRecords"],
    recruitment: ["recruitmentJobs", "candidates"],
    me: ["employees"],
    employees: ["employees", "memberships"],
    departments: ["departments"],
    positions: ["positions"],
    settings: ["settings"],
    users: ["employees", "memberships", "accountJobs"],
    attendance: ["attendanceRecords"],
    "leave-types": ["leaveTypes"],
    "leave-requests": [
      "leaveRequests",
      "leaveBalances",
      "leaveBalanceTransactions",
    ],
    "leave-balances": ["leaveBalances", "leaveBalanceTransactions"],
  };
  return map[route] ? [...map[route], "auditLogs"] : null;
}

export function queryAffected(path: string, changed: readonly string[] | null) {
  const dependencies = queryCollections(path);
  return (
    changed === null ||
    dependencies === null ||
    dependencies.some((table) => changed.includes(table))
  );
}
