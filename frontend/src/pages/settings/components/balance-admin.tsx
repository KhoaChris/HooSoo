import { t, useLocale } from "../../../i18n";
import { Wallet } from "lucide-react";
import { PersonCell } from "../../../components/ui/person-cell";
import { Input } from "../../../components/ui";
import { useState } from "react";
import { type Page, type BalanceView } from "@hoosoo/shared";
import { useApi, useAction } from "../../../hooks/data";
import { today } from "../../../utils/date-time";
import { Button, DataTable } from "../../../components/ui";
import { BalanceAdjustmentDialog } from "./balance-adjustment-dialog";
import { queryString } from "../../../services/api-client";

export function BalanceAdmin() {
  useLocale();
  const [year, setYear] = useState(Number(today().slice(0, 4))),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState<BalanceView | null>(null);
  const q = useApi<Page<BalanceView>>(
      "/leave-balances" + queryString({ year, page }),
    ),
    action = useAction();
  return (
    <>
      <DataTable
        title={t("Quỹ phép nhân viên")}
        icon={<Wallet size={18} />}
        loading={q.isPending}
        error={q.error}
        onRetry={() => void q.refetch()}
        actions={
          <label className="filter-label">
            {t("Năm")}
            <Input
              type="number"
              min="2020"
              max="2100"
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value));
                setPage(1);
              }}
            />
          </label>
        }
        data={q.data}
        onPage={setPage}
        columns={[
          {
            minWidth: 270,
            label: t("Nhân viên"),
            render: (b) => <PersonCell name={b.employeeName} />,
          },
          {
            minWidth: 130,
            label: t("Hạn mức"),
            render: (b) => b.allowance,
          },
          {
            minWidth: 130,
            label: t("Đã duyệt"),
            render: (b) => b.used,
          },
          {
            minWidth: 130,
            label: t("Chờ duyệt"),
            render: (b) => b.pending,
          },
          {
            minWidth: 130,
            label: t("Khả dụng"),
            render: (b) => <strong className="teal">{b.available}</strong>,
          },
          {
            minWidth: 160,
            label: t("Thao tác"),
            className: "cell-actions",
            render: (b) => (
              <div className="row-actions">
                <Button
                  variant="ghost"
                  disabled={!b.canAdjust}
                  title={
                    !b.canAdjust
                      ? t("Chỉ cấp cao hơn được điều chỉnh")
                      : undefined
                  }
                  onClick={() => setEdit(b)}
                >
                  {t("Điều chỉnh")}
                </Button>
              </div>
            ),
          },
        ]}
      />
      {edit && (
        <BalanceAdjustmentDialog
          key={`${edit.employeeId}:${edit.year}`}
          balance={
            q.data?.items.find(
              (b) => b.employeeId === edit.employeeId && b.year === edit.year,
            ) ?? edit
          }
          onClose={() => setEdit(null)}
          onSubmit={async (body) => {
            await action.mutateAsync({
              path: "/leave-balances/" + edit.employeeId + "/adjustments",
              body,
            });
            setEdit(null);
          }}
        />
      )}
    </>
  );
}
