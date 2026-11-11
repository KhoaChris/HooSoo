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
export function EmployeeEditor() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const q = useApi<EmployeeView>("/employees/" + employeeId, !!employeeId),
    all = useApi<Page<EmployeeView>>("/employees?pageSize=100");
  const { departments, positions } = useCatalogs();
  const action = useAction();
  if (
    (employeeId && q.isPending) ||
    departments.isPending ||
    positions.isPending
  )
    return <Loading />;
  if (q.error || departments.error || positions.error)
    return <ErrorBox error={q.error || departments.error || positions.error} />;
  const fields: FormField[] = [
    { name: "employeeCode", label: "Mã nhân viên" },
    { name: "name", label: "Họ và tên" },
    {
      name: "email",
      label: "Email công việc",
      type: "email",
      hint: "Email đã liên kết tài khoản không thể đổi tại đây.",
    },
    { name: "phone", label: "Số điện thoại" },
    { name: "address", label: "Địa chỉ liên hệ", type: "textarea" },
    {
      name: "departmentId",
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
      label: "Người quản lý trực tiếp",
      type: "select",
      options: [
        { value: "", label: "Không có" },
        ...(all.data?.items
          .filter((e) => e.id !== employeeId && e.status !== "terminated")
          .map((e) => ({ value: e.id, label: e.name })) || []),
      ],
    },
    { name: "hireDate", label: "Ngày vào làm", type: "date" },
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
      <div className="panel editor-panel">
        <Form
          schema={employeeSchema}
          fields={fields}
          defaults={defaults}
          onSubmit={async (body) => {
            const result = (await action.mutateAsync({
              path: "/employees" + (employeeId ? "/" + employeeId : ""),
              method: employeeId ? "PATCH" : "POST",
              body,
            })) as EmployeeView;
            navigate("/employees/" + result.id);
          }}
          submitLabel={employeeId ? "Lưu hồ sơ" : "Tạo hồ sơ"}
        />
      </div>
    </>
  );
}
