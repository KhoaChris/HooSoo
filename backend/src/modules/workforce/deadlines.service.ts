import type { State, Actor, Deadline } from "@hoosoo/shared";
import { businessDate } from "../../utils/time";
import { canAccessJob } from "../recruitment/recruitment.service";
import { visible } from "./core";
import { documentRead } from "./documents.service";
export function deadlines(
  s: State,
  a: Actor,
  start: string,
  end: string,
): Deadline[] {
  const result: Deadline[] = [],
    today = businessDate();
  const add = (
    id: string,
    employeeId: string,
    date: string,
    title: string,
    kind: string,
    href: string,
  ) => {
    if (date && date >= start && date <= end && visible(s, a, employeeId))
      result.push({
        id: `${id}_${date}`,
        kind,
        title,
        employeeName: s.employees[employeeId].name,
        date,
        href: href
          .replace(
            "/employment?",
            employeeId === a.employeeId ? "/employment/my?" : "/employment?",
          )
          .replace(
            "/employee-services?",
            employeeId === a.employeeId
              ? "/employee-services/my?"
              : "/employee-services?",
          ),
        overdue: date < today,
      });
  };
  for (const r of Object.values(s.employmentContracts))
    if (r.status === "active")
      add(
        `contract_${r.id}_${r.version}`,
        r.employeeId,
        r.endDate,
        r.title,
        "contract",
        `/employment?tab=contracts&record=${r.id}`,
      );
  for (const r of Object.values(s.probationReviews))
    if (["in_progress", "in_review"].includes(r.status))
      add(
        `probation_${r.id}_${r.version}`,
        r.employeeId,
        r.endDate,
        "Kết thúc thử việc",
        "probation",
        `/employment?tab=probations&record=${r.id}`,
      );
  for (const r of Object.values(s.onboardingPlans))
    for (const task of r.tasks)
      if (!task.completedAt)
        add(
          `onboarding_${task.id}`,
          r.employeeId,
          task.dueDate,
          task.title,
          "onboarding",
          `/employment?tab=onboarding&record=${r.id}`,
        );
  for (const r of Object.values(s.employeeServices))
    if (!["completed", "cancelled", "returned"].includes(r.status))
      add(
        `service_${r.id}_${r.version}`,
        r.employeeId,
        r.endDate,
        r.title,
        r.section,
        `/employee-services?tab=${r.section}&record=${r.id}`,
      );
  for (const r of Object.values(s.personnelChanges))
    if (r.status === "approved")
      add(
        `change_${r.id}_${r.version}`,
        r.employeeId,
        r.effectiveDate,
        r.kind === "transfer"
          ? "Điều chuyển có hiệu lực"
          : "Bổ nhiệm có hiệu lực",
        "change",
        `/workforce/changes?scope=${r.employeeId === a.employeeId ? "my" : "team"}&record=${r.id}`,
      );
  for (const r of Object.values(s.personnelDocuments))
    if (r.status === "active" && documentRead(s, a, r.employeeId))
      add(
        `document_${r.id}_${r.version}`,
        r.employeeId,
        r.expiresOn,
        r.title,
        "document",
        `/workforce/documents?scope=${r.employeeId === a.employeeId ? "my" : "team"}&record=${r.id}`,
      );
  for (const e of Object.values(s.employees))
    for (const c of e.background?.certificates ?? [])
      if (c.expiresYear)
        add(
          `certificate_${e.id}_${c.id}`,
          e.id,
          `${c.expiresYear}-12-31`,
          c.name,
          "certificate",
          e.id === a.employeeId ? "/profile" : `/employees/${e.id}`,
        );
  for (const c of Object.values(s.candidates)) {
    const job = s.recruitmentJobs[c.jobId];
    if (!job || !canAccessJob(s, a, job) || c.status !== "active") continue;
    for (const round of c.rounds) {
      const i = round.interview;
      if (
        i?.status === "confirmed" &&
        !round.result &&
        i.date >= start &&
        i.date <= end
      )
        result.push({
          id: `interview_${c.id}_${round.stageId}_${i.date}_${i.start}`,
          kind: "interview",
          title: round.stageName,
          employeeName: c.name,
          date: i.date,
          href: `/recruitment?job=${job.id}&candidate=${c.id}`,
          overdue: i.date < today,
        });
    }
  }
  return result.sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
}
