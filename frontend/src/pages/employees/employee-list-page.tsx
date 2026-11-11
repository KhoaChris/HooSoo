import { Input } from "../../components/ui";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { type EmployeeView, type Page } from "@hoosoo/shared";
import { useAuth } from "../../app/auth";
import { useApi } from "../../hooks/data";
import { queryString } from "../../services/api-client";
import { dateText } from "../../utils/date-time";
import {
  Heading,
  Select,
  Loading,
  ErrorBox,
  DataTable,
  Badge,
} from "../../components/ui";
import { useCatalogs } from "../../hooks/catalogs";
import { useDebouncedValue } from "../../hooks/debounced-value";
export function EmployeeList() {
  const { me } = useAuth();
  const [filters, setFilters] = useState({
    page: 1,
    search: "",
    departmentId: "",
    positionId: "",
    status: "",
  });
  const { departments, positions } = useCatalogs();
  const search = useDebouncedValue(filters.search);
  const q = useApi<Page<EmployeeView>>(
    "/employees" + queryString({ ...filters, search }),
  );
  return (
    <>
      <Heading
        title="Nhân viên"
        description="Hồ sơ, công việc và hành trình của từng thành viên."
        action={
          ["Admin", "HR"].includes(me!.actor.role) && (
            <Link to="/employees/new" className="button primary">
              <Plus size={17} />
              Thêm nhân viên
            </Link>
          )
        }
      />
      <div className="filters">
        <label className="search-input">
          <Search size={17} />
          <Input
            aria-label="Tìm nhân viên"
            placeholder="Tên, mã nhân viên, email…"
            value={filters.search}
            onChange={(e) =>
              setFilters({ ...filters, search: e.target.value, page: 1 })
            }
          />
        </label>
        <Select
          aria-label="Phòng ban"
          value={filters.departmentId}
          onValueChange={(value) =>
            setFilters({ ...filters, departmentId: value, page: 1 })
          }
          options={[
            { value: "", label: "Tất cả phòng ban" },
            ...(departments.data?.items.map((item) => ({
              value: item.id,
              label: item.name,
            })) ?? []),
          ]}
        />
        <Select
          aria-label="Chức danh"
          value={filters.positionId}
          onValueChange={(value) =>
            setFilters({ ...filters, positionId: value, page: 1 })
          }
          options={[
            { value: "", label: "Tất cả chức danh" },
            ...(positions.data?.items.map((item) => ({
              value: item.id,
              label: item.name,
            })) ?? []),
          ]}
        />
        <Select
          aria-label="Trạng thái"
          value={filters.status}
          onValueChange={(value) =>
            setFilters({ ...filters, status: value, page: 1 })
          }
          options={[
            { value: "", label: "Tất cả trạng thái" },
            { value: "active", label: "Đang làm việc" },
            { value: "probation", label: "Thử việc" },
            { value: "terminated", label: "Đã nghỉ việc" },
          ]}
        />
      </div>
      <ErrorBox error={q.error} />
      {q.isPending ? (
        <Loading />
      ) : (
        <DataTable
          data={q.data}
          filtered={
            !!filters.search || !!filters.departmentId || !!filters.status
          }
          onPage={(page) => setFilters({ ...filters, page })}
          columns={[
            {
              label: "Nhân viên",
              render: (e) => (
                <Link className="person-cell" to={"/employees/" + e.id}>
                  <span className="avatar light">
                    {e.name
                      .split(" ")
                      .slice(-2)
                      .map((n) => n[0])
                      .join("")}
                  </span>
                  <span>
                    <strong>{e.name}</strong>
                    <small>{e.employeeCode}</small>
                  </span>
                </Link>
              ),
            },
            {
              label: "Phòng ban",
              render: (e) =>
                departments.data?.items.find((d) => d.id === e.departmentId)
                  ?.name,
            },
            {
              label: "Chức danh",
              render: (e) =>
                positions.data?.items.find((p) => p.id === e.positionId)?.name,
            },
            { label: "Email công việc", render: (e) => e.email },
            { label: "Ngày vào làm", render: (e) => dateText(e.hireDate) },
            { label: "Trạng thái", render: (e) => <Badge value={e.status} /> },
          ]}
        />
      )}
    </>
  );
}
