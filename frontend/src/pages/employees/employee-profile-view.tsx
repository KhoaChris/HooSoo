import { StableText } from "../../i18n/stable-text";
import { t, useLocale } from "../../i18n";
import { Avatar } from "../../components/ui/avatar";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Camera,
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
  useLocale();
  return (
    <div>
      <dt>
        <StableText>{label}</StableText>
      </dt>
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
  onEditAvatar,
  history,
}: {
  employee: EmployeeView;
  personal: boolean;
  canEdit: boolean;
  work: { department: string; position: string; manager: string };
  onEditContact: () => void;
  onEditAvatar: () => void;
  history: ReactNode;
}) {
  useLocale();
  return (
    <div className="employee-profile">
      <div className="employee-profile-breadcrumb">
        {personal ? (
          <span>
            <StableText>{t("Hồ sơ của tôi")}</StableText>
          </span>
        ) : (
          <Link to="/employees">
            <ArrowLeft size={15} aria-hidden="true" />
            {t("Danh sách nhân viên")}
          </Link>
        )}
        <span aria-hidden="true">/</span>
        <span>{e.employeeCode}</span>
      </div>
      <article className="employee-profile-surface">
        <header className="employee-profile-header">
          <div className="employee-avatar-control">
            <Avatar
              name={e.name}
              src={e.avatarUrl}
              className="employee-profile-avatar"
            />
            {(personal || canEdit) && (
              <button
                type="button"
                className="employee-avatar-edit"
                onClick={onEditAvatar}
                aria-label={t("Đổi ảnh đại diện")}
                title={t("Đổi ảnh đại diện")}
              >
                <Camera size={16} />
                <span>
                  <StableText>{t("Đổi ảnh")}</StableText>
                </span>
              </button>
            )}
          </div>
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
              <StableText>{t("Mã nhân viên")}</StableText>{" "}
              <strong>{e.employeeCode}</strong>
            </span>
          </div>
          {personal ? (
            <Button variant="secondary" onClick={onEditContact}>
              <Pencil size={16} aria-hidden="true" />
              {t("Cập nhật liên hệ")}
            </Button>
          ) : (
            canEdit && (
              <DialogLink
                className="button primary"
                to={`/employees/${e.id}/edit`}
              >
                <Pencil size={16} aria-hidden="true" />
                {t("Chỉnh sửa hồ sơ")}
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
                  <h2 id="employee-work-title">
                    <StableText>{t("Thông tin công việc")}</StableText>
                  </h2>
                </div>
                <BriefcaseBusiness size={18} aria-hidden="true" />
              </header>
              <dl className="employee-work-grid">
                <WorkField label={t("Phòng ban")}>{work.department}</WorkField>
                <WorkField label={t("Chức danh")}>{work.position}</WorkField>
                <WorkField label={t("Người quản lý trực tiếp")}>
                  {work.manager}
                </WorkField>
                <WorkField label={t("Ngày vào làm")}>
                  {dateText(e.hireDate)}
                </WorkField>
              </dl>
              <Link className="employee-organization-link" to="/organization">
                {t("Xem sơ đồ tổ chức")}
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </section>
            <section
              className="employee-contact"
              aria-labelledby="employee-contact-title"
            >
              <header className="employee-section-heading">
                <div>
                  <h2 id="employee-contact-title">
                    <StableText>{t("Thông tin liên hệ")}</StableText>
                  </h2>
                </div>
                <UserRound size={18} aria-hidden="true" />
              </header>
              <dl className="employee-contact-list">
                <div>
                  <dt>
                    <Mail size={17} aria-hidden="true" />
                    <StableText>{t("Email công việc")}</StableText>
                  </dt>
                  <dd>
                    <a href={`mailto:${e.email}`}>{e.email}</a>
                  </dd>
                </div>
                {e.phone !== undefined && (
                  <div>
                    <dt>
                      <Phone size={17} aria-hidden="true" />
                      <StableText>{t("Số điện thoại")}</StableText>
                    </dt>
                    <dd>
                      {e.phone ? (
                        <a href={`tel:${e.phone.replace(/[^+\d]/g, "")}`}>
                          {e.phone}
                        </a>
                      ) : (
                        <span className="employee-missing">
                          <StableText>{t("Chưa cập nhật")}</StableText>
                        </span>
                      )}
                    </dd>
                  </div>
                )}
                {e.address !== undefined && (
                  <div>
                    <dt>
                      <MapPin size={17} aria-hidden="true" />
                      <StableText>{t("Địa chỉ liên hệ")}</StableText>
                    </dt>
                    <dd>
                      {e.address || (
                        <span className="employee-missing">
                          <StableText>{t("Chưa cập nhật")}</StableText>
                        </span>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          </div>
          <aside className="employee-profile-activity">{history}</aside>
        </div>
      </article>
    </div>
  );
}
