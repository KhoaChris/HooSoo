import {
  BriefcaseBusiness,
  GraduationCap,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Sparkles,
} from "lucide-react";
import type { Candidate } from "@hoosoo/shared";
import { workflowLabels } from "@hoosoo/shared";
import { Button } from "../../components/ui";
import { intlLocale, t } from "../../i18n";

export const candidateDate = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString(intlLocale(), {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Asia/Ho_Chi_Minh",
      })
    : "—";

export function CandidateProfile({
  candidate: c,
  editable,
  onEdit,
}: {
  candidate: Candidate;
  editable: boolean;
  onEdit: () => void;
}) {
  return (
    <>
      <div className="candidate-panel-heading">
        <h3>{t("Hồ sơ ứng viên")}</h3>
        {editable && (
          <Button variant="secondary" onClick={onEdit}>
            <Pencil size={14} />
            {t("Chỉnh sửa hồ sơ")}
          </Button>
        )}
      </div>
      <div className="candidate-profile-layout">
        <div className="candidate-profile-main">
          {[
            {
              label: "Học vấn & bằng cấp",
              value: c.education,
              Icon: GraduationCap,
            },
            {
              label: "Kinh nghiệm làm việc",
              value: c.experience,
              Icon: BriefcaseBusiness,
            },
            { label: "Kỹ năng & chứng chỉ", value: c.skills, Icon: Sparkles },
          ].map(({ label, value, Icon }) => (
            <section className="candidate-profile-section" key={label}>
              <h4>
                <Icon size={17} aria-hidden="true" />
                {t(label)}
              </h4>
              <p className={!value ? "is-empty" : undefined}>
                {value || t("Chưa cung cấp")}
              </p>
            </section>
          ))}
          {c.note && (
            <section className="candidate-profile-note">
              <h4>{t("Ghi chú tiếp nhận")}</h4>
              <p>{c.note}</p>
            </section>
          )}
        </div>
        <aside className="candidate-profile-aside">
          <section>
            <h4>{t("Thông tin liên hệ")}</h4>
            <dl className="candidate-info-list">
              <div>
                <dt>
                  <Mail size={14} />
                  {t("Email liên hệ")}
                </dt>
                <dd>
                  <a href={`mailto:${c.email}`}>{c.email}</a>
                </dd>
              </div>
              <div>
                <dt>
                  <Phone size={14} />
                  {t("Số điện thoại")}
                </dt>
                <dd>
                  <a href={`tel:${c.phone.replace(/[^+\d]/g, "")}`}>
                    {c.phone}
                  </a>
                </dd>
              </div>
              <div>
                <dt>
                  <MapPin size={14} />
                  {t("Nơi cư trú")}
                </dt>
                <dd>{c.address || t("Chưa cung cấp")}</dd>
              </div>
            </dl>
          </section>
          <section>
            <h4>{t("Thông tin tiếp nhận")}</h4>
            <dl className="candidate-info-list">
              <div>
                <dt>{t("Nguồn ứng viên")}</dt>
                <dd>{t(workflowLabels[c.source])}</dd>
              </div>
              <div>
                <dt>{t("Ngày tiếp nhận")}</dt>
                <dd>{candidateDate(c.createdAt)}</dd>
              </div>
              <div>
                <dt>{t("Cập nhật gần nhất")}</dt>
                <dd>{candidateDate(c.updatedAt)}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}
