import { Link } from "react-router-dom";
import { useAuth } from "../../app/auth";
import { employmentHistoryLabels } from "./employment-labels";
import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Plus,
  RotateCcw,
  FileText,
  ListChecks,
  Clock,
} from "lucide-react";
import {
  type EmploymentSection,
  type EmploymentView,
  type EmploymentAction,
  type EmploymentContract,
  type ProbationReview,
  type OnboardingPlan,
  contractTypes,
  competencyLabels,
  ratingLabels,
  employmentActionLabels,
  onboardingOwners,
  onboardingProgress,
} from "@hoosoo/shared";
import { Modal, Button } from "../../components/ui";
import { useAction } from "../../hooks/data";
import { t, useLocale, intlLocale } from "../../i18n";
import { dayLabel, today } from "../workflows/workflow-ui";
import { EmploymentBadge } from "./employment-badge";
export function EmploymentDetail({
  section,
  item,
  onClose,
  onEdit,
  onAction,
}: {
  section: EmploymentSection;
  item: EmploymentView;
  onClose: () => void;
  onEdit: () => void;
  onAction: (action: EmploymentAction | "add-task") => void;
}) {
  useLocale();
  const { me } = useAuth();
  const [history, setHistory] = useState(false),
    save = useAction();
  const contract =
    section === "contracts" ? (item as EmploymentContract) : null;
  const probation = section === "probations" ? (item as ProbationReview) : null;
  const plan = section === "onboarding" ? (item as OnboardingPlan) : null;
  return (
    <Modal
      title={item.employeeName}
      description={item.employeeCode}
      size="wide"
      className="employment-dialog"
      onClose={onClose}
    >
      <div className="employment-detail-bar">
        <EmploymentBadge section={section} item={item} />
        <div className="employment-switch" aria-label={t("Nội dung hồ sơ")}>
          <button aria-pressed={!history} onClick={() => setHistory(false)}>
            <FileText size={15} />
            {t("Thông tin")}
          </button>
          <button aria-pressed={history} onClick={() => setHistory(true)}>
            <Clock size={15} />
            {t("Lịch sử")}
          </button>
        </div>
      </div>
      {history ? (
        <ol className="employment-history">
          {[...item.history].reverse().map((e, i) => (
            <li key={i}>
              <span className="history-dot" />
              <div>
                <strong>{e.name}</strong>
                <time>
                  {new Date(e.at).toLocaleString(intlLocale(), {
                    timeZone: "Asia/Ho_Chi_Minh",
                  })}
                </time>
                <p>
                  {t(employmentHistoryLabels[e.action] || "Cập nhật hồ sơ")}
                </p>
                {e.reason && <small>{e.reason}</small>}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <>
          {contract && (
            <>
              <div className="employment-document">
                <FileText size={28} />
                <div>
                  <small>{contract.reference}</small>
                  <h3>{contract.title}</h3>
                  <span>{t(contractTypes[contract.kind])}</span>
                </div>
                {contract.documentUrl && (
                  <a
                    className="text-link"
                    href={contract.documentUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("Mở tài liệu")}
                    <ArrowUpRight size={16} />
                  </a>
                )}
              </div>
              <Link
                className="text-link"
                to={
                  item.employeeId === me?.actor.employeeId
                    ? "/compensation/my"
                    : `/compensation?employeeId=${item.employeeId}`
                }
                onClick={onClose}
              >
                {t("Xem lương & phúc lợi")}
                <ArrowUpRight size={16} />
              </Link>
              <dl className="employment-facts">
                <div>
                  <dt>{t("Ngày bắt đầu")}</dt>
                  <dd>{dayLabel(contract.startDate)}</dd>
                </div>
                <div>
                  <dt>{t("Ngày kết thúc")}</dt>
                  <dd>
                    {contract.endDate
                      ? dayLabel(contract.endDate)
                      : t("Không thời hạn")}
                  </dd>
                </div>
                <div>
                  <dt>{t("Xác nhận của nhân viên")}</dt>
                  <dd>
                    {contract.acknowledgedAt
                      ? new Date(contract.acknowledgedAt).toLocaleDateString(
                          intlLocale(),
                        )
                      : t("Chưa xác nhận")}
                  </dd>
                </div>
              </dl>
              {contract.notes && (
                <section className="employment-notes">
                  <h3>{t("Điều khoản & ghi nhận")}</h3>
                  <p>{contract.notes}</p>
                </section>
              )}
            </>
          )}
          {probation && (
            <>
              <dl className="employment-facts">
                <div>
                  <dt>{t("Ngày bắt đầu")}</dt>
                  <dd>{dayLabel(probation.startDate)}</dd>
                </div>
                <div>
                  <dt>{t("Ngày kết thúc")}</dt>
                  <dd>{dayLabel(probation.endDate)}</dd>
                </div>
              </dl>
              <section className="employment-notes">
                <h3>{t("Mục tiêu thử việc")}</h3>
                <p>{probation.objectives}</p>
              </section>
              {probation.selfReview && (
                <section className="employment-notes">
                  <h3>{t("Tự đánh giá")}</h3>
                  <p>{probation.selfReview}</p>
                </section>
              )}
              {probation.assessments.map((a, i) => (
                <section className="employment-assessment" key={a.at}>
                  <header>
                    <h3>
                      {t("Đánh giá thử việc")} · {i + 1}
                    </h3>
                    <span>{a.name}</span>
                  </header>
                  <dl>
                    {Object.entries(competencyLabels).map(([key, label]) => (
                      <div key={key}>
                        <dt>{t(label)}</dt>
                        <dd
                          className="status-tone"
                          data-tone={
                            a[key as keyof typeof competencyLabels] ===
                            "developing"
                              ? "warning"
                              : "success"
                          }
                        >
                          {t(
                            ratingLabels[
                              a[key as keyof typeof competencyLabels]
                            ],
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <h4>{t("Điểm mạnh & kết quả")}</h4>
                  <p>{a.strengths}</p>
                  <h4>{t("Nội dung cần phát triển")}</h4>
                  <p>{a.improvements}</p>
                  <strong>{t(employmentActionLabels[a.recommendation])}</strong>
                </section>
              ))}
              {probation.decision && (
                <section className="employment-notes">
                  <h3>{t("Nội dung quyết định")}</h3>
                  <p>{probation.decision}</p>
                </section>
              )}
            </>
          )}
          {plan && (
            <>
              <div className="employment-progress-heading">
                <ListChecks size={20} />
                <strong>
                  {plan.tasks.filter((t) => t.completedAt).length}/
                  {plan.tasks.length} {t("đã hoàn thành")}
                </strong>
                <span>{onboardingProgress(plan)}%</span>
              </div>
              <progress
                className="employment-progress"
                max={100}
                value={onboardingProgress(plan)}
                aria-label={t("Tiến độ tiếp nhận")}
              />
              <ol className="employment-checklist">
                {plan.tasks.map((task) => (
                  <li key={task.id} data-done={!!task.completedAt}>
                    <div className="employment-task-mark">
                      {task.completedAt ? <Check size={17} /> : <span />}
                    </div>
                    <div className="employment-task-copy">
                      <strong>{t(task.title)}</strong>
                      <small>
                        <span>{t(onboardingOwners[task.owner])}</span>
                        <span
                          className={
                            !task.completedAt && task.dueDate < today()
                              ? "employment-overdue"
                              : ""
                          }
                        >
                          {dayLabel(task.dueDate)}
                        </span>
                      </small>
                    </div>
                    {item.editableTasks.includes(task.id) && (
                      <Button
                        variant="secondary"
                        busy={save.isPending}
                        aria-label={`${t(task.completedAt ? "Mở lại" : "Hoàn thành")}: ${t(task.title)}`}
                        onClick={() =>
                          void save
                            .mutateAsync({
                              path: `/employment/onboarding/${item.id}/tasks/complete`,
                              body: {
                                version: item.version,
                                taskId: task.id,
                                done: !task.completedAt,
                                note: "",
                              },
                            })
                            .catch(() => {})
                        }
                      >
                        {task.completedAt ? (
                          <RotateCcw size={15} />
                        ) : (
                          <Check size={15} />
                        )}
                        <span>
                          {t(task.completedAt ? "Mở lại" : "Hoàn thành")}
                        </span>
                      </Button>
                    )}
                  </li>
                ))}
              </ol>
              {item.canAddTask && (
                <Button variant="ghost" onClick={() => onAction("add-task")}>
                  <Plus size={16} />
                  {t("Thêm mục tiếp nhận")}
                </Button>
              )}
            </>
          )}
        </>
      )}
      <div className="employment-detail-actions">
        {item.canEdit && (
          <Button variant="secondary" onClick={onEdit}>
            {t("Chỉnh sửa")}
          </Button>
        )}
        {item.actions.map((action) => (
          <Button
            key={action}
            variant={
              ["cancel", "end", "decline", "return"].includes(action)
                ? "secondary"
                : "primary"
            }
            tone={
              ["cancel", "end", "decline", "return"].includes(action)
                ? "danger"
                : ["complete", "confirm", "acknowledge"].includes(action)
                  ? "success"
                  : undefined
            }
            onClick={() => onAction(action)}
          >
            {t(employmentActionLabels[action])}
          </Button>
        ))}
      </div>
    </Modal>
  );
}
