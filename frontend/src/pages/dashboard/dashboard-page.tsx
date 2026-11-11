import { useState } from "react";
import { useAuth } from "../../app/auth";
import { useApi } from "../../hooks/data";
import { queryString } from "../../services/api-client";
import { today } from "../../utils/date-time";
import { Loading, ErrorBox } from "../../components/ui";
import { monthRange, type DashboardData } from "./dashboard-data";
import { DashboardView } from "./dashboard-view";

export function DashboardPage() {
  const { me } = useAuth();
  const [range, setRange] = useState(() => monthRange(today()));
  // One scoped query retains the shared cache and live invalidation for all sections.
  const q = useApi<DashboardData>(
    "/dashboard" + queryString({ startDate: range.start, endDate: range.end }),
  );
  if (q.isPending) return <Loading />;
  if (q.error)
    return <ErrorBox error={q.error} retry={() => void q.refetch()} />;
  return (
    <DashboardView
      data={q.data!}
      me={me!}
      range={range}
      onRangeChange={setRange}
      refreshing={q.isFetching}
    />
  );
}
