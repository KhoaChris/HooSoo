import { t, useLocale } from "../../i18n";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  employeeSchema,
  isSupervisorRole,
  outranks,
  labels,
  type EmployeeView,
  type Page,
} from "@hoosoo/shared";
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
  useLocale();
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
  if (employeeId && q.data?.canEdit !== true)
    return (
      <div className="notice">
        {t("Bạn không có quyền chỉnh sửa hồ sơ này.")}
      </div>
    );
  const fields: FormField[] = [
    {
      name: "name",
      label: t("Họ và tên"),
      section: t("Thông tin cá nhân"),
      required: true,
      placeholder: t("Nhập họ và tên đầy đủ"),
    },
    {
      name: "email",
      label: t("Email công việc"),
      type: "email",
      required: true,
      placeholder: "ten@congty.vn",
      hint:
        employeeId && q.data?.uid
          ? t("Email đã liên kết tài khoản, không thể đổi.")
          : undefined,
    },
    {
      name: "phone",
      label: t("Số điện thoại"),
      placeholder: t("Không bắt buộc"),
    },
    {
      name: "address",
      label: t("Địa chỉ liên hệ"),
      type: "textarea",
      span: "full",
      placeholder: t("Số nhà, đường, phường / xã, tỉnh / thành phố"),
    },
    {
      name: "departmentId",
      section: t("Thông tin công việc"),
      required: true,
      label: t("Phòng ban"),
      type: "select",
      options: [
        { value: "", label: t("Chọn phòng ban") },
        ...departments
          .data!.items.filter((d) => d.active)
          .map((d) => ({ value: d.id, label: d.name })),
      ],
    },
    {
      name: "positionId",
      required: true,
      label: t("Chức danh"),
      type: "select",
      options: [
        { value: "", label: t("Chọn chức danh") },
        ...positions
          .data!.items.filter((d) => d.active)
          .map((d) => ({ value: d.id, label: d.name })),
      ],
    },
    {
      name: "managerId",
      span: "full",
      label: t("Người quản lý trực tiếp"),
      type: "select",
      options: [
        { value: "", label: t("Không có") },
        ...(all.data?.items
          .filter(
            (e) =>
              e.id !== employeeId &&
              e.status !== "terminated" &&
              e.accessRole &&
              isSupervisorRole(e.accessRole) &&
              outranks(e.accessRole, q.data?.accessRole ?? "Employee"),
          )
          .map((e) => ({
            value: e.id,
            label: e.name + " · " + t(labels[e.accessRole!]),
          })) || []),
      ],
    },
    {
      name: "hireDate",
      label: t("Ngày vào làm"),
      type: "date",
      required: true,
    },
    {
      name: "status",
      label: t("Trạng thái làm việc"),
      type: "select",
      options: [
        { value: "active", label: t("Đang làm việc") },
        { value: "probation", label: t("Thử việc") },
        { value: "terminated", label: t("Đã nghỉ việc") },
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
          title={employeeId ? t("Chỉnh sửa hồ sơ") : t("Thêm nhân viên")}
          action={
            <Link className="button secondary" to="/employees">
              <ArrowLeft size={16} />
              {t("Danh sách")}
            </Link>
          }
        />
      )}
      <div className={dialog ? "creation-form" : "panel editor-panel"}>
        {dialog && employeeId && (
          <p className="form-intro">
            <strong>{q.data?.name}</strong> · {q.data?.employeeCode}
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
          submitLabel={employeeId ? t("Lưu hồ sơ") : t("Tạo hồ sơ")}
          onCancel={
            dialog ? undefined : () => navigate("/employees/" + employeeId)
          }
        />
      </div>
    </>
  );
}
