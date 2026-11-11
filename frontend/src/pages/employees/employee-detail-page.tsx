import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Pencil } from "lucide-react";
import {
  profileSchema,
  type EmployeeView,
  type Page,
  type Audit,
  labels,
} from "@hoosoo/shared";
import { useAuth } from "../../app/auth";
import { useApi, useAction } from "../../hooks/data";
import { dateText } from "../../utils/date-time";
import {
  Heading,
  Button,
  Form,
  Modal,
  Loading,
  ErrorBox,
  Badge,
} from "../../components/ui";
import { useCatalogs } from "../../hooks/catalogs";
export function EmployeeDetail({ personal = false }: { personal?: boolean }) {
  const { employeeId } = useParams(),
    { me } = useAuth();
  const id = personal ? me!.actor.employeeId : employeeId;
  const q = useApi<EmployeeView>("/employees/" + id),
    history = useApi<Page<Audit>>("/employees/" + id + "/history?pageSize=100");
  const { departments, positions } = useCatalogs();
  const [edit, setEdit] = useState(false);
  const action = useAction();
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const e = q.data!;
  return (
    <>
      <Heading
        title={personal ? "Hồ sơ của tôi" : e.name}
        description={e.employeeCode + " · " + e.email}
        action={
          personal ? (
            <Button variant="secondary" onClick={() => setEdit(true)}>
              <Pencil size={16} />
              Sửa liên hệ
            </Button>
          ) : (
            ["Admin", "HR"].includes(me!.actor.role) && (
              <Link
                className="button primary"
                to={"/employees/" + id + "/edit"}
              >
                <Pencil size={16} />
                Chỉnh sửa hồ sơ
              </Link>
            )
          )
        }
      />
      <div className="detail-grid">
        <section className="panel">
          <div className="profile-header">
            <span className="avatar large">
              {e.name
                .split(" ")
                .slice(-2)
                .map((w) => w[0])
                .join("")}
            </span>
            <h2>{e.name}</h2>
            <Badge value={e.status} />
          </div>
          <dl className="details">
            <dt>Email công việc</dt>
            <dd>{e.email}</dd>
            {e.phone !== undefined && (
              <>
                <dt>Điện thoại</dt>
                <dd>{e.phone || "Chưa cập nhật"}</dd>
                <dt>Địa chỉ</dt>
                <dd>{e.address || "Chưa cập nhật"}</dd>
              </>
            )}
            <dt>Ngày vào làm</dt>
            <dd>{dateText(e.hireDate)}</dd>
          </dl>
        </section>
        <section className="panel">
          <h2>Thông tin công việc</h2>
          <dl className="details">
            <dt>Mã nhân viên</dt>
            <dd>{e.employeeCode}</dd>
            <dt>Phòng ban</dt>
            <dd>
              {
                departments.data?.items.find((d) => d.id === e.departmentId)
                  ?.name
              }
            </dd>
            <dt>Chức danh</dt>
            <dd>
              {positions.data?.items.find((p) => p.id === e.positionId)?.name}
            </dd>
            <dt>Người quản lý</dt>
            <dd>
              {e.managerId ? (
                <ManagerName id={e.managerId} />
              ) : (
                "Chưa phân công"
              )}
            </dd>
          </dl>
          <Link className="text-link" to="/organization">
            Xem trong sơ đồ tổ chức
          </Link>
        </section>
      </div>
      <section className="panel">
        <h2>Lịch sử công việc</h2>
        <ErrorBox error={history.error} />
        <ul className="timeline">
          {history.data?.items.map((h) => (
            <li key={h.id}>
              <span className="timeline-dot" />
              <strong>
                {h.action === "employee.created"
                  ? "Khởi tạo hồ sơ"
                  : "Cập nhật thông tin công việc"}
              </strong>
              <small>{dateText(h.createdAt)}</small>
              <WorkChanges changes={h.changes} />
            </li>
          ))}
        </ul>
      </section>
      {edit && (
        <Modal
          title="Cập nhật thông tin liên hệ"
          onClose={() => setEdit(false)}
        >
          <Form
            schema={profileSchema}
            fields={[
              { name: "phone", label: "Số điện thoại" },
              { name: "address", label: "Địa chỉ", type: "textarea" },
            ]}
            defaults={{ phone: e.phone || "", address: e.address || "" }}
            onSubmit={async (body) => {
              await action.mutateAsync({
                path: "/me/profile",
                method: "PATCH",
                body,
              });
              setEdit(false);
            }}
            onCancel={() => setEdit(false)}
          />
        </Modal>
      )}
    </>
  );
}

function ManagerName({ id }: { id: string }) {
  const q = useApi<{
    departments: { employees: { id: string; name: string }[] }[];
  }>("/organization/tree");
  return (
    <>
      {q.data?.departments.flatMap((d) => d.employees).find((e) => e.id === id)
        ?.name || "Chưa có thông tin"}
    </>
  );
}

function WorkChanges({ changes }: { changes: Record<string, unknown> }) {
  const { departments, positions } = useCatalogs();
  const org = useApi<{
    departments: { employees: { id: string; name: string }[] }[];
  }>("/organization/tree");
  const before = (changes.before || {}) as Record<string, string>,
    after = (changes.after || {}) as Record<string, string>;
  const fields: Record<string, string> = {
    name: "Họ tên",
    employeeCode: "Mã nhân viên",
    departmentId: "Phòng ban",
    positionId: "Chức danh",
    managerId: "Người quản lý",
    hireDate: "Ngày vào làm",
    status: "Trạng thái",
  };
  const display = (key: string, value: string) => {
    if (!value) return "Chưa có";
    if (key === "departmentId")
      return (
        departments.data?.items.find((d) => d.id === value)?.name ||
        "Phòng ban trước đây"
      );
    if (key === "positionId")
      return (
        positions.data?.items.find((d) => d.id === value)?.name ||
        "Chức danh trước đây"
      );
    if (key === "managerId")
      return (
        org.data?.departments
          .flatMap((d) => d.employees)
          .find((e) => e.id === value)?.name || "Quản lý trước đây"
      );
    if (key === "status") return labels[value] || value;
    if (key === "hireDate") return dateText(value);
    return value;
  };
  return (
    <div className="work-changes">
      {Object.keys(fields)
        .filter((key) => before[key] !== after[key] && after[key] !== undefined)
        .map((key) => (
          <p key={key}>
            <strong>{fields[key]}:</strong>{" "}
            {before[key] ? display(key, before[key]) + " → " : ""}
            {display(key, after[key])}
          </p>
        ))}
    </div>
  );
}
