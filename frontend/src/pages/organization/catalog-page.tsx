import { useAuth } from "../../app/auth";
import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Building2,
  BriefcaseBusiness,
  Search,
  UsersRound,
  Power,
} from "lucide-react";
import { z } from "zod";
import { catalogSchema, type Catalog, type Page } from "@hoosoo/shared";
import { useApi, useAction } from "../../hooks/data";
import { catalogPage, catalogPath } from "../../services/query-cache";
import {
  Heading,
  Button,
  Form,
  Modal,
  DataTable,
  Badge,
  Input,
  Select,
} from "../../components/ui";

export function CatalogPage({ kind }: { kind: "departments" | "positions" }) {
  const { me } = useAuth();
  const [templates, setTemplates] = useState(false);
  const [page, setPage] = useState(1),
    [edit, setEdit] = useState<Catalog | "new" | null>(null),
    [confirm, setConfirm] = useState<Catalog | null>(null);
  const q = useApi<Page<Catalog & { employeeCount: number; canEdit: boolean }>>(
      catalogPath(kind),
    ),
    action = useAction();
  const label = kind === "departments" ? "Phòng ban" : "Chức danh";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    setSearch("");
    setStatus("");
    setPage(1);
    setEdit(null);
    setConfirm(null);
  }, [kind]);
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .toLowerCase()
      .trim();
  const items =
    q.data?.items.filter(
      (c) =>
        normalize(c.name + " " + c.description).includes(normalize(search)) &&
        (!status || (status === "enabled") === c.active),
    ) ?? [];
  const data = q.data ? { ...q.data, items, total: items.length } : undefined;

  return (
    <>
      <Heading
        title={label}
        description="Sắp xếp đội ngũ theo cơ cấu doanh nghiệp."
        action={
          <div className="row-actions">
            {kind === "positions" && me?.actor.role === "Admin" && (
              <Button variant="secondary" onClick={() => setTemplates(true)}>
                Thêm bộ chức danh CNTT
              </Button>
            )}
            <Button onClick={() => setEdit("new")}>
              <Plus size={17} />
              Thêm {label.toLowerCase()}
            </Button>
          </div>
        }
      />
      <DataTable
        title={
          kind === "departments" ? "Danh sách phòng ban" : "Danh sách chức danh"
        }
        icon={
          kind === "departments" ? (
            <Building2 size={18} />
          ) : (
            <BriefcaseBusiness size={18} />
          )
        }
        loading={q.isPending}
        error={q.error}
        onRetry={() => void q.refetch()}
        filtered={!!search || !!status}
        toolbar={
          <div className="filters">
            <label className="search-input">
              <Search size={16} />
              <Input
                aria-label={"Tìm " + label.toLowerCase()}
                placeholder={"Tìm " + label.toLowerCase() + "…"}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <Select
              aria-label="Trạng thái danh mục"
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={[
                { value: "", label: "Tất cả trạng thái" },
                { value: "enabled", label: "Đang hoạt động" },
                { value: "disabled", label: "Ngừng sử dụng" },
              ]}
            />
            {(search || status) && (
              <Button
                className="filter-reset"
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setPage(1);
                }}
              >
                Xóa bộ lọc
              </Button>
            )}
          </div>
        }
        data={catalogPage(
          data,
          Math.min(page, Math.max(1, Math.ceil(items.length / 20))),
        )}
        onPage={setPage}
        columns={[
          {
            label: "Tên " + label.toLowerCase(),
            render: (c) => (
              <div className="cell-catalog">
                <span className="cell-catalog-icon" aria-hidden="true">
                  {kind === "departments" ? (
                    <Building2 size={18} />
                  ) : (
                    <BriefcaseBusiness size={18} />
                  )}
                </span>
                <div>
                  <strong>{c.name}</strong>
                  <small>{c.description || "Chưa có mô tả"}</small>
                </div>
              </div>
            ),
          },
          {
            label: "Thành viên",
            render: (c) => (
              <span className="cell-member-count">
                <UsersRound size={14} />
                <strong>{c.employeeCount}</strong> nhân viên
              </span>
            ),
          },
          {
            label: "Trạng thái",
            render: (c) => <Badge value={c.active ? "enabled" : "disabled"} />,
          },
          {
            label: "Thao tác",
            className: "cell-actions",
            render: (c) => (
              <div className="row-actions">
                <Button
                  variant="ghost"
                  disabled={!c.canEdit}
                  title={
                    !c.canEdit
                      ? "Danh mục đang gắn với hồ sơ được bảo vệ theo phân cấp"
                      : undefined
                  }
                  onClick={() => setEdit(c)}
                >
                  <Pencil size={16} />
                  Chỉnh sửa
                </Button>
                <Button
                  className="status-action"
                  disabled={!c.canEdit}
                  variant="ghost"
                  onClick={() => setConfirm(c)}
                >
                  <Power size={14} />
                  {c.active ? "Ngừng sử dụng" : "Kích hoạt"}
                </Button>
              </div>
            ),
          },
        ]}
      />{" "}
      {edit && (
        <Modal
          title={
            (edit === "new" ? "Thêm " : "Chỉnh sửa ") + label.toLowerCase()
          }
          onClose={() => setEdit(null)}
          description={
            kind === "departments"
              ? "Nhóm nhân viên theo bộ phận và chức năng trong doanh nghiệp."
              : "Thiết lập chức danh để sử dụng trong hồ sơ nhân viên."
          }
          icon={
            kind === "departments" ? (
              <Building2 size={21} />
            ) : (
              <BriefcaseBusiness size={21} />
            )
          }
        >
          <Form
            schema={catalogSchema}
            fields={[
              {
                name: "name",
                label: "Tên " + label.toLowerCase(),
                required: true,
                placeholder:
                  kind === "departments"
                    ? "VD: Chăm sóc khách hàng"
                    : "VD: Chuyên viên nhân sự",
              },
              {
                name: "description",
                label: "Mô tả",
                type: "textarea",
                placeholder: "Vai trò, trách nhiệm hoặc ghi chú liên quan",
                hint: "Không bắt buộc. Giúp mọi người hiểu rõ chức năng khi tra cứu.",
              },
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
            submitLabel={
              edit === "new" ? "Thêm " + label.toLowerCase() : "Lưu thay đổi"
            }
          />
        </Modal>
      )}
      {templates && (
        <Modal
          title="Bổ sung chức danh ngành CNTT"
          onClose={() => setTemplates(false)}
        >
          <p>
            Thêm các chức danh quản lý, phát triển, QA/QC, BA, UI/UX, DevOps, dữ
            liệu và an toàn thông tin còn thiếu. Chức danh đã có được giữ
            nguyên. Quyền truy cập cần được Admin cấp riêng.
          </p>
          <Form
            schema={z.object({})}
            fields={[]}
            onSubmit={async () => {
              await action.mutateAsync({
                path: "/positions/templates",
                body: {},
              });
              setTemplates(false);
            }}
            onCancel={() => setTemplates(false)}
            submitLabel="Bổ sung chức danh"
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
