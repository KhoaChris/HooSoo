import { StableText } from "../../i18n/stable-text";
import { t, useLocale } from "../../i18n";
import { useState } from "react";
import { z } from "zod";
import {
  Plus,
  UserRoundPlus,
  Search,
  ShieldCheck,
  KeyRound,
  Power,
  AlertCircle,
} from "lucide-react";
import { PersonCell } from "../../components/ui/person-cell";
import { RoleGuide, RoleIcon } from "./components/role-guide";
import {
  userSchema,
  roles,
  labels,
  type Page,
  type EmployeeView,
  type Membership,
  type AccountJob,
} from "@hoosoo/shared";
import { useApi, useAction } from "../../hooks/data";
import { useAuth } from "../../app/auth";
import {
  Heading,
  Button,
  Form,
  Modal,
  Loading,
  ErrorBox,
  DataTable,
  Badge,
  Input,
  Select,
} from "../../components/ui";

export function UsersPage() {
  useLocale();
  const { me } = useAuth();
  const q = useApi<{
      items: (Membership & { name: string })[];
      jobs: AccountJob[];
    }>("/users"),
    staff = useApi<Page<EmployeeView>>("/employees?pageSize=100"),
    action = useAction();
  const [search, setSearch] = useState(""),
    [roleFilter, setRoleFilter] = useState(""),
    [statusFilter, setStatusFilter] = useState("");
  const [retryEmployee, setRetryEmployee] = useState("");
  const [create, setCreate] = useState(false),
    [edit, setEdit] = useState<(Membership & { name: string }) | null>(null),
    [status, setStatus] = useState<Membership | null>(null);
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .toLowerCase()
      .trim();
  const items =
    q.data?.items.filter(
      (u) =>
        normalize(`${u.name || ""} ${u.email}`).includes(normalize(search)) &&
        (!roleFilter || u.role === roleFilter) &&
        (!statusFilter || (statusFilter === "active") === u.active),
    ) || [];
  const filtered = !!(search || roleFilter || statusFilter);
  return (
    <>
      <Heading
        eyebrow={t("QUẢN TRỊ")}
        title={t("Tài khoản & phân quyền")}
        action={
          <Button
            onClick={() => {
              setRetryEmployee("");
              setCreate(true);
            }}
          >
            <Plus size={16} />
            {t("Cấp tài khoản")}
          </Button>
        }
      />
      {q.data?.jobs.map((j) => (
        <div className="account-job" key={j.id}>
          <AlertCircle size={20} />
          <div>
            <strong>
              <StableText>
                {j.status === "pending"
                  ? t("Tài khoản đang được thiết lập")
                  : t("Chưa hoàn tất cấp tài khoản")}
              </StableText>
            </strong>
            <p>
              {j.email}{" "}
              <StableText>
                {t("· Có thể cấp lại cùng hồ sơ để tiếp tục.")}
              </StableText>
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setRetryEmployee(j.employeeId);
              setCreate(true);
            }}
          >
            {t("Tiếp tục cấp tài khoản")}
          </Button>
        </div>
      ))}
      <DataTable
        title={t("Danh sách tài khoản")}
        icon={<ShieldCheck size={18} />}
        loading={q.isPending}
        error={q.error}
        onRetry={() => void q.refetch()}
        filtered={filtered}
        toolbar={
          <div className="filters">
            <label className="search-input">
              <Search size={16} />
              <Input
                aria-label={t("Tìm tài khoản")}
                placeholder={t("Tìm tên hoặc email…")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <Select
              aria-label={t("Lọc vai trò")}
              value={roleFilter}
              onValueChange={setRoleFilter}
              options={[
                { value: "", label: t("Tất cả vai trò") },
                ...roles.map((role) => ({
                  value: role,
                  label: t(labels[role]),
                })),
              ]}
            />
            <Select
              aria-label={t("Lọc quyền truy cập")}
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[
                { value: "", label: t("Tất cả trạng thái") },
                { value: "active", label: t("Đang hoạt động") },
                { value: "inactive", label: t("Đã vô hiệu hóa") },
              ]}
            />
            {filtered && (
              <Button
                variant="ghost"
                className="filter-reset"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("");
                  setStatusFilter("");
                }}
              >
                {t("Xóa bộ lọc")}
              </Button>
            )}
          </div>
        }
        data={
          q.data
            ? {
                items,
                total: items.length,
                page: 1,
                pageSize: Math.max(1, items.length),
              }
            : undefined
        }
        columns={[
          {
            minWidth: 330,
            label: t("Thành viên"),
            render: (u) => (
              <div className="account-person">
                <PersonCell
                  name={u.name || t("Nhân viên")}
                  detail={u.email}
                  avatarUrl={
                    staff.data?.items.find((e) => e.id === u.employeeId)
                      ?.avatarUrl
                  }
                />
                {u.id === me!.actor.uid && (
                  <span className="account-self">{t("Bạn")}</span>
                )}
              </div>
            ),
          },
          {
            minWidth: 210,
            label: t("Vai trò"),
            render: (u) => (
              <span className="account-role">
                <RoleIcon role={u.role} />
                {t(labels[u.role])}
              </span>
            ),
          },
          {
            minWidth: 190,
            label: t("Quyền truy cập"),
            render: (u) => <Badge value={u.active ? "enabled" : "disabled"} />,
          },
          {
            minWidth: 300,
            label: t("Thao tác"),
            className: "cell-actions",
            render: (u) => (
              <div className="row-actions">
                <Button variant="ghost" onClick={() => setEdit(u)}>
                  <KeyRound size={14} />
                  {t("Đổi vai trò")}
                </Button>
                <Button
                  variant="ghost"
                  className="status-action"
                  tone={u.active ? "danger" : "success"}
                  onClick={() => setStatus(u)}
                >
                  <Power size={14} />
                  {u.active ? t("Vô hiệu hóa") : t("Kích hoạt")}
                </Button>
              </div>
            ),
          },
        ]}
      />
      <RoleGuide />
      {create && (
        <Modal
          title={t("Cấp tài khoản nhân viên")}
          icon={<UserRoundPlus size={21} />}
          onClose={() => setCreate(false)}
        >
          {staff.isPending ? (
            <Loading />
          ) : staff.error ? (
            <ErrorBox error={staff.error} retry={() => void staff.refetch()} />
          ) : !staff.data?.items.some(
              (employee) => !employee.uid && employee.status !== "terminated",
            ) ? (
            <div className="creation-empty">
              <h3>
                <StableText>{t("Chưa có hồ sơ để cấp tài khoản")}</StableText>
              </h3>
              <p>
                <StableText>
                  {t("Tạo hồ sơ nhân viên trước khi cấp tài khoản.")}
                </StableText>
              </p>
            </div>
          ) : (
            <Form
              schema={userSchema}
              fields={[
                {
                  name: "employeeId",
                  required: true,
                  label: t("Hồ sơ nhân viên"),
                  type: "select",
                  options: [
                    { value: "", label: t("Chọn nhân viên chưa có tài khoản") },
                    ...(staff.data?.items
                      .filter((e) => !e.uid && e.status !== "terminated")
                      .map((e) => ({
                        value: e.id,
                        label: e.name + " · " + e.email,
                      })) || []),
                  ],
                },
                {
                  name: "role",
                  required: true,
                  label: t("Vai trò"),
                  type: "select",
                  options: roles.map((r) => ({
                    value: r,
                    label: t(labels[r]),
                  })),
                },
                {
                  name: "password",
                  required: true,
                  label: t("Mật khẩu khởi tạo"),
                  type: "password",
                  hint: t("Tối thiểu 10 ký tự."),
                },
              ]}
              defaults={{
                employeeId: retryEmployee,
                role: "Employee",
                password: "",
              }}
              onSubmit={async (body) => {
                await action.mutateAsync({ path: "/users", body });
                setCreate(false);
              }}
              submitLabel={t("Cấp tài khoản")}
              onCancel={() => setCreate(false)}
            />
          )}
        </Modal>
      )}
      {edit && (
        <Modal
          title={t("Thay đổi vai trò")}
          icon={<KeyRound size={21} />}
          onClose={() => setEdit(null)}
        >
          <div className="account-dialog-person">
            <PersonCell
              name={edit.name || t("Nhân viên")}
              detail={edit.email}
              avatarUrl={
                staff.data?.items.find((e) => e.id === edit.employeeId)
                  ?.avatarUrl
              }
            />
            <span className="account-role">
              <RoleIcon role={edit.role} />
              {t(labels[edit.role])}
            </span>
          </div>
          <RoleGuide />
          {edit.id === me!.actor.uid && (
            <p className="notice">
              <StableText>{t("Bạn đang đổi quyền của chính mình.")}</StableText>
            </p>
          )}
          <Form
            schema={z.object({ role: z.enum(roles) })}
            defaults={{ role: edit.role }}
            fields={[
              {
                name: "role",
                label: t("Vai trò mới"),
                type: "select",
                options: roles.map((r) => ({ value: r, label: t(labels[r]) })),
              },
            ]}
            onSubmit={async (body) => {
              await action.mutateAsync({
                path: "/users/" + edit.id + "/role",
                method: "PATCH",
                body,
              });
              setEdit(null);
            }}
            onCancel={() => setEdit(null)}
          />
        </Modal>
      )}
      {status && (
        <Modal
          title={
            status.active
              ? t("Vô hiệu hóa tài khoản?")
              : t("Kích hoạt lại tài khoản?")
          }
          icon={<Power size={21} />}
          onClose={() => setStatus(null)}
        >
          <div className="account-dialog-person">
            <PersonCell
              name={
                q.data?.items.find((u) => u.id === status.id)?.name ||
                t("Nhân viên")
              }
              detail={status.email}
            />
          </div>
          <p className="account-status-message">
            <StableText>
              {status.active
                ? t("Tài khoản sẽ bị chặn đăng nhập.")
                : t("Tài khoản sẽ được phép đăng nhập lại.")}
            </StableText>
          </p>
          {status.id === me!.actor.uid && (
            <p className="notice">
              <StableText>
                {t("Bạn sẽ mất quyền truy cập nếu vô hiệu hóa tài khoản này.")}
              </StableText>
            </p>
          )}
          <Form
            schema={z.object({})}
            fields={[]}
            onSubmit={async () => {
              await action.mutateAsync({
                path: "/users/" + status.id + "/status",
                method: "PATCH",
                body: { active: !status.active },
              });
              setStatus(null);
            }}
            onCancel={() => setStatus(null)}
            submitTone={status.active ? "danger" : "success"}
            submitLabel={
              status.active
                ? t("Vô hiệu hóa tài khoản")
                : t("Kích hoạt tài khoản")
            }
          />
        </Modal>
      )}
    </>
  );
}
