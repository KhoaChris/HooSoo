import type {
  State,
  Actor,
  Announcement,
  AnnouncementInput,
  AnnouncementView,
  WorkforceAction,
} from "@hoosoo/shared";
import { isHR } from "../../common/authorization";
import { businessDate } from "../../utils/time";
import { assert, notFound } from "../../utils/errors";
import { allowed, change, expected, record, stateIs } from "./core";
export function announcementVisible(s: State, a: Actor, r: Announcement) {
  const today = businessDate();
  return (
    isHR(a) ||
    (r.status === "published" &&
      r.publishOn <= today &&
      (!r.expiresOn || r.expiresOn >= today) &&
      (!r.departmentIds.length ||
        r.departmentIds.includes(s.employees[a.employeeId]?.departmentId)))
  );
}
export function announcementView(
  s: State,
  a: Actor,
  r: Announcement,
): AnnouncementView {
  allowed(announcementVisible(s, a, r));
  return {
    ...r,
    canManage: isHR(a),
    acknowledged: Object.values(s.announcementReceipts).some(
      (x) =>
        x.announcementId === r.id &&
        x.employeeId === a.employeeId &&
        x.contentVersion === r.contentVersion,
    ),
  };
}
export function saveAnnouncement(
  s: State,
  a: Actor,
  input: AnnouncementInput,
  id?: string,
) {
  allowed(isHR(a));
  const old = id ? s.announcements[id] : undefined;
  if (id && !old) notFound();
  expected(old, input.version);
  stateIs(!old || old.status !== "archived");
  assert(
    input.departmentIds.every((id) => s.departments[id]?.active),
    400,
    "ANNOUNCEMENT_AUDIENCE",
    "Chọn phòng ban đang hoạt động.",
  );
  const r: Announcement = {
    ...(old ?? record(s, a, "")),
    ...input,
    status: "draft",
    contentVersion: (old?.contentVersion ?? 0) + 1,
  };
  s.announcements[r.id] = r;
  change(s, a, r, "announcement_saved", "");
  return announcementView(s, a, r);
}
export function actAnnouncement(
  s: State,
  a: Actor,
  id: string,
  action: string,
  input: WorkforceAction,
) {
  const r = s.announcements[id];
  if (!r) notFound();
  expected(r, input.version);
  if (action === "acknowledge") {
    allowed(announcementVisible(s, a, r));
    stateIs(
      r.status === "published" &&
        r.requiresAcknowledgement &&
        r.publishOn <= businessDate() &&
        (!r.expiresOn || r.expiresOn >= businessDate()),
    );
    allowed(
      !r.departmentIds.length ||
        r.departmentIds.includes(s.employees[a.employeeId].departmentId),
    );
    const key = `${id}_${a.employeeId}_${r.contentVersion}`;
    s.announcementReceipts[key] ??= {
      id: key,
      announcementId: id,
      employeeId: a.employeeId,
      contentVersion: r.contentVersion,
      acknowledgedAt: new Date().toISOString(),
      createdBy: a.uid,
    };
  } else {
    allowed(isHR(a));
    stateIs(
      action === "publish"
        ? r.status === "draft"
        : action === "archive" && r.status !== "archived",
    );
    r.status = action === "publish" ? "published" : "archived";
    change(s, a, r, `announcement_${action}`, input.reason);
  }
  return announcementView(s, a, r);
}
export function acknowledgementReport(s: State, a: Actor, id: string) {
  allowed(isHR(a));
  const r = s.announcements[id];
  if (!r) notFound();
  return Object.values(s.employees)
    .filter(
      (e) =>
        e.status !== "terminated" &&
        (!r.departmentIds.length || r.departmentIds.includes(e.departmentId)),
    )
    .map((e) => ({
      id: e.id,
      name: e.name,
      employeeCode: e.employeeCode,
      acknowledgedAt:
        Object.values(s.announcementReceipts).find(
          (x) =>
            x.announcementId === id &&
            x.employeeId === e.id &&
            x.contentVersion === r.contentVersion,
        )?.acknowledgedAt ?? "",
    }));
}
