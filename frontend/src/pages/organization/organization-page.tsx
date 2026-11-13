import { t, useLocale } from "../../i18n";
import { useState } from "react";
import { LocateFixed, Network, Search, X } from "lucide-react";
import { useAuth } from "../../app/auth";
import { useApi } from "../../hooks/data";
import {
  Button,
  Heading,
  Input,
  Select,
  Loading,
  ErrorBox,
} from "../../components/ui";
import { OrganizationChart } from "./organization-chart";
import { filterDepartments, type Organization } from "./organization-model";

export function OrganizationPage() {
  useLocale();
  const q = useApi<Organization>("/organization/tree");
  const { me } = useAuth();
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [locateRequest, setLocateRequest] = useState(0);
  const departments = q.data?.departments ?? [];
  const visible = filterDepartments(departments, departmentId, search);
  const members = departments.flatMap((d) => d.employees);
  const selfDepartment = departments.find((d) =>
    d.employees.some((e) => e.self),
  );
  const filtered = !!departmentId || !!search.trim();
  const clearFilters = () => {
    setSearch("");
    setDepartmentId("");
  };
  return (
    <div className="organization-page">
      <Heading
        title={t("Sơ đồ tổ chức")}
        action={
          selfDepartment && (
            <Button
              variant="secondary"
              onClick={() => {
                clearFilters();
                setCollapsed((current) => {
                  const next = new Set(current);
                  next.delete(selfDepartment.id);
                  return next;
                });
                setLocateRequest((current) => current + 1);
              }}
            >
              <LocateFixed size={16} aria-hidden="true" />
              {t("Vị trí của tôi")}
            </Button>
          )
        }
      />
      <ErrorBox error={q.error} retry={() => void q.refetch()} />
      {q.isPending ? (
        <Loading />
      ) : q.data && !q.error ? (
        <section
          className="organization-workspace"
          aria-label={t("Cơ cấu doanh nghiệp")}
        >
          <div className="organization-toolbar">
            <div className="organization-search">
              <Search size={17} aria-hidden="true" />
              <Input
                aria-label={t("Tìm trong sơ đồ tổ chức")}
                placeholder={t("Tìm tên, chức danh, mã nhân viên…")}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCollapsed(new Set());
                }}
              />
              {search && (
                <button
                  className="icon-button"
                  aria-label={t("Xóa tìm kiếm")}
                  onClick={() => setSearch("")}
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <div className="organization-filter">
              <Select
                aria-label={t("Lọc theo phòng ban")}
                value={departmentId}
                onValueChange={(value) => {
                  setDepartmentId(value);
                  setCollapsed(new Set());
                }}
                options={[
                  { value: "", label: t("Tất cả phòng ban") },
                  ...departments.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
            </div>
            <span className="organization-total">
              <strong>{departments.length}</strong> {t("phòng ban")}
              <span aria-hidden="true">·</span>
              <strong>{members.length}</strong> {t("thành viên")}
            </span>
          </div>
          {visible.length ? (
            <OrganizationChart
              companyName={q.data.companyName}
              departments={visible}
              collapsed={collapsed}
              setCollapsed={setCollapsed}
              locateRequest={locateRequest}
              viewKey={departmentId + ":" + search}
              canViewProfiles={
                me!.actor.role === "Admin" || me!.actor.role === "HR"
              }
            />
          ) : (
            <div className="organization-empty">
              <Network size={34} strokeWidth={1.5} aria-hidden="true" />
              <h2>
                {filtered
                  ? t("Không tìm thấy kết quả")
                  : t("Sơ đồ đang chờ phòng ban đầu tiên")}
              </h2>
              <p>
                {filtered
                  ? t("Thử tìm theo tên khác hoặc chọn lại phòng ban.")
                  : t("Chưa có dữ liệu tổ chức.")}
              </p>
              {filtered && (
                <Button variant="secondary" onClick={clearFilters}>
                  {t("Xóa bộ lọc")}
                </Button>
              )}
            </div>
          )}
          <footer className="organization-caption">
            <p>
              <span className="organization-legend-line" aria-hidden="true" />
              {t("Công ty → Phòng ban → Thành viên")}
            </p>
            <span role="status">
              {filtered
                ? t("{0} phòng ban · {1} thành viên phù hợp", [
                    visible.length,
                    visible.reduce((total, d) => total + d.employees.length, 0),
                  ])
                : t("Chỉ hiển thị phòng ban và nhân viên đang hoạt động")}
            </span>
          </footer>
        </section>
      ) : null}
    </div>
  );
}
