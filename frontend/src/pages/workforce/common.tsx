import "./workforce.css";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Clock3,
  FileText,
  AlertCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { z } from "zod";
import { isSupervisorRole } from "@hoosoo/shared";
import type {
  Catalog,
  LeaveType,
  Schedule,
  WorkforcePerson,
  WorkflowEvent,
  Balance,
} from "@hoosoo/shared";
import { Button, Form, Modal } from "../../components/ui";
import { useAction } from "../../hooks/data";
import { t, intlLocale } from "../../i18n";
import { useAuth } from "../../app/auth";
export type Workspace<T> = {
  items: T[];
  people: WorkforcePerson[];
  managers?: WorkforcePerson[];
  canCreate: boolean;
  departments: Catalog[];
  positions: Catalog[];
  leaveTypes: LeaveType[];
  schedule: Schedule | null;
  balances: Balance[];
};
export const money = (n: number) =>
  new Intl.NumberFormat(intlLocale(), {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
export const dateLabel = (v: string) =>
  v
    ? new Intl.DateTimeFormat(intlLocale()).format(
        new Date(v.length === 10 ? v + "T00:00:00" : v),
      )
    : "—";
export const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
    new Date(),
  );
export const states: Record<string, string> = {
  draft: "Bản nháp",
  review: "Chờ đối soát",
  approved: "Đã duyệt",
  published: "Đã công bố",
  voided: "Đã hủy hiệu lực",
  pending: "Chờ duyệt",
  rejected: "Đã từ chối",
  cancelled: "Đã hủy",
  applied: "Đã áp dụng",
  active: "Đang lưu trữ",
  archived: "Đã lưu trữ",
};
export const actions: Record<string, string> = {
  edit: "Chỉnh sửa",
  submit: "Gửi duyệt",
  return: "Trả về nháp",
  approve: "Phê duyệt",
  publish: "Công bố",
  void: "Hủy hiệu lực",
  reissue: "Lập phiên bản mới",
  reject: "Từ chối",
  cancel: "Hủy đề nghị",
  apply: "Áp dụng điều chuyển",
  archive: "Lưu trữ",
  acknowledge: "Xác nhận đã đọc",
};
export function Status({ value }: { value: string }) {
  const tone = ["published", "approved", "applied", "active"].includes(value)
      ? "success"
      : ["rejected", "voided"].includes(value)
        ? "danger"
        : ["pending", "review"].includes(value)
          ? "warning"
          : "neutral",
    Icon =
      tone === "success"
        ? CheckCircle2
        : tone === "danger"
          ? AlertCircle
          : tone === "warning"
            ? Clock3
            : Circle;
  return (
    <span className={`wf-status wf-${tone}`}>
      <Icon size={14} />
      {t(states[value] ?? value)}
    </span>
  );
}
export function Empty({ children }: { children?: ReactNode }) {
  return (
    <div className="wf-empty">
      <FileText size={26} />
      <h3>{t("Chưa có nội dung")}</h3>
      <p>
        {children ?? t("Các hồ sơ trong phạm vi của bạn sẽ xuất hiện tại đây.")}
      </p>
    </div>
  );
}
export function History({ events }: { events: WorkflowEvent[] }) {
  return (
    <details className="wf-history">
      <summary>
        {t("Lịch sử xử lý")} · {events.length}
      </summary>
      <ol>
        {events
          .slice()
          .reverse()
          .map((e, i) => (
            <li key={`${e.at}-${i}`}>
              <strong>{e.name || t("Hệ thống")}</strong>
              <time>{dateLabel(e.at)}</time>
              <p>{e.reason || t("Đã cập nhật hồ sơ")}</p>
            </li>
          ))}
      </ol>
    </details>
  );
}
export function Decision({
  section,
  id,
  version,
  action,
  onClose,
}: {
  section: string;
  id: string;
  version: number;
  action: string;
  onClose: () => void;
}) {
  const run = useAction();
  return (
    <Modal title={t(actions[action])} onClose={onClose}>
      <p className="wf-hint">
        {t(
          section === "payroll"
            ? "Kiểm tra công, phép và các khoản điều chỉnh trước khi xác nhận. Phiếu đã công bố được lưu theo phiên bản."
            : "Thao tác được ghi lại cùng người thực hiện và lý do.",
        )}
      </p>
      <Form
        schema={z.object({ reason: z.string().trim().min(5).max(2000) })}
        fields={[
          {
            name: "reason",
            label: "Lý do / căn cứ xử lý",
            type: "textarea",
            required: true,
          },
        ]}
        onCancel={onClose}
        submitLabel={t(actions[action])}
        submitTone={
          ["reject", "cancel", "void", "archive"].includes(action)
            ? "danger"
            : undefined
        }
        onSubmit={async (value) => {
          await run.mutateAsync({
            path: `/workforce/${section}/${id}/${action}`,
            body: { ...value, version },
          });
          onClose();
        }}
      />
    </Modal>
  );
}
export function WorkforceLinks({
  group,
  employeeId,
  personal,
}: {
  employeeId?: string;
  personal?: boolean;
  group: "people" | "payroll" | "time" | "company" | "profile";
}) {
  const { me } = useAuth();
  const manager = me && isSupervisorRole(me.actor.role) && !personal,
    hr = ["Admin", "HR"].includes(me?.actor.role ?? "");
  const entries =
    group === "payroll"
      ? [["payroll", "Kỳ lương & phiếu lương"]]
      : group === "time"
        ? [["time", "Tăng ca & nghỉ theo giờ"]]
        : group === "company"
          ? [
              ["announcements", "Bản tin & chính sách"],
              ["calendar", "Lịch & nhắc hạn"],
            ]
          : group === "profile"
            ? [["documents", "Tài liệu nhân sự"]]
            : [
                ["changes", "Điều chuyển & bổ nhiệm"],
                ["documents", "Tài liệu nhân sự"],
                ...(hr ? [["imports", "Nhập danh sách nhân viên"]] : []),
              ];
  if (
    group === "profile" &&
    employeeId &&
    employeeId !== me?.employee.id &&
    !hr
  )
    return null;
  return (
    <nav className="wf-links" aria-label={t("Chức năng liên quan")}>
      {entries.map(([path, label]) => (
        <Link
          key={path}
          to={`/workforce/${path}?scope=${manager && (group !== "profile" || (!!employeeId && employeeId !== me?.employee.id)) ? "team" : "my"}${employeeId ? `&employee=${employeeId}` : ""}`}
        >
          {t(label)}
          <ArrowUpRight size={15} />
        </Link>
      ))}
    </nav>
  );
}
export function escapeHtml(v: unknown) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function printRecord(
  title: string,
  rows: [string, string][],
  note = "",
) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.opener = null;
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:15px/1.6 system-ui;color:#18263b;max-width:780px;margin:50px auto;padding:20px}h1{font-size:26px}table{width:100%;border-collapse:collapse}td{padding:12px;border-bottom:1px solid #dde2ea}td:first-child{width:45%;color:#526078}p{white-space:pre-wrap}</style></head><body><small>HooSoo · HR Workspace</small><h1>${escapeHtml(title)}</h1><table>${rows.map(([a, b]) => `<tr><td>${escapeHtml(a)}</td><td>${escapeHtml(b)}</td></tr>`).join("")}</table><p>${escapeHtml(note)}</p></body></html>`,
  );
  win.document.close();
  win.focus();
  win.print();
}
export function DownloadButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button variant="secondary" onClick={onClick}>
      {children}
    </Button>
  );
}
