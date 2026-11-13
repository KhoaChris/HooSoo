import { StableText } from "../../i18n/stable-text";
import { t, useLocale } from "../../i18n";
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
    if (!value) return t("Chưa có");
    if (key === "departmentId")
      return lookups.departments[value] || t("Phòng ban trước đây");
    if (key === "positionId")
      return lookups.positions[value] || t("Chức danh trước đây");
    if (key === "managerId")
      return lookups.managers[value] || t("Quản lý trước đây");
    if (key === "status") return t(labels[value]) || value;
    return key === "hireDate" ? dateText(value) : value;
  };
  // Only work fields belong in this timeline; never render raw audit payloads.
  return Object.keys(fieldLabels)
    .filter((key) => before[key] !== after[key] && after[key] !== undefined)
    .map((key) => ({
      key,
      label: t(fieldLabels[key]),
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
  useLocale();
  const [limit, setLimit] = useState(3);
  const items = data?.items ?? [];
  const nextCount = Math.min(5, items.length - limit);
  return (
    <section
      className="employee-history"
      aria-labelledby="employee-history-title"
    >
      <header className="employee-section-heading">
        <div>
          <h2 id="employee-history-title">
            <StableText>{t("Lịch sử hồ sơ")}</StableText>
          </h2>
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
                    <StableText>
                      {item.action === "employee.avatar_updated"
                        ? t("Đổi ảnh đại diện")
                        : item.action === "employee.avatar_removed"
                          ? t("Gỡ ảnh đại diện")
                          : item.action === "employee.created"
                            ? t("Khởi tạo hồ sơ")
                            : t("Cập nhật hồ sơ")}
                    </StableText>
                  </h3>
                  <time dateTime={item.createdAt}>
                    {item.createdAt
                      ? `${dateText(item.createdAt)} · ${timeText(item.createdAt)}`
                      : t("Chưa có thời gian ghi nhận")}
                  </time>
                  {changes.length ? (
                    <details className="employee-history-change">
                      <summary>
                        <StableText>
                          {item.action === "employee.avatar_updated"
                            ? t("Đổi ảnh đại diện")
                            : item.action === "employee.avatar_removed"
                              ? t("Gỡ ảnh đại diện")
                              : item.action === "employee.created"
                                ? t("Thông tin ban đầu")
                                : t("{0} thông tin thay đổi", [changes.length])}
                        </StableText>
                        <ChevronDown size={14} aria-hidden="true" />
                      </summary>
                      <dl>
                        {changes.map((change) => (
                          <div key={change.key}>
                            <dt>
                              <StableText>{t(change.label)}</StableText>
                            </dt>
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
                  ) : null}
                </li>
              );
            })}
          </ol>
          {items.length > limit && (
            <Button
              type="button"
              variant="secondary"
              className="employee-history-more"
              onClick={() => setLimit(limit + 5)}
            >
              <span>
                {nextCount === 1
                  ? t("Xem thêm 1 thay đổi")
                  : t("Xem thêm {0} thay đổi", [nextCount])}
              </span>
              <ChevronDown size={15} aria-hidden="true" />
            </Button>
          )}
          {data && data.total > items.length && (
            <p className="employee-history-note">
              <StableText>{t("Đang hiển thị")}</StableText> {items.length}{" "}
              <StableText>{t("sự kiện gần nhất trong")}</StableText>{" "}
              {data.total} <StableText>{t("sự kiện.")}</StableText>
            </p>
          )}
        </>
      ) : (
        !error && (
          <div className="employee-history-empty">
            <History size={24} aria-hidden="true" />
            <h3>
              <StableText>{t("Chưa có lịch sử thay đổi")}</StableText>
            </h3>
          </div>
        )
      )}
    </section>
  );
}
