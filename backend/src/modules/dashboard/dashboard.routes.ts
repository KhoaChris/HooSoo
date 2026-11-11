import { Router } from "express";
import { handlers } from "../../routes/helpers";
import { dashboard } from "./dashboard.queries";

export const dashboardRoutes = Router();
const { get } = handlers(dashboardRoutes);
get(
  "/dashboard",
  [
    "departments",
    "settings",
    "attendanceRecords",
    "leaveRequests",
    "leaveBalances",
    "leaveBalanceTransactions",
  ],
  (s, a, q) => dashboard(s, a, q),
);
