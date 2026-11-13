import { useState } from "react";
import type {
  InternalRequestView,
  LeaveView,
  Page,
  ProfessionalWorkspace,
  WorkRegistrationView,
} from "@hoosoo/shared";
import { useAuth } from "../../app/auth";
import { useApi } from "../../hooks/data";
import { today } from "../../utils/date-time";
import { Loading, ErrorBox } from "../../components/ui";
import type { RecruitmentDirectory } from "../recruitment/job-editor";
import { monthRange, type DashboardData } from "./dashboard-data";
import { dashboardPaths } from "./dashboard-model";
import { DashboardView } from "./dashboard-view";

export function DashboardPage() {
  const { me } = useAuth();
  const [range, setRange] = useState(() => monthRange(today()));
  const paths = dashboardPaths(me?.actor.role ?? "Employee", range);
  const enabled = !!me;
  const q = useApi<DashboardData>(paths.base, enabled);
  // Reuse role-scoped feature queries and their existing live invalidation.
  // No polling, health probes, or per-job candidate queries on the overview.
  const schedules = useApi<{ items: WorkRegistrationView[] }>(
    paths.schedules,
    enabled,
  );
  const requests = useApi<{ items: InternalRequestView[] }>(
    paths.requests,
    enabled,
  );
  const leaves = useApi<Page<LeaveView>>(
    paths.leaves ?? "/leave-requests",
    enabled && !!paths.leaves,
  );
  const work = useApi<ProfessionalWorkspace>(
    paths.work ?? "/professional/workspace",
    enabled && !!paths.work,
  );
  const recruitment = useApi<RecruitmentDirectory>(
    paths.recruitment ?? "/recruitment/jobs",
    enabled && !!paths.recruitment,
  );
  if (!me || q.isPending) return <Loading />;
  if (q.error)
    return <ErrorBox error={q.error} retry={() => void q.refetch()} />;
  return (
    <DashboardView
      data={q.data!}
      me={me}
      range={range}
      onRangeChange={setRange}
      refreshing={q.isFetching}
      resources={{ schedules, requests, leaves, work, recruitment }}
    />
  );
}
