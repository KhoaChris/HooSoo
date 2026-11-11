import { useState } from "react";
import { Plus } from "lucide-react";
import { leaveTypeSchema, type LeaveType, type Page } from "@hoosoo/shared";
import { useApi, useAction } from "../../../hooks/data";
import {
  Button,
  Form,
  Modal,
  ErrorBox,
  DataTable,
  Badge,
} from "../../../components/ui";

export function LeaveTypes() {
  const q = useApi<Page<LeaveType>>("/leave-types?pageSize=100"),
    action = useAction();
  const [edit, setEdit] = useState<LeaveType | "new" | null>(null);
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Loại nghỉ phép</h2>
          <p>Thay đổi loại phép không làm thay đổi các đơn đã được ghi nhận.</p>
        </div>
        <Button variant="secondary" onClick={() => setEdit("new")}>
          <Plus size={16} />
          Thêm loại phép
        </Button>
      </div>
      <ErrorBox error={q.error} />
      <DataTable
        data={q.data}
        columns={[
          { label: "Tên loại phép", render: (t) => t.name },
          {
            label: "Sử dụng quỹ phép",
            render: (t) =>
              t.deductsBalance ? "Trừ phép năm" : "Không trừ phép",
          },
          {
            label: "Trạng thái",
            render: (t) => <Badge value={t.active ? "enabled" : "disabled"} />,
          },
          {
            label: "Thao tác",
            render: (t) => (
              <Button variant="ghost" onClick={() => setEdit(t)}>
                Chỉnh sửa
              </Button>
            ),
          },
        ]}
      />
      {edit && (
        <Modal title="Thiết lập loại nghỉ phép" onClose={() => setEdit(null)}>
          <Form
            schema={leaveTypeSchema}
            fields={[
              { name: "name", label: "Tên loại phép" },
              {
                name: "deductsBalance",
                label: "Trừ vào quỹ phép năm",
                type: "checkbox",
              },
              {
                name: "active",
                label: "Cho phép tạo đơn mới",
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
          />
        </Modal>
      )}
    </section>
  );
}
