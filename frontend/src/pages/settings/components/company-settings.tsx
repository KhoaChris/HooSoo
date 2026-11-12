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
  const [edit, setEdit] = useState(false),
    action = useAction();
  return (
    <>
      <Heading
        eyebrow="QUẢN TRỊ"
        title="Thông tin doanh nghiệp"
        description="Thông tin nhận diện dùng chung trong không gian làm việc."
      />
      <section className="company-workspace">
        <header className="company-identity">
          <span className="company-monogram" aria-hidden="true">
            {settings.companyName.trim().slice(0, 1).toUpperCase()}
          </span>
          <div>
            <span className="company-kicker">DOANH NGHIỆP</span>
            <h2>{settings.companyName}</h2>
            <p>Không gian quản trị nhân sự</p>
          </div>
          <Button variant="secondary" onClick={() => setEdit(true)}>
            <Pencil size={15} />
            Chỉnh sửa thông tin
          </Button>
        </header>
        <div className="company-content">
          <div>
            <h3>Thông tin chung</h3>
            <p>
              Tên doanh nghiệp xuất hiện trên thanh điều hướng và sơ đồ tổ chức.
            </p>
          </div>
          <dl>
            <div>
              <dt>Tên doanh nghiệp</dt>
              <dd>{settings.companyName}</dd>
            </div>
            <div>
              <dt>Múi giờ làm việc</dt>
              <dd>
                Việt Nam <span>UTC+7</span>
              </dd>
            </div>
            {settings.updatedAt && (
              <div>
                <dt>Cập nhật cấu hình gần nhất</dt>
                <dd>
                  {dateText(settings.updatedAt)} ·{" "}
                  {timeText(settings.updatedAt)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </section>
      <section className="admin-shortcuts" aria-label="Quản trị liên quan">
        <h2>Quản trị không gian làm việc</h2>
        <div>
          {[
            {
              to: "/settings/users",
              title: "Tài khoản & phân quyền",
              text: "Cấp quyền truy cập cho thành viên.",
              icon: ShieldCheck,
            },
            {
              to: "/settings/hr",
              title: "Chính sách nhân sự",
              text: "Lịch làm việc và chính sách nghỉ phép.",
              icon: CalendarDays,
            },
            {
              to: "/audit-logs",
              title: "Nhật ký thao tác",
              text: "Tra cứu những thay đổi đã ghi nhận.",
              icon: History,
            },
          ].map(({ to, title, text, icon: Icon }) => (
            <Link key={to} to={to}>
              <Icon size={20} />
              <span>
                <strong>{title}</strong>
                <small>{text}</small>
              </span>
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </div>
      </section>
      {edit && (
        <Modal
          title="Chỉnh sửa thông tin doanh nghiệp"
          description="Tên mới sẽ được sử dụng trong toàn bộ không gian làm việc."
          icon={<Building2 size={21} />}
          onClose={() => setEdit(false)}
        >
          <Form
            schema={settingsSchema}
            fields={[
              {
                name: "companyName",
                label: "Tên doanh nghiệp",
                required: true,
                placeholder: "Nhập tên doanh nghiệp",
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
            submitLabel="Lưu thông tin"
          />
        </Modal>
      )}
    </>
  );
}
