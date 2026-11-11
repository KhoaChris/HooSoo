import { Building2, UserRound } from "lucide-react";
import { useApi } from "../../hooks/data";
import { Heading, Loading, ErrorBox } from "../../components/ui";

interface Org {
  companyName: string;
  departments: {
    id: string;
    name: string;
    description: string;
    employees: {
      id: string;
      name: string;
      positionName: string;
      managerName: string;
      self: boolean;
    }[];
  }[];
}

export function OrganizationPage() {
  const q = useApi<Org>("/organization/tree");
  return (
    <>
      <Heading
        title="Sơ đồ tổ chức"
        description="Kết nối thành viên và vị trí của bạn trong doanh nghiệp."
      />
      <ErrorBox error={q.error} retry={() => void q.refetch()} />
      {q.isPending ? (
        <Loading />
      ) : (
        q.data && (
          <div className="organization">
            <div className="org-root">
              <Building2 size={24} />
              <h2>{q.data.companyName}</h2>
              <p>{q.data.departments.length} phòng ban · Cơ cấu doanh nghiệp</p>
            </div>
            <div className="org-connector" />
            <div className="org-departments">
              {q.data.departments.map((d) => (
                <section className="org-department" key={d.id}>
                  <header>
                    <span className="department-icon">
                      <Building2 size={19} />
                    </span>
                    <div>
                      <h3>{d.name}</h3>
                      <small>{d.employees.length} thành viên</small>
                    </div>
                  </header>
                  <ul>
                    {d.employees.length === 0 && (
                      <li>Chưa có nhân viên trong phòng ban này.</li>
                    )}
                    {d.employees.map((e) => (
                      <li key={e.id} className={e.self ? "self" : ""}>
                        <UserRound size={17} />
                        <div>
                          <strong>
                            {e.name}
                            {e.self && <span className="self-tag">Bạn</span>}
                          </strong>
                          <span>{e.positionName}</span>
                          <small>
                            {e.managerName
                              ? "Quản lý: " + e.managerName
                              : "Không có quản lý trực tiếp"}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        )
      )}
    </>
  );
}
