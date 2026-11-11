import { Router } from "express";
import { handlers, param } from "../../routes/helpers";
import { z } from "zod";
import { attendanceAdjustmentSchema } from "@hoosoo/shared";
import { paginate } from "../../common/query";
import { attendanceList } from "./attendance.queries";
import { checkIn, checkOut, adjustAttendance } from "./attendance.service";
import { businessDate } from "../../utils/time";

export const attendanceRoutes = Router();
const api = attendanceRoutes;
const { get, write } = handlers(api);
get("/attendance", ["attendanceRecords", "leaveRequests"], (s, a, q) =>
  paginate(attendanceList(s, a, q), q),
);
get(
  "/attendance/today",
  ["attendanceRecords", "leaveRequests"],
  (s, a, q) =>
    attendanceList(s, a, {
      ...q,
      mine: "true",
      startDate: businessDate(),
      endDate: businessDate(),
    })[0] || null,
);
write("post", "/attendance/check-in", z.object({}).strict(), (s, a) =>
  checkIn(s, a),
);
write("post", "/attendance/check-out", z.object({}).strict(), (s, a) =>
  checkOut(s, a),
);
write(
  "patch",
  "/attendance/:recordId/adjustment",
  attendanceAdjustmentSchema,
  (s, a, input, req) => adjustAttendance(s, a, param(req, "recordId"), input),
);
