import { useState } from "react";
import { ChevronDown, History } from "lucide-react";
import { labels, type Audit, type Page } from "@hoosoo/shared";
import { Button, ErrorBox, Loading } from "../../components/ui";
import { dateText, timeText } from "../../utils/date-time";

export type EmployeeLookups = {
  departments: Record<string, string>;
  positions: Record<string, string>;
  managers: Record<string, string>;
};
const fieldLabels: Record<string, string> = {
  name: "Họ tên",
  employeeCode: "Mã nhân viên",
  departmentId: "Phòng ban",
  positionId: "Chức danh",
  managerId: "Người quản lý",
  hireDate: "Ngày vào làm",
  status: "Trạng thái",
};

export function needsManagerNames(items: Audit[] = []) {
  return items.some((item) =>
    [item.changes.before, item.changes.after].some(
      (value) => !!(value as Record<string, unknown> | null)?.managerId,
    ),
  );
}

function changesFor(item: Audit, lookups: EmployeeLookups) {
  const before = (item.changes.before || {}) as Record<string, string>;
  const after = (item.changes.after || {}) as Record<string, string>;
  const display = (key: string, value: string) => {
    if (!value) return "Chưa có";
    if (key === "departmentId")
      return lookups.departments[value] || "Phòng ban trước đây";
    if (key === "positionId")
      return lookups.positions[value] || "Chức danh trước đây";
    if (key === "managerId")
      return lookups.managers[value] || "Quản lý trước đây";
    if (key === "status") return labels[value] || value;
    return key === "hireDate" ? dateText(value) : value;
  };
  // Only work fields belong in this timeline; never render raw audit payloads.
  return Object.keys(fieldLabels)
    .filter((key) => before[key] !== after[key] && after[key] !== undefined)
    .map((key) => ({
      key,
      label: fieldLabels[key],
      before: before[key] ? display(key, before[key]) : null,
      after: display(key, after[key]),
    }));
}

export function EmployeeHistory({
  data,
  loading,
  error,
  retry,
  lookups,
}: {
  data?: Page<Audit>;
  loading: boolean;
  error: Error | null;
  retry: () => void;
  lookups: EmployeeLookups;
}) {
  const [limit, setLimit] = useState(3);
  const items = data?.items ?? [];
  return (
    <section
      className="employee-history"
      aria-labelledby="employee-history-title"
    >
      <header className="employee-section-heading">
        <div>
          <h2 id="employee-history-title">Lịch sử hồ sơ</h2>
          <p>Thay đổi thông tin công việc</p>
        </div>
        <History size={18} aria-hidden="true" />
      </header>
      <ErrorBox error={error} retry={retry} />
      {loading ? (
        <Loading />
      ) : items.length ? (
        <>
          <ol className="employee-history-list">
            {items.slice(0, limit).map((item) => {
              const changes = changesFor(item, lookups);
              return (
                <li key={item.id}>
                  <span className="employee-history-dot" aria-hidden="true" />
                  <h3>
                    {item.action === "employee.created"
                      ? "Khởi tạo hồ sơ"
                      : "Cập nhật hồ sơ"}
                  </h3>
                  <time dateTime={item.createdAt}>
                    {item.createdAt
                      ? `${dateText(item.createdAt)} · ${timeText(item.createdAt)}`
                      : "Chưa có thời gian ghi nhận"}
                  </time>
                  {changes.length ? (
                    <details className="employee-history-change">
                      <summary>
                        {item.action === "employee.created"
                          ? "Thông tin ban đầu"
                          : `${changes.length} thông tin thay đổi`}
                        <ChevronDown size={14} aria-hidden="true" />
                      </summary>
                      <dl>
                        {changes.map((change) => (
                          <div key={change.key}>
                            <dt>{change.label}</dt>
                            <dd>
                              {change.before && (
                                <span className="employee-history-before">
                                  {change.before}
                                  <span aria-hidden="true"> → </span>
                                </span>
                              )}
                              <strong>{change.after}</strong>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  ) : (
                    <p className="employee-history-note">
                      Thông tin hồ sơ đã được lưu.
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
          {items.length > limit && (
            <Button
              variant="secondary"
              className="employee-history-more"
              onClick={() => setLimit(limit + 5)}
            >
              Xem thêm {Math.min(5, items.length - limit)} thay đổi
              <ChevronDown size={15} aria-hidden="true" />
            </Button>
          )}
          {data && data.total > items.length && (
            <p className="employee-history-note">
              Đang hiển thị {items.length} sự kiện gần nhất trong {data.total}{" "}
              sự kiện.
            </p>
          )}
        </>
      ) : (
        !error && (
          <div className="employee-history-empty">
            <History size={24} aria-hidden="true" />
            <h3>Chưa có lịch sử thay đổi</h3>
            <p>Các lần cập nhật thông tin công việc sẽ xuất hiện tại đây.</p>
          </div>
        )
      )}
    </section>
  );
}
