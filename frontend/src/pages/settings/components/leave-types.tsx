import { useState } from "react";
import { Plus, CalendarDays } from "lucide-react";
import { leaveTypeSchema, type LeaveType, type Page } from "@hoosoo/shared";
import { useApi, useAction } from "../../../hooks/data";
import { Button, Form, Modal, DataTable, Badge } from "../../../components/ui";

export function LeaveTypes() {
  const q = useApi<Page<LeaveType>>("/leave-types?pageSize=100"),
    action = useAction();
  const [edit, setEdit] = useState<LeaveType | "new" | null>(null);
  return (
    <>
      <DataTable
        title="Loại nghỉ phép"
        description="Các đơn đã ghi nhận giữ nguyên loại phép tại thời điểm tạo."
        icon={<CalendarDays size={18} />}
        loading={q.isPending}
        error={q.error}
        onRetry={() => void q.refetch()}
        actions={
          <Button variant="secondary" onClick={() => setEdit("new")}>
            <Plus size={16} />
            Thêm loại phép
          </Button>
        }
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
            className: "cell-actions",
            render: (t) => (
              <div className="row-actions">
                <Button variant="ghost" onClick={() => setEdit(t)}>
                  Chỉnh sửa
                </Button>
              </div>
            ),
          },
        ]}
      />
      {edit && (
        <Modal
          title={
            edit === "new" ? "Thêm loại nghỉ phép" : "Chỉnh sửa loại nghỉ phép"
          }
          description="Đặt tên và cách sử dụng quỹ phép cho loại nghỉ này."
          icon={<CalendarDays size={21} />}
          onClose={() => setEdit(null)}
        >
          <Form
            schema={leaveTypeSchema}
            fields={[
              {
                name: "name",
                label: "Tên loại phép",
                required: true,
                placeholder: "VD: Nghỉ phép năm",
              },
              {
                name: "deductsBalance",
                label: "Trừ vào quỹ phép năm",
                type: "checkbox",
                hint: "Khi được duyệt, số ngày nghỉ sẽ trừ vào phép năm còn lại.",
              },
              {
                name: "active",
                label: "Cho phép tạo đơn mới",
                type: "checkbox",
                hint: "Tắt để ẩn lựa chọn này khi nhân viên tạo đơn.",
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
              edit === "new" ? "Thêm loại nghỉ phép" : "Lưu thay đổi"
            }
          />
        </Modal>
      )}
    </>
  );
}
