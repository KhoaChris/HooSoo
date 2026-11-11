import { Input } from "../../components/ui";
import { useState } from "react";
import {
  type Page,
  type EmployeeView,
  type Membership,
  type Audit,
} from "@hoosoo/shared";
import { useApi } from "../../hooks/data";
import { useDebouncedValue } from "../../hooks/debounced-value";
import { dateText, timeText } from "../../utils/date-time";
import {
  Heading,
  Button,
  Modal,
  Loading,
  ErrorBox,
  DataTable,
} from "../../components/ui";
import { queryString } from "../../services/api-client";

const actionNames: Record<string, string> = {
  "account.created": "Cấp tài khoản",
  "account.role": "Đổi vai trò",
  "account.status": "Đổi quyền truy cập",
  "employee.created": "Tạo hồ sơ",
  "employee.updated": "Cập nhật hồ sơ",
  "attendance.adjusted": "Điều chỉnh chấm công",
  "attendance.check_in": "Vào ca",
  "attendance.check_out": "Kết thúc ca",
  "leave.created": "Tạo đơn phép",
  "leave.approve": "Duyệt phép",
  "leave.reject": "Từ chối phép",
  "leave.cancel": "Hủy phép",
  "balance.adjusted": "Điều chỉnh quỹ phép",
  "settings.updated": "Cập nhật chính sách",
  "profile.updated": "Cập nhật liên hệ",
  "departments.saved": "Lưu phòng ban",
  "positions.saved": "Lưu chức danh",
  "departments.status": "Đổi trạng thái phòng ban",
  "positions.status": "Đổi trạng thái chức danh",
  "leave_type.updated": "Cập nhật loại phép",
};

export function AuditPage() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [detail, setDetail] = useState<Audit | null>(null);
  const settledSearch = useDebouncedValue(search);
  const q = useApi<Page<Audit>>(
    "/audit-logs" + queryString({ page, search: settledSearch }),
  );
  const staff = useApi<Page<EmployeeView>>("/employees?pageSize=100"),
    users = useApi<{ items: Membership[] }>("/users");
  function actorName(uid: string) {
    const u = users.data?.items.find((u) => u.id === uid);
    return (
      staff.data?.items.find((e) => e.id === u?.employeeId)?.name ||
      "Hệ thống khởi tạo"
    );
  }
  return (
    <>
      <Heading
        title="Nhật ký thao tác"
        description="Lịch sử nghiệp vụ do máy chủ ghi nhận, không thể sửa từ trình duyệt."
      />
      <div className="filters">
        <Input
          aria-label="Tìm nhật ký"
          placeholder="Tìm mã hành động hoặc đối tượng…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <ErrorBox error={q.error} />
      {q.isPending ? (
        <Loading />
      ) : (
        <DataTable
          data={q.data}
          onPage={setPage}
          filtered={!!search}
          columns={[
            {
              label: "Thời gian",
              render: (r) => (
                <>
                  {dateText(r.createdAt)} {timeText(r.createdAt)}
                </>
              ),
            },
            { label: "Người thực hiện", render: (r) => actorName(r.actorId) },
            {
              label: "Hành động",
              render: (r) => actionNames[r.action] || r.action,
            },
            { label: "Lý do", render: (r) => r.reason || "—" },
            {
              label: "Chi tiết",
              render: (r) => (
                <Button variant="ghost" onClick={() => setDetail(r)}>
                  Xem thay đổi
                </Button>
              ),
            },
          ]}
        />
      )}{" "}
      {detail && (
        <Modal
          title={actionNames[detail.action] || detail.action}
          onClose={() => setDetail(null)}
        >
          <p>Người thực hiện: {actorName(detail.actorId)}</p>
          <p>Mã đối tượng: {detail.targetId}</p>
          <pre className="audit-json">
            {JSON.stringify(detail.changes, null, 2)}
          </pre>
          {detail.reason && <p>{detail.reason}</p>}
        </Modal>
      )}
    </>
  );
}
