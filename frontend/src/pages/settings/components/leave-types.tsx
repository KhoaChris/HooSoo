import { t as translate, useLocale } from "../../../i18n";
import { useState } from "react";
import { Plus, CalendarDays } from "lucide-react";
import { leaveTypeSchema, type LeaveType, type Page } from "@hoosoo/shared";
import { useApi, useAction } from "../../../hooks/data";
import { Button, Form, Modal, DataTable, Badge } from "../../../components/ui";

export function LeaveTypes() {
  useLocale();
  const q = useApi<Page<LeaveType>>("/leave-types?pageSize=100"),
    action = useAction();
  const [edit, setEdit] = useState<LeaveType | "new" | null>(null);
  return (
    <>
      <DataTable
        title={translate("Loại nghỉ phép")}
        icon={<CalendarDays size={18} />}
        loading={q.isPending}
        error={q.error}
        onRetry={() => void q.refetch()}
        actions={
          <Button variant="secondary" onClick={() => setEdit("new")}>
            <Plus size={16} />
            {translate("Thêm loại phép")}
          </Button>
        }
        data={q.data}
        columns={[
          {
            minWidth: 290,
            label: translate("Tên loại phép"),
            render: (t) => t.name,
          },
          {
            minWidth: 190,
            label: translate("Sử dụng quỹ phép"),
            render: (t) =>
              t.deductsBalance
                ? translate("Trừ phép năm")
                : translate("Không trừ phép"),
          },
          {
            minWidth: 185,
            label: translate("Trạng thái"),
            render: (t) => <Badge value={t.active ? "enabled" : "disabled"} />,
          },
          {
            minWidth: 290,
            label: translate("Thao tác"),
            className: "cell-actions",
            render: (t) => (
              <div className="row-actions">
                <Button variant="ghost" onClick={() => setEdit(t)}>
                  {translate("Chỉnh sửa")}
                </Button>
              </div>
            ),
          },
        ]}
      />
      {edit && (
        <Modal
          title={
            edit === "new"
              ? translate("Thêm loại nghỉ phép")
              : translate("Chỉnh sửa loại nghỉ phép")
          }
          icon={<CalendarDays size={21} />}
          onClose={() => setEdit(null)}
        >
          <Form
            schema={leaveTypeSchema}
            fields={[
              {
                name: "name",
                label: translate("Tên loại phép"),
                required: true,
                placeholder: translate("VD: Nghỉ phép năm"),
              },
              {
                name: "deductsBalance",
                label: translate("Trừ vào quỹ phép năm"),
                type: "checkbox",
              },
              {
                name: "active",
                label: translate("Cho phép tạo đơn mới"),
                type: "checkbox",
              },
            ]}
            defaults={
              edit === "new"
                ? { name: "", deductsBalance: false, active: true }
                : {
                    name: edit.name,
                    deductsBalance: edit.deductsBalance,
                    active: edit.active,
                  }
            }
            onSubmit={async (body) => {
              await action.mutateAsync({
                path: "/leave-types" + (edit === "new" ? "" : "/" + edit.id),
                method: edit === "new" ? "POST" : "PATCH",
                body,
              });
              setEdit(null);
            }}
            onCancel={() => setEdit(null)}
            submitLabel={
              edit === "new"
                ? translate("Thêm loại nghỉ phép")
                : translate("Lưu thay đổi")
            }
          />
        </Modal>
      )}
    </>
  );
}
