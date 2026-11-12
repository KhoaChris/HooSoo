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
        title="Sơ đồ tổ chức"
        description="Phòng ban, thành viên và các kết nối trong doanh nghiệp."
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
              Vị trí của tôi
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
          aria-label="Cơ cấu doanh nghiệp"
        >
          <div className="organization-toolbar">
            <div className="organization-search">
              <Search size={17} aria-hidden="true" />
              <Input
                aria-label="Tìm trong sơ đồ tổ chức"
                placeholder="Tìm tên, chức danh, mã nhân viên…"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCollapsed(new Set());
                }}
              />
              {search && (
                <button
                  className="icon-button"
                  aria-label="Xóa tìm kiếm"
                  onClick={() => setSearch("")}
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <div className="organization-filter">
              <Select
                aria-label="Lọc theo phòng ban"
                value={departmentId}
                onValueChange={(value) => {
                  setDepartmentId(value);
                  setCollapsed(new Set());
                }}
                options={[
                  { value: "", label: "Tất cả phòng ban" },
                  ...departments.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
            </div>
            <span className="organization-total">
              <strong>{departments.length}</strong> phòng ban
              <span aria-hidden="true">·</span>
              <strong>{members.length}</strong> thành viên
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
                  ? "Không tìm thấy kết quả"
                  : "Sơ đồ đang chờ phòng ban đầu tiên"}
              </h2>
              <p>
                {filtered
                  ? "Thử tìm theo tên khác hoặc chọn lại phòng ban."
                  : "Các phòng ban và thành viên sẽ xuất hiện khi được thêm vào doanh nghiệp."}
              </p>
              {filtered && (
                <Button variant="secondary" onClick={clearFilters}>
                  Xóa bộ lọc
                </Button>
              )}
            </div>
          )}
          <footer className="organization-caption">
            <p>
              <span className="organization-legend-line" aria-hidden="true" />
              Công ty → Phòng ban → Thành viên
            </p>
            <span role="status">
              {filtered
                ? `${visible.length} phòng ban · ${visible.reduce((total, d) => total + d.employees.length, 0)} thành viên phù hợp`
                : "Chỉ hiển thị phòng ban và nhân viên đang hoạt động"}
            </span>
          </footer>
        </section>
      ) : null}
    </div>
  );
}
