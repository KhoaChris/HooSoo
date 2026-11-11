import { Input } from "../../../components/ui";
import { useState } from "react";
import {
  balanceAdjustmentSchema,
  type Page,
  type BalanceView,
} from "@hoosoo/shared";
import { useApi, useAction } from "../../../hooks/data";
import { today, dateText } from "../../../utils/date-time";
import {
  Button,
  Form,
  Modal,
  ErrorBox,
  DataTable,
} from "../../../components/ui";
import { queryString } from "../../../services/api-client";

export function BalanceAdmin() {
  const [year, setYear] = useState(Number(today().slice(0, 4))),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState<BalanceView | null>(null);
  const q = useApi<Page<BalanceView>>(
      "/leave-balances" + queryString({ year, page }),
    ),
    action = useAction();
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Quỹ phép nhân viên</h2>
          <p>Điều chỉnh hạn mức theo năm có lưu lý do và lịch sử.</p>
        </div>
        <label className="filter-label">
          Năm
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
      </div>
      <ErrorBox error={q.error} />
      <DataTable
        data={q.data}
        onPage={setPage}
        columns={[
          { label: "Nhân viên", render: (b) => b.employeeName },
          { label: "Hạn mức", render: (b) => b.allowance },
          { label: "Đã duyệt", render: (b) => b.used },
          { label: "Chờ duyệt", render: (b) => b.pending },
          {
            label: "Khả dụng",
            render: (b) => <strong className="teal">{b.available}</strong>,
          },
          {
            label: "Thao tác",
            render: (b) => (
              <Button variant="ghost" onClick={() => setEdit(b)}>
                Điều chỉnh
              </Button>
            ),
          },
        ]}
      />
      {edit && (
        <Modal
          title={"Điều chỉnh quỹ phép · " + edit.employeeName}
          onClose={() => setEdit(null)}
        >
          <p>
            Hạn mức hiện tại: {edit.allowance}. Đã sử dụng/cam kết: {edit.used}{" "}
            ngày.
          </p>
          <Form
            schema={balanceAdjustmentSchema}
            defaults={{ year, amount: 1, reason: "" }}
            fields={[
              { name: "year", label: "Năm", type: "number" },
              {
                name: "amount",
                label: "Số ngày tăng / giảm",
                type: "number",
                hint: "Nhập số âm để giảm hạn mức.",
              },
              { name: "reason", label: "Lý do điều chỉnh", type: "textarea" },
            ]}
            onSubmit={async (body) => {
              await action.mutateAsync({
                path: "/leave-balances/" + edit.employeeId + "/adjustments",
                body,
              });
              setEdit(null);
            }}
            onCancel={() => setEdit(null)}
          />
          <h3>Lịch sử số dư</h3>
          {edit.transactions.map((t) => (
            <p key={t.id}>
              {t.amount > 0 ? "+" : ""}
              {t.amount} · {t.reason} · {dateText(t.createdAt)}
            </p>
          ))}
        </Modal>
      )}
    </section>
  );
}
