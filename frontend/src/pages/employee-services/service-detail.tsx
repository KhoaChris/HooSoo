import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Plus, FileText, Clock3, ArrowUpRight } from "lucide-react";
import {
  serviceActionLabels,
  serviceStatusLabels,
  serviceTaskOwners,
  serviceTone,
  type ServiceView,
  type ServiceAction,
} from "@hoosoo/shared";
import { Button, Modal } from "../../components/ui";
import { t, useLocale, intlLocale } from "../../i18n";
import { dayLabel } from "../workflows/workflow-ui";
import { type ServiceDecision } from "./service-editor";
export function ServiceBadge({ item }: { item: ServiceView }) {
  return (
    <span
      className="workflow-status status-tone"
      data-tone={serviceTone(item.status)}
    >
      {t(serviceStatusLabels[item.status])}
    </span>
  );
}
const historyLabels: Record<string, string> = {
  created: "Tạo hồ sơ",
  updated: "Chỉnh sửa hồ sơ",
  "task-added": "Thêm mục bàn giao",
  "task-completed": "Xác nhận bàn giao",
  "task-reopened": "Mở lại mục bàn giao",
};
export function ServiceDetail({
  item,
  onClose,
  onEdit,
  onAction,
  personal,
}: {
  item: ServiceView;
  onClose: () => void;
  onEdit: () => void;
  onAction: (d: ServiceDecision) => void;
  personal: boolean;
}) {
  useLocale();
  const [history, setHistory] = useState(false);
  return (
    <Modal
      title={item.title}
      description={`${item.employeeName} · ${item.employeeCode}`}
      size="wide"
      className="service-detail"
      onClose={onClose}
    >
      <div className="service-detail-toolbar">
        <ServiceBadge item={item} />
        <div className="employment-switch">
          <button aria-pressed={!history} onClick={() => setHistory(false)}>
            <FileText size={15} />
            {t("Thông tin")}
          </button>
          <button aria-pressed={history} onClick={() => setHistory(true)}>
            <Clock3 size={15} />
            {t("Lịch sử")}
          </button>
        </div>
      </div>
      {history ? (
        <ol className="employment-history">
          {[...item.history].reverse().map((h, i) => (
            <li key={i}>
              <span className="history-dot" />
              <div>
                <strong>
                  {t(
                    serviceActionLabels[h.action as ServiceAction] ??
                      historyLabels[h.action] ??
                      "Cập nhật hồ sơ",
                  )}
                </strong>
                <small>
                  {h.name} · {new Date(h.at).toLocaleString(intlLocale())}
                </small>
                {h.reason && <p>{h.reason}</p>}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <>
          <dl className="service-facts">
            {item.assetCode && (
              <div>
                <dt>{t("Mã tài sản")}</dt>
                <dd>{item.assetCode}</dd>
              </div>
            )}
            {item.provider && (
              <div>
                <dt>{t("Đơn vị đào tạo")}</dt>
                <dd>{item.provider}</dd>
              </div>
            )}
            {item.section !== "offboarding" && (
              <div>
                <dt>{t("Bắt đầu")}</dt>
                <dd>{dayLabel(item.startDate)}</dd>
              </div>
            )}
            {item.endDate && (
              <div>
                <dt>
                  {t(
                    item.section === "offboarding"
                      ? "Ngày làm việc cuối"
                      : item.section === "assets"
                        ? "Hạn thu hồi"
                        : "Kết thúc",
                  )}
                </dt>
                <dd>{dayLabel(item.endDate)}</dd>
              </div>
            )}
          </dl>
          {item.notes && (
            <section className="service-text">
              <h3>
                {t(
                  item.section === "offboarding"
                    ? "Lý do nghỉ việc"
                    : "Nội dung bàn giao / yêu cầu",
                )}
              </h3>
              <p>{item.notes}</p>
            </section>
          )}
          {item.outcome && (
            <section className="service-text">
              <h3>{t("Kết quả đào tạo")}</h3>
              <p>{item.outcome}</p>
              {item.documentUrl && (
                <a
                  className="text-link"
                  href={item.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("Xem chứng nhận")}
                  <ArrowUpRight size={16} />
                </a>
              )}
            </section>
          )}
          {item.sourceRequestId && (
            <Link
              className="text-link"
              to={personal ? "/requests/my" : "/requests/approvals"}
            >
              {t("Xem phiếu đề nghị")}
              <ArrowUpRight size={16} />
            </Link>
          )}
          {item.section === "offboarding" && (
            <section>
              <div className="section-heading">
                <h3>{t("Danh sách bàn giao")}</h3>
                <span>
                  {item.tasks.filter((x) => x.completedAt).length}/
                  {item.tasks.length}
                </span>
              </div>
              <ul className="service-checklist">
                {item.tasks.map((task) => (
                  <li key={task.id}>
                    <span
                      className={
                        task.completedAt
                          ? "service-check done"
                          : "service-check"
                      }
                    >
                      {task.completedAt && <Check size={16} />}
                    </span>
                    <div>
                      <strong>{t(task.title)}</strong>
                      <small>{t(serviceTaskOwners[task.owner])}</small>
                      {task.note && <p>{task.note}</p>}
                    </div>
                    {item.editableTasks.includes(task.id) && (
                      <Button
                        variant="secondary"
                        onClick={() => onAction({ item, action: "task", task })}
                      >
                        {t(task.completedAt ? "Mở lại" : "Xác nhận")}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              {item.canAddTask && (
                <Button
                  variant="ghost"
                  onClick={() => onAction({ item, action: "add-task" })}
                >
                  <Plus size={16} />
                  {t("Thêm mục bàn giao")}
                </Button>
              )}
              {item.blockers.length > 0 && (
                <ul className="service-blockers">
                  {item.blockers.map((b) => (
                    <li key={b}>{t(b)}</li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <div className="form-actions">
            {item.canEdit && (
              <Button variant="secondary" onClick={onEdit}>
                {t("Chỉnh sửa")}
              </Button>
            )}
            {item.actions.map((action) => (
              <Button
                key={action}
                variant={action === "cancel" ? "secondary" : "primary"}
                tone={
                  action === "cancel" || action === "complete"
                    ? "danger"
                    : ["accept-learning", "receive-return"].includes(action)
                      ? "success"
                      : undefined
                }
                disabled={action === "complete" && !!item.blockers.length}
                onClick={() => onAction({ item, action })}
              >
                {t(serviceActionLabels[action])}
              </Button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
