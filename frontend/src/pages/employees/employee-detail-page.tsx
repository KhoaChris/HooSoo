import { useState } from "react";
import { useParams } from "react-router-dom";
import { ContactRound } from "lucide-react";
import {
  profileSchema,
  type EmployeeView,
  type Page,
  type Audit,
} from "@hoosoo/shared";
import { useAuth } from "../../app/auth";
import { useApi, useAction } from "../../hooks/data";
import { Form, Modal, Loading, ErrorBox } from "../../components/ui";
import { useCatalogs } from "../../hooks/catalogs";
import { EmployeeProfileView } from "./employee-profile-view";
import { EmployeeHistory, needsManagerNames } from "./employee-history";

export function EmployeeDetail({ personal = false }: { personal?: boolean }) {
  const { employeeId } = useParams();
  const { me } = useAuth();
  const id = personal ? me!.actor.employeeId : employeeId;
  const q = useApi<EmployeeView>("/employees/" + id);
  const history = useApi<Page<Audit>>(
    "/employees/" + id + "/history?pageSize=100",
  );
  const { departments, positions } = useCatalogs();
  // Resolve manager names once for the page, only when a displayed record needs them.
  const org = useApi<{
    departments: { employees: { id: string; name: string }[] }[];
  }>(
    "/organization/tree",
    !!q.data?.managerId || needsManagerNames(history.data?.items),
  );
  const [edit, setEdit] = useState(false);
  const action = useAction();
  if (q.isPending) return <Loading />;
  if (q.error)
    return <ErrorBox error={q.error} retry={() => void q.refetch()} />;
  const e = q.data!;
  const lookups = {
    departments: Object.fromEntries(
      (departments.data?.items ?? []).map((item) => [item.id, item.name]),
    ),
    positions: Object.fromEntries(
      (positions.data?.items ?? []).map((item) => [item.id, item.name]),
    ),
    managers: Object.fromEntries(
      (
        org.data?.departments.flatMap((department) => department.employees) ??
        []
      ).map((item) => [item.id, item.name]),
    ),
  };
  const work = {
    department:
      lookups.departments[e.departmentId] ||
      (departments.isPending ? "Đang tải…" : "Chưa có thông tin"),
    position:
      lookups.positions[e.positionId] ||
      (positions.isPending ? "Đang tải…" : "Chưa có thông tin"),
    manager: e.managerId
      ? lookups.managers[e.managerId] ||
        (org.isPending ? "Đang tải…" : "Chưa có thông tin")
      : "Chưa phân công",
  };
  return (
    <>
      <ErrorBox
        error={departments.error || positions.error || org.error}
        retry={() => {
          if (departments.error) void departments.refetch();
          if (positions.error) void positions.refetch();
          if (org.error) void org.refetch();
        }}
      />
      <EmployeeProfileView
        employee={e}
        personal={personal}
        canEdit={e.canEdit === true}
        work={work}
        onEditContact={() => setEdit(true)}
        history={
          <EmployeeHistory
            key={id}
            data={history.data}
            loading={history.isPending}
            error={history.error}
            retry={() => void history.refetch()}
            lookups={lookups}
          />
        }
      />
      {edit && (
        <Modal
          title="Cập nhật thông tin liên hệ"
          description="Giúp đồng nghiệp và nhân sự liên hệ với bạn khi cần."
          icon={<ContactRound size={21} />}
          onClose={() => setEdit(false)}
        >
          <Form
            schema={profileSchema}
            fields={[
              {
                name: "phone",
                label: "Số điện thoại",
                placeholder: "Nhập số điện thoại liên hệ",
              },
              {
                name: "address",
                label: "Địa chỉ liên hệ",
                type: "textarea",
                placeholder: "Số nhà, đường, phường / xã, tỉnh / thành phố",
              },
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
            submitLabel="Lưu thông tin liên hệ"
          />
        </Modal>
      )}
    </>
  );
}
