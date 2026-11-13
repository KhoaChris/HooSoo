import { StableText } from "../../i18n/stable-text";
import { t, useLocale } from "../../i18n";
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
  useLocale();
  const { me } = useAuth();
  const [templates, setTemplates] = useState(false);
  const [page, setPage] = useState(1),
    [edit, setEdit] = useState<Catalog | "new" | null>(null),
    [confirm, setConfirm] = useState<Catalog | null>(null);
  const q = useApi<Page<Catalog & { employeeCount: number; canEdit: boolean }>>(
      catalogPath(kind),
    ),
    action = useAction();
  const label = kind === "departments" ? t("Phòng ban") : t("Chức danh");
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
        action={
          <div className="row-actions">
            {kind === "positions" && me?.actor.role === "Admin" && (
              <Button variant="secondary" onClick={() => setTemplates(true)}>
                {t("Thêm bộ chức danh CNTT")}
              </Button>
            )}
            <Button onClick={() => setEdit("new")}>
              <Plus size={17} />
              {kind === "departments"
                ? t("Thêm phòng ban")
                : t("Thêm chức danh")}
            </Button>
          </div>
        }
      />
      <DataTable
        title={
          kind === "departments"
            ? t("Danh sách phòng ban")
            : t("Danh sách chức danh")
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
                aria-label={
                  kind === "departments"
                    ? t("Tìm phòng ban")
                    : t("Tìm chức danh")
                }
                placeholder={t("Tìm ") + label.toLowerCase() + "…"}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <Select
              aria-label={t("Trạng thái danh mục")}
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={[
                { value: "", label: t("Tất cả trạng thái") },
                { value: "enabled", label: t("Đang hoạt động") },
                { value: "disabled", label: t("Ngừng sử dụng") },
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
                {t("Xóa bộ lọc")}
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
            minWidth: 300,
            label:
              kind === "departments" ? t("Tên phòng ban") : t("Tên chức danh"),
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
                  <small>{c.description || t("Chưa có mô tả")}</small>
                </div>
              </div>
            ),
          },
          {
            minWidth: 200,
            label: t("Thành viên"),
            render: (c) => (
              <span className="cell-member-count">
                <UsersRound size={14} />
                <strong>{c.employeeCount}</strong> {t("nhân viên")}
              </span>
            ),
          },
          {
            minWidth: 200,
            label: t("Trạng thái"),
            render: (c) => <Badge value={c.active ? "enabled" : "disabled"} />,
          },
          {
            minWidth: 300,
            label: t("Thao tác"),
            className: "cell-actions",
            render: (c) => (
              <div className="row-actions">
                <Button
                  variant="ghost"
                  disabled={!c.canEdit}
                  title={
                    !c.canEdit
                      ? t(
                          "Danh mục đang gắn với hồ sơ được bảo vệ theo phân cấp",
                        )
                      : undefined
                  }
                  onClick={() => setEdit(c)}
                >
                  <Pencil size={16} />
                  {t("Chỉnh sửa")}
                </Button>
                <Button
                  className="status-action"
                  tone={c.active ? "danger" : "success"}
                  disabled={!c.canEdit}
                  variant="ghost"
                  onClick={() => setConfirm(c)}
                >
                  <Power size={14} />
                  {c.active ? t("Ngừng sử dụng") : t("Kích hoạt")}
                </Button>
              </div>
            ),
          },
        ]}
      />{" "}
      {edit && (
        <Modal
          title={
            edit === "new"
              ? kind === "departments"
                ? t("Thêm phòng ban")
                : t("Thêm chức danh")
              : kind === "departments"
                ? t("Chỉnh sửa phòng ban")
                : t("Chỉnh sửa chức danh")
          }
          onClose={() => setEdit(null)}
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
                label:
                  kind === "departments"
                    ? t("Tên phòng ban")
                    : t("Tên chức danh"),
                required: true,
                placeholder:
                  kind === "departments"
                    ? t("VD: Chăm sóc khách hàng")
                    : t("VD: Chuyên viên nhân sự"),
              },
              {
                name: "description",
                label: t("Mô tả"),
                type: "textarea",
                placeholder: t("Vai trò, trách nhiệm hoặc ghi chú liên quan"),
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
              edit === "new"
                ? kind === "departments"
                  ? t("Thêm phòng ban")
                  : t("Thêm chức danh")
                : t("Lưu thay đổi")
            }
          />
        </Modal>
      )}
      {templates && (
        <Modal
          title={t("Bổ sung chức danh ngành CNTT")}
          onClose={() => setTemplates(false)}
        >
          <p>
            <StableText>
              {t(
                "Bổ sung chức danh CNTT còn thiếu, giữ nguyên chức danh đã có.",
              )}
            </StableText>
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
            submitLabel={t("Bổ sung chức danh")}
          />
        </Modal>
      )}
      {confirm && (
        <Modal
          title={t("Xác nhận thay đổi trạng thái")}
          onClose={() => setConfirm(null)}
        >
          <p>
            <StableText>
              {confirm.active ? t("Ngừng sử dụng") : t("Kích hoạt lại")}
            </StableText>{" "}
            <strong>{confirm.name}</strong>
            <StableText>
              {t("? Cần điều chuyển nhân viên đang làm việc trước.")}
            </StableText>
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
            submitTone={confirm.active ? "danger" : "success"}
            submitLabel={t("Xác nhận")}
          />
        </Modal>
      )}
    </>
  );
}
