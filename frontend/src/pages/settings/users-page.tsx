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
import { RoleGuide, RoleIcon, roleDescriptions } from "./components/role-guide";
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
        eyebrow="QUẢN TRỊ"
        title="Tài khoản & phân quyền"
        description="Cấp quyền truy cập và quản lý tài khoản liên kết với hồ sơ nhân viên."
        action={
          <Button
            onClick={() => {
              setRetryEmployee("");
              setCreate(true);
            }}
          >
            <Plus size={16} />
            Cấp tài khoản
          </Button>
        }
      />
      {q.data?.jobs.map((j) => (
        <div className="account-job" key={j.id}>
          <AlertCircle size={20} />
          <div>
            <strong>
              {j.status === "pending"
                ? "Tài khoản đang được thiết lập"
                : "Chưa hoàn tất cấp tài khoản"}
            </strong>
            <p>{j.email} · Có thể cấp lại cùng hồ sơ để tiếp tục.</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setRetryEmployee(j.employeeId);
              setCreate(true);
            }}
          >
            Tiếp tục cấp tài khoản
          </Button>
        </div>
      ))}
      <DataTable
        title="Danh sách tài khoản"
        icon={<ShieldCheck size={18} />}
        description="Quản lý vai trò và trạng thái đăng nhập của từng thành viên."
        loading={q.isPending}
        error={q.error}
        onRetry={() => void q.refetch()}
        filtered={filtered}
        toolbar={
          <div className="filters">
            <label className="search-input">
              <Search size={16} />
              <Input
                aria-label="Tìm tài khoản"
                placeholder="Tìm tên hoặc email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <Select
              aria-label="Lọc vai trò"
              value={roleFilter}
              onValueChange={setRoleFilter}
              options={[
                { value: "", label: "Tất cả vai trò" },
                ...roles.map((role) => ({ value: role, label: labels[role] })),
              ]}
            />
            <Select
              aria-label="Lọc quyền truy cập"
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[
                { value: "", label: "Tất cả trạng thái" },
                { value: "active", label: "Đang hoạt động" },
                { value: "inactive", label: "Đã vô hiệu hóa" },
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
                Xóa bộ lọc
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
            label: "Thành viên",
            render: (u) => (
              <div className="account-person">
                <PersonCell name={u.name || "Nhân viên"} detail={u.email} />
                {u.id === me!.actor.uid && (
                  <span className="account-self">Bạn</span>
                )}
              </div>
            ),
          },
          {
            label: "Vai trò",
            render: (u) => (
              <span className="account-role">
                <RoleIcon role={u.role} />
                {labels[u.role]}
              </span>
            ),
          },
          {
            label: "Quyền truy cập",
            render: (u) => <Badge value={u.active ? "enabled" : "disabled"} />,
          },
          {
            label: "Thao tác",
            className: "cell-actions",
            render: (u) => (
              <div className="row-actions">
                <Button variant="ghost" onClick={() => setEdit(u)}>
                  <KeyRound size={14} />
                  Đổi vai trò
                </Button>
                <Button
                  variant="ghost"
                  className="status-action"
                  onClick={() => setStatus(u)}
                >
                  <Power size={14} />
                  {u.active ? "Vô hiệu hóa" : "Kích hoạt"}
                </Button>
              </div>
            ),
          },
        ]}
      />
      <RoleGuide />
      {create && (
        <Modal
          title="Cấp tài khoản nhân viên"
          description="Liên kết tài khoản đăng nhập với hồ sơ và vai trò phù hợp."
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
              <h3>Chưa có hồ sơ để cấp tài khoản</h3>
              <p>Thêm hồ sơ nhân viên mới trước khi cấp quyền đăng nhập.</p>
            </div>
          ) : (
            <Form
              schema={userSchema}
              fields={[
                {
                  name: "employeeId",
                  required: true,
                  label: "Hồ sơ nhân viên",
                  type: "select",
                  options: [
                    { value: "", label: "Chọn nhân viên chưa có tài khoản" },
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
                  label: "Vai trò",
                  type: "select",
                  options: roles.map((r) => ({ value: r, label: labels[r] })),
                },
                {
                  name: "password",
                  required: true,
                  label: "Mật khẩu khởi tạo",
                  type: "password",
                  hint: "Tối thiểu 10 ký tự. Không lưu mật khẩu trong hồ sơ nghiệp vụ.",
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
              submitLabel="Cấp tài khoản"
              onCancel={() => setCreate(false)}
            />
          )}
        </Modal>
      )}
      {edit && (
        <Modal
          title="Thay đổi vai trò"
          description="Chọn phạm vi quyền phù hợp với trách nhiệm công việc."
          icon={<KeyRound size={21} />}
          onClose={() => setEdit(null)}
        >
          <div className="account-dialog-person">
            <PersonCell name={edit.name || "Nhân viên"} detail={edit.email} />
            <span className="account-role">
              <RoleIcon role={edit.role} />
              {labels[edit.role]}
            </span>
          </div>
          <p className="account-role-context">
            Hiện tại: {roleDescriptions[edit.role]}
          </p>
          <RoleGuide />
          {edit.id === me!.actor.uid && (
            <p className="notice">
              Bạn đang thay đổi vai trò của chính mình. Quyền truy cập sẽ cập
              nhật ngay sau khi lưu.
            </p>
          )}
          <Form
            schema={z.object({ role: z.enum(roles) })}
            defaults={{ role: edit.role }}
            fields={[
              {
                name: "role",
                label: "Vai trò mới",
                type: "select",
                options: roles.map((r) => ({ value: r, label: labels[r] })),
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
              ? "Vô hiệu hóa tài khoản?"
              : "Kích hoạt lại tài khoản?"
          }
          description="Hồ sơ nhân viên và lịch sử thao tác được giữ nguyên."
          icon={<Power size={21} />}
          onClose={() => setStatus(null)}
        >
          <div className="account-dialog-person">
            <PersonCell
              name={
                q.data?.items.find((u) => u.id === status.id)?.name ||
                "Nhân viên"
              }
              detail={status.email}
            />
          </div>
          <p className="account-status-message">
            {status.active
              ? "Tài khoản này sẽ không thể tiếp tục truy cập không gian làm việc sau khi bạn xác nhận."
              : "Nhân viên có thể đăng nhập trở lại với vai trò đã được cấp."}
          </p>
          {status.id === me!.actor.uid && (
            <p className="notice">
              Đây là tài khoản bạn đang sử dụng. Nếu vô hiệu hóa, bạn sẽ mất
              quyền truy cập.
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
            submitLabel={
              status.active ? "Vô hiệu hóa tài khoản" : "Kích hoạt tài khoản"
            }
          />
        </Modal>
      )}
    </>
  );
}
