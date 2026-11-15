import { useState } from "react";
import { CalendarDays, History, WalletCards, Pencil, Plus } from "lucide-react";
import {
  allowancePresets,
  benefitPresets,
  monthlyPackageTotal,
  type CompensationPerson,
  type CompensationView,
  type SalaryPackage,
} from "@hoosoo/shared";
import { Button, Modal } from "../../components/ui";
import { t, useLocale, intlLocale } from "../../i18n";
import { dayLabel } from "../workflows/workflow-ui";
import { compensationLabels, moneyLabel } from "./compensation-model";
export function CompensationBadge({ record }: { record: CompensationView }) {
  const tone =
    record.phase === "current"
      ? "success"
      : record.phase === "scheduled"
        ? "warning"
        : record.phase === "cancelled"
          ? "danger"
          : "neutral";
  return (
    <span className="compensation-badge status-tone" data-tone={tone}>
      {t(compensationLabels[record.phase])}
    </span>
  );
}
export function PackageSummary({ value }: { value: SalaryPackage }) {
  useLocale();
  return (
    <div className="package-summary">
      <div className="compensation-amount">
        <WalletCards size={22} />
        <div>
          <span>{t("Tổng cố định hàng tháng")}</span>
          <strong>{moneyLabel(monthlyPackageTotal(value))}</strong>
          <small>{t("VND / tháng · trước thuế")}</small>
        </div>
      </div>
      <dl className="compensation-breakdown">
        <div>
          <dt>{t("Lương cơ bản")}</dt>
          <dd>{moneyLabel(value.baseSalary)}</dd>
        </div>
        {value.allowances.map((item) => (
          <div key={item.id}>
            <dt>
              {item.kind === "custom"
                ? item.name
                : t(allowancePresets[item.kind])}
            </dt>
            <dd>{moneyLabel(item.amount)}</dd>
          </div>
        ))}
        {value.probationSalary !== null && (
          <div className="compensation-probation">
            <dt>{t("Lương cơ bản khi thử việc")}</dt>
            <dd>{moneyLabel(value.probationSalary)}</dd>
          </div>
        )}
      </dl>
      {!!value.benefits.length && (
        <section className="compensation-benefits">
          <h3>{t("Phúc lợi")}</h3>
          <ul>
            {value.benefits.map((item) => (
              <li key={item.id}>
                <strong>
                  {item.kind === "custom"
                    ? item.name
                    : t(benefitPresets[item.kind])}
                </strong>
                {item.detail && <p>{item.detail}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {value.bonusPolicy && (
        <section className="compensation-benefits">
          <h3>{t("Chính sách thưởng")}</h3>
          <p>{value.bonusPolicy}</p>
        </section>
      )}
    </div>
  );
}
export function CompensationDetail({
  person,
  record,
  onClose,
  onEdit,
  onAction,
}: {
  person: CompensationPerson;
  record: CompensationView;
  onClose: () => void;
  onEdit: (item?: CompensationView) => void;
  onAction: (action: "publish" | "cancel") => void;
}) {
  useLocale();
  const [history, setHistory] = useState(false);
  return (
    <Modal
      title={person.name}
      description={person.employeeCode}
      icon={<WalletCards size={22} />}
      onClose={onClose}
      size="wide"
      className="compensation-dialog"
    >
      <div className="compensation-record-bar">
        <CompensationBadge record={record} />
        <span>
          <CalendarDays size={16} />
          {t("Hiệu lực từ")} {dayLabel(record.effectiveDate)}
        </span>
        <Button
          variant="ghost"
          aria-pressed={history}
          onClick={() => setHistory(!history)}
        >
          <History size={16} />
          {t("Lịch sử")}
        </Button>
      </div>
      {history ? (
        <ol className="employment-history">
          {[...record.history].reverse().map((item, i) => (
            <li key={i}>
              <span className="history-dot" />
              <div>
                <strong>{item.name}</strong>
                <time>
                  {new Date(item.at).toLocaleString(intlLocale(), {
                    timeZone: "Asia/Ho_Chi_Minh",
                  })}
                </time>
                <p>
                  {t(
                    (
                      {
                        created: "Tạo hồ sơ lương",
                        updated: "Cập nhật hồ sơ lương",
                        publish: "Công bố mức lương",
                        cancel: "Hủy điều chỉnh",
                      } as Record<string, string>
                    )[item.action] ?? item.action,
                  )}
                </p>
                {item.reason && <small>{item.reason}</small>}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <>
          <PackageSummary value={record.package} />
          <section className="compensation-benefits">
            <h3>{t("Lý do điều chỉnh")}</h3>
            <p>{record.reason}</p>
          </section>
        </>
      )}
      <div className="compensation-detail-actions">
        {record.canCancel && (
          <Button
            variant="secondary"
            tone="danger"
            onClick={() => onAction("cancel")}
          >
            {t("Hủy điều chỉnh")}
          </Button>
        )}
        {record.canEdit ? (
          <Button variant="secondary" onClick={() => onEdit(record)}>
            <Pencil size={16} />
            {t("Chỉnh sửa")}
          </Button>
        ) : (
          person.canManage && (
            <Button variant="secondary" onClick={() => onEdit()}>
              <Plus size={16} />
              {t("Tạo điều chỉnh")}
            </Button>
          )
        )}
        {record.canPublish && (
          <Button tone="success" onClick={() => onAction("publish")}>
            {t("Công bố mức lương")}
          </Button>
        )}
      </div>
    </Modal>
  );
}
