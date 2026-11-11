import { useState } from "react";
import { z } from "zod";
import { Plus } from "lucide-react";
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
} from "../../components/ui";

export function UsersPage() {
  const { me } = useAuth();
  const q = useApi<{
      items: (Membership & { name: string })[];
      jobs: AccountJob[];
    }>("/users"),
    staff = useApi<Page<EmployeeView>>("/employees?pageSize=100"),
    action = useAction();
  const [create, setCreate] = useState(false),
    [edit, setEdit] = useState<(Membership & { name: string }) | null>(null),
    [status, setStatus] = useState<Membership | null>(null);
  return (
    <>
      <Heading
        title="Tài khoản & phân quyền"
        description="Cấp quyền truy cập và quản lý tài khoản liên kết với hồ sơ nhân viên."
        action={
          <Button onClick={() => setCreate(true)}>
            <Plus size={16} />
            Cấp tài khoản
          </Button>
        }
      />
      <ErrorBox error={q.error} />
      {q.data?.jobs.map((j) => (
        <div className="notice" key={j.id}>
          Tài khoản {j.email} chưa hoàn tất (
          {j.status === "pending" ? "đang xử lý" : "cần khôi phục"}). Cấp lại
          cùng hồ sơ để tiếp tục an toàn.{" "}
          {j.error && <small>Mã tra cứu: {j.error}</small>}
        </div>
      ))}
      {q.isPending ? (
        <Loading />
      ) : (
        <DataTable
          data={
            q.data
              ? {
                  items: q.data.items,
                  total: q.data.items.length,
                  page: 1,
                  pageSize: 100,
                }
              : undefined
          }
          columns={[
            { label: "Nhân viên", render: (u) => <strong>{u.name}</strong> },
            { label: "Email đăng nhập", render: (u) => u.email },
            { label: "Vai trò", render: (u) => labels[u.role] },
            {
              label: "Trạng thái",
              render: (u) => (
                <Badge value={u.active ? "enabled" : "disabled"} />
              ),
            },
            {
              label: "Thao tác",
              render: (u) => (
                <div className="row-actions">
                  <Button variant="ghost" onClick={() => setEdit(u)}>
                    Đổi vai trò
                  </Button>
                  <Button variant="ghost" onClick={() => setStatus(u)}>
                    {u.active ? "Vô hiệu hóa" : "Kích hoạt"}
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}{" "}
      {create && (
        <Modal title="Cấp tài khoản nhân viên" onClose={() => setCreate(false)}>
          <Form
            schema={userSchema}
            fields={[
              {
                name: "employeeId",
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
                label: "Vai trò",
                type: "select",
                options: roles.map((r) => ({ value: r, label: labels[r] })),
              },
              {
                name: "password",
                label: "Mật khẩu khởi tạo",
                type: "password",
                hint: "Tối thiểu 10 ký tự. Không lưu mật khẩu trong hồ sơ nghiệp vụ.",
              },
            ]}
            defaults={{ employeeId: "", role: "Employee", password: "" }}
            onSubmit={async (body) => {
              await action.mutateAsync({ path: "/users", body });
              setCreate(false);
            }}
            submitLabel="Cấp tài khoản"
            onCancel={() => setCreate(false)}
          />
        </Modal>
      )}
      {edit && (
        <Modal
          title={"Đổi vai trò · " + edit.name}
          onClose={() => setEdit(null)}
        >
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
          title="Xác nhận thay đổi quyền truy cập"
          onClose={() => setStatus(null)}
        >
          <p>
            {status.active ? "Vô hiệu hóa" : "Kích hoạt lại"} tài khoản{" "}
            {status.email}? Thay đổi được kiểm tra tại API cho các yêu cầu tiếp
            theo.
          </p>
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
            submitLabel="Xác nhận"
          />
        </Modal>
      )}
    </>
  );
}
