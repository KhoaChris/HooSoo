import { t, useLocale } from "../../../i18n";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Pencil,
  ArrowUpRight,
  ShieldCheck,
  CalendarDays,
  History,
} from "lucide-react";
import { settingsSchema, type Settings } from "@hoosoo/shared";
import { Heading, Button, Form, Modal } from "../../../components/ui";
import { useAction } from "../../../hooks/data";
import { dateText, timeText } from "../../../utils/date-time";

export function CompanySettings({ settings }: { settings: Settings }) {
  useLocale();
  const [edit, setEdit] = useState(false),
    action = useAction();
  return (
    <>
      <Heading eyebrow={t("QUẢN TRỊ")} title={t("Thông tin doanh nghiệp")} />
      <section className="company-workspace">
        <header className="company-identity">
          <span className="company-monogram" aria-hidden="true">
            {settings.companyName.trim().slice(0, 1).toUpperCase()}
          </span>
          <div>
            <span className="company-kicker">{t("DOANH NGHIỆP")}</span>
            <h2>{settings.companyName}</h2>
          </div>
          <Button variant="secondary" onClick={() => setEdit(true)}>
            <Pencil size={15} />
            {t("Chỉnh sửa thông tin")}
          </Button>
        </header>
        <div className="company-content">
          <div>
            <h3>{t("Thông tin chung")}</h3>
          </div>
          <dl>
            <div>
              <dt>{t("Tên doanh nghiệp")}</dt>
              <dd>{settings.companyName}</dd>
            </div>
            <div>
              <dt>{t("Múi giờ làm việc")}</dt>
              <dd>
                {t("Việt Nam")} <span>UTC+7</span>
              </dd>
            </div>
            {settings.updatedAt && (
              <div>
                <dt>{t("Cập nhật cấu hình gần nhất")}</dt>
                <dd>
                  {dateText(settings.updatedAt)} ·{" "}
                  {timeText(settings.updatedAt)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </section>
      <section className="admin-shortcuts" aria-label={t("Quản trị liên quan")}>
        <h2>{t("Quản trị không gian làm việc")}</h2>
        <div>
          {[
            {
              to: "/settings/users",
              title: t("Tài khoản & phân quyền"),
              icon: ShieldCheck,
            },
            {
              to: "/settings/hr",
              title: t("Chính sách nhân sự"),
              icon: CalendarDays,
            },
            {
              to: "/audit-logs",
              title: t("Nhật ký thao tác"),
              icon: History,
            },
          ].map(({ to, title, icon: Icon }) => (
            <Link key={to} to={to}>
              <Icon size={20} />
              <span>
                <strong>{title}</strong>
              </span>
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </div>
      </section>
      {edit && (
        <Modal
          title={t("Chỉnh sửa thông tin doanh nghiệp")}
          icon={<Building2 size={21} />}
          onClose={() => setEdit(false)}
        >
          <Form
            schema={settingsSchema}
            fields={[
              {
                name: "companyName",
                label: t("Tên doanh nghiệp"),
                required: true,
                placeholder: t("Nhập tên doanh nghiệp"),
              },
            ]}
            defaults={{ companyName: settings.companyName }}
            onSubmit={async (body) => {
              await action.mutateAsync({
                path: "/settings",
                method: "PATCH",
                body,
              });
              setEdit(false);
            }}
            onCancel={() => setEdit(false)}
            submitLabel={t("Lưu thông tin")}
          />
        </Modal>
      )}
    </>
  );
}
