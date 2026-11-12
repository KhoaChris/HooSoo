import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { employeeSchema, type EmployeeView, type Page } from "@hoosoo/shared";
import { useApi, useAction } from "../../hooks/data";
import { today } from "../../utils/date-time";
import {
  Heading,
  Form,
  Loading,
  ErrorBox,
  type FormField,
} from "../../components/ui";
import { useCatalogs } from "../../hooks/catalogs";
export function EmployeeEditor({ dialog = false }: { dialog?: boolean }) {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const q = useApi<EmployeeView>("/employees/" + employeeId, !!employeeId),
    all = useApi<Page<EmployeeView>>("/employees?pageSize=100");
  const { departments, positions } = useCatalogs();
  const action = useAction();
  if (
    (employeeId && q.isPending) ||
    departments.isPending ||
    positions.isPending ||
    all.isPending
  )
    return <Loading />;
  if (q.error || departments.error || positions.error || all.error)
    return (
      <ErrorBox
        error={q.error || departments.error || positions.error || all.error}
        retry={() => {
          void departments.refetch();
          void positions.refetch();
          void all.refetch();
          if (employeeId) void q.refetch();
        }}
      />
    );
  const fields: FormField[] = [
    {
      name: "employeeCode",
      label: "Mã nhân viên",
      required: true,
      placeholder: "VD: HS-005",
      section: "Thông tin cá nhân",
    },
    {
      name: "name",
      label: "Họ và tên",
      required: true,
      placeholder: "Nhập họ và tên đầy đủ",
    },
    {
      name: "email",
      label: "Email công việc",
      type: "email",
      required: true,
      placeholder: "ten@congty.vn",
      hint: employeeId
        ? "Email đã liên kết tài khoản không thể đổi tại đây."
        : "Dùng để liên kết tài khoản khi cấp quyền truy cập.",
    },
    { name: "phone", label: "Số điện thoại", placeholder: "Không bắt buộc" },
    {
      name: "address",
      label: "Địa chỉ liên hệ",
      type: "textarea",
      span: "full",
      placeholder: "Số nhà, đường, phường / xã, tỉnh / thành phố",
    },
    {
      name: "departmentId",
      section: "Thông tin công việc",
      required: true,
      label: "Phòng ban",
      type: "select",
      options: [
        { value: "", label: "Chọn phòng ban" },
        ...departments
          .data!.items.filter((d) => d.active)
          .map((d) => ({ value: d.id, label: d.name })),
      ],
    },
    {
      name: "positionId",
      required: true,
      label: "Chức danh",
      type: "select",
      options: [
        { value: "", label: "Chọn chức danh" },
        ...positions
          .data!.items.filter((d) => d.active)
          .map((d) => ({ value: d.id, label: d.name })),
      ],
    },
    {
      name: "managerId",
      span: "full",
      label: "Người quản lý trực tiếp",
      type: "select",
      options: [
        { value: "", label: "Không có" },
        ...(all.data?.items
          .filter((e) => e.id !== employeeId && e.status !== "terminated")
          .map((e) => ({ value: e.id, label: e.name })) || []),
      ],
    },
    { name: "hireDate", label: "Ngày vào làm", type: "date", required: true },
    {
      name: "status",
      label: "Trạng thái làm việc",
      type: "select",
      options: [
        { value: "active", label: "Đang làm việc" },
        { value: "probation", label: "Thử việc" },
        { value: "terminated", label: "Đã nghỉ việc" },
      ],
    },
  ];
  const defaults = Object.fromEntries(
    fields.map((f) => [
      f.name,
      q.data?.[f.name as keyof EmployeeView] ??
        (f.name === "status" ? "active" : f.name === "hireDate" ? today() : ""),
    ]),
  );
  return (
    <>
      {!dialog && (
        <Heading
          title={employeeId ? "Chỉnh sửa hồ sơ" : "Thêm nhân viên"}
          description="Thông tin công việc được lưu cùng lịch sử thay đổi."
          action={
            <Link className="button secondary" to="/employees">
              <ArrowLeft size={16} />
              Danh sách
            </Link>
          }
        />
      )}
      <div className={dialog ? "creation-form" : "panel editor-panel"}>
        {dialog && (
          <p className="form-intro">
            {employeeId ? (
              <>
                <strong>{q.data?.name}</strong> · {q.data?.employeeCode}
              </>
            ) : (
              "Bạn có thể cấp tài khoản đăng nhập sau khi tạo hồ sơ."
            )}
          </p>
        )}
        <Form
          columns={2}
          schema={employeeSchema}
          fields={fields}
          defaults={defaults}
          onSubmit={async (body) => {
            const result = (await action.mutateAsync({
              path: "/employees" + (employeeId ? "/" + employeeId : ""),
              method: employeeId ? "PATCH" : "POST",
              body,
            })) as EmployeeView;
            navigate("/employees/" + result.id, { replace: dialog });
          }}
          submitLabel={employeeId ? "Lưu hồ sơ" : "Tạo hồ sơ"}
          onCancel={
            dialog ? undefined : () => navigate("/employees/" + employeeId)
          }
        />
      </div>
    </>
  );
}
