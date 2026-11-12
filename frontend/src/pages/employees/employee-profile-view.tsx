import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  Mail,
  MapPin,
  Pencil,
  Phone,
  UserRound,
} from "lucide-react";
import type { EmployeeView } from "@hoosoo/shared";
import { Badge, Button } from "../../components/ui";
import { DialogLink } from "../../components/navigation/dialog-link";
import { dateText } from "../../utils/date-time";

function WorkField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function EmployeeProfileView({
  employee: e,
  personal,
  canEdit,
  work,
  onEditContact,
  history,
}: {
  employee: EmployeeView;
  personal: boolean;
  canEdit: boolean;
  work: { department: string; position: string; manager: string };
  onEditContact: () => void;
  history: ReactNode;
}) {
  const initials = e.name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word[0])
    .join("");
  return (
    <div className="employee-profile">
      <div className="employee-profile-breadcrumb">
        {personal ? (
          <span>Hồ sơ của tôi</span>
        ) : (
          <Link to="/employees">
            <ArrowLeft size={15} aria-hidden="true" />
            Danh sách nhân viên
          </Link>
        )}
        <span aria-hidden="true">/</span>
        <span>{e.employeeCode}</span>
      </div>
      <article className="employee-profile-surface">
        <header className="employee-profile-header">
          <span className="employee-profile-avatar" aria-hidden="true">
            {initials}
          </span>
          <div className="employee-profile-identity">
            <div className="employee-profile-title">
              <h1>{e.name}</h1>
              <Badge value={e.status} />
            </div>
            <p>
              {work.position}
              <span aria-hidden="true">·</span>
              {work.department}
            </p>
            <span className="employee-profile-code">
              Mã nhân viên <strong>{e.employeeCode}</strong>
            </span>
          </div>
          {personal ? (
            <Button variant="secondary" onClick={onEditContact}>
              <Pencil size={16} aria-hidden="true" />
              Cập nhật liên hệ
            </Button>
          ) : (
            canEdit && (
              <DialogLink
                className="button primary"
                to={`/employees/${e.id}/edit`}
              >
                <Pencil size={16} aria-hidden="true" />
                Chỉnh sửa hồ sơ
              </DialogLink>
            )
          )}
        </header>
        <div className="employee-profile-body">
          <div className="employee-profile-information">
            <section
              className="employee-work"
              aria-labelledby="employee-work-title"
            >
              <header className="employee-section-heading">
                <div>
                  <h2 id="employee-work-title">Thông tin công việc</h2>
                  <p>Vị trí hiện tại trong doanh nghiệp</p>
                </div>
                <BriefcaseBusiness size={18} aria-hidden="true" />
              </header>
              <dl className="employee-work-grid">
                <WorkField label="Phòng ban">{work.department}</WorkField>
                <WorkField label="Chức danh">{work.position}</WorkField>
                <WorkField label="Người quản lý trực tiếp">
                  {work.manager}
                </WorkField>
                <WorkField label="Ngày vào làm">
                  {dateText(e.hireDate)}
                </WorkField>
              </dl>
              <Link className="employee-organization-link" to="/organization">
                Xem sơ đồ tổ chức
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </section>
            <section
              className="employee-contact"
              aria-labelledby="employee-contact-title"
            >
              <header className="employee-section-heading">
                <div>
                  <h2 id="employee-contact-title">Thông tin liên hệ</h2>
                  <p>Kết nối trong công việc</p>
                </div>
                <UserRound size={18} aria-hidden="true" />
              </header>
              <dl className="employee-contact-list">
                <div>
                  <dt>
                    <Mail size={17} aria-hidden="true" />
                    Email công việc
                  </dt>
                  <dd>
                    <a href={`mailto:${e.email}`}>{e.email}</a>
                  </dd>
                </div>
                {e.phone !== undefined && (
                  <div>
                    <dt>
                      <Phone size={17} aria-hidden="true" />
                      Số điện thoại
                    </dt>
                    <dd>
                      {e.phone ? (
                        <a href={`tel:${e.phone.replace(/[^+\d]/g, "")}`}>
                          {e.phone}
                        </a>
                      ) : (
                        <span className="employee-missing">Chưa cập nhật</span>
                      )}
                    </dd>
                  </div>
                )}
                {e.address !== undefined && (
                  <div>
                    <dt>
                      <MapPin size={17} aria-hidden="true" />
                      Địa chỉ liên hệ
                    </dt>
                    <dd>
                      {e.address || (
                        <span className="employee-missing">Chưa cập nhật</span>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
            {personal && (
              <p className="employee-profile-help">
                Bạn có thể cập nhật thông tin liên hệ. Để thay đổi thông tin
                công việc, hãy liên hệ nhân sự.
              </p>
            )}
          </div>
          <aside className="employee-profile-activity">{history}</aside>
        </div>
      </article>
    </div>
  );
}
