import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { z } from "zod";
import { catalogSchema, type Catalog, type Page } from "@hoosoo/shared";
import { useApi, useAction } from "../../hooks/data";
import { catalogPage, catalogPath } from "../../services/query-cache";
import {
  Heading,
  Button,
  Form,
  Modal,
  Loading,
  ErrorBox,
  DataTable,
  Badge,
} from "../../components/ui";

export function CatalogPage({ kind }: { kind: "departments" | "positions" }) {
  const [page, setPage] = useState(1),
    [edit, setEdit] = useState<Catalog | "new" | null>(null),
    [confirm, setConfirm] = useState<Catalog | null>(null);
  const q = useApi<Page<Catalog & { employeeCount: number }>>(
      catalogPath(kind),
    ),
    action = useAction();
  const label = kind === "departments" ? "Phòng ban" : "Chức danh";
  return (
    <>
      <Heading
        title={label}
        description="Sắp xếp đội ngũ theo cơ cấu doanh nghiệp."
        action={
          <Button onClick={() => setEdit("new")}>
            <Plus size={17} />
            Thêm {label.toLowerCase()}
          </Button>
        }
      />
      <ErrorBox error={q.error} retry={() => void q.refetch()} />
      {q.isPending ? (
        <Loading />
      ) : (
        <DataTable
          data={catalogPage(q.data, page)}
          onPage={setPage}
          columns={[
            {
              label: "Tên " + label.toLowerCase(),
              render: (c) => <strong>{c.name}</strong>,
            },
            { label: "Mô tả", render: (c) => c.description },
            {
              label: "Nhân viên đang làm việc",
              render: (c) => c.employeeCount,
            },
            {
              label: "Trạng thái",
              render: (c) => (
                <Badge value={c.active ? "enabled" : "disabled"} />
              ),
            },
            {
              label: "Thao tác",
              render: (c) => (
                <div className="row-actions">
                  <Button variant="ghost" onClick={() => setEdit(c)}>
                    <Pencil size={16} />
                    Sửa
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirm(c)}>
                    {c.active ? "Ngừng sử dụng" : "Kích hoạt"}
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}{" "}
      {edit && (
        <Modal
          title={
            (edit === "new" ? "Thêm " : "Chỉnh sửa ") + label.toLowerCase()
          }
          onClose={() => setEdit(null)}
        >
          <Form
            schema={catalogSchema}
            fields={[
              { name: "name", label: "Tên " + label.toLowerCase() },
              { name: "description", label: "Mô tả", type: "textarea" },
            ]}
            defaults={
              edit === "new"
                ? { name: "", description: "" }
                : { name: edit.name, description: edit.description }
            }
            onSubmit={async (body) => {
              await action.mutateAsync({
                path: "/" + kind + (edit === "new" ? "" : "/" + edit.id),
                method: edit === "new" ? "POST" : "PATCH",
                body,
              });
              setEdit(null);
            }}
            onCancel={() => setEdit(null)}
          />
        </Modal>
      )}
      {confirm && (
        <Modal
          title="Xác nhận thay đổi trạng thái"
          onClose={() => setConfirm(null)}
        >
          <p>
            {confirm.active ? "Ngừng sử dụng" : "Kích hoạt lại"}{" "}
            <strong>{confirm.name}</strong>? Nhân viên đang làm việc cần được
            điều chuyển trước khi ngừng sử dụng.
          </p>
          <Form
            schema={z.object({})}
            fields={[]}
            onSubmit={async () => {
              await action.mutateAsync({
                path: "/" + kind + "/" + confirm.id + "/status",
                method: "PATCH",
                body: { active: !confirm.active },
              });
              setConfirm(null);
            }}
            onCancel={() => setConfirm(null)}
            submitLabel="Xác nhận"
          />
        </Modal>
      )}
    </>
  );
}
