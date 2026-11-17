import { useId, useState } from "react";
import {
  Target,
  Clock3,
  Pencil,
  ClipboardCheck,
  History,
  ArrowRight,
} from "lucide-react";
import {
  performanceActions,
  performanceStatusLabels,
  performanceCompetencies,
  performanceLevels,
  performanceHistoryLabels,
  performancePriorities,
  performanceOutcomeLabels,
  type PerformanceView,
  type PerformanceAction,
  type SavedPerformanceAssessment,
} from "@hoosoo/shared";
import { Button, Modal } from "../../components/ui";
import { SectionTabs, SectionTabPanel } from "../../components/ui/section-tabs";
import { t, useLocale, intlLocale } from "../../i18n";
import { reviewTitle } from "./performance-planning";
import { dayLabel } from "../workflows/workflow-ui";
export function PerformanceBadge({ item }: { item: PerformanceView }) {
  return (
    <span
      className="badge status-tone"
      data-tone={
        item.status === "cancelled"
          ? "danger"
          : ["completed", "acknowledged"].includes(item.status)
            ? "success"
            : item.status === "draft"
              ? "neutral"
              : "warning"
      }
    >
      {t(performanceStatusLabels[item.status])}
    </span>
  );
}
export function PerformanceDetail({
  item,
  onClose,
  onEdit,
  onAction,
}: {
  item: PerformanceView;
  onClose: () => void;
  onEdit: () => void;
  onAction: (a: PerformanceAction) => void;
}) {
  useLocale();
  const id = useId();
  const [tab, setTab] = useState("goals");
  const tabs = [
    { id: "goals", label: "Mục tiêu đánh giá", Icon: Target },
    { id: "results", label: "Đánh giá & phát triển", Icon: ClipboardCheck },
    { id: "history", label: "Lịch sử", Icon: History },
  ];
  return (
    <Modal
      title={item.employeeName}
      description={`${item.employeeCode} · ${reviewTitle(item)}`}
      icon={<Target size={22} />}
      size="wide"
      onClose={onClose}
    >
      <div className="performance-detail">
        <div className="performance-detail-meta">
          <PerformanceBadge item={item} />
          <span>
            <Clock3 size={15} />
            {dayLabel(item.startDate)} — {dayLabel(item.endDate)}
          </span>
        </div>
        <SectionTabs
          id={id}
          label={t("Nội dung đánh giá")}
          items={tabs.map(({ id, label, Icon }) => ({
            value: id,
            label: t(label),
            icon: <Icon size={17} />,
          }))}
          value={tab}
          onChange={setTab}
        />
        <SectionTabPanel
          id={id}
          value="goals"
          active={tab}
          className="performance-detail-panel"
        >
          <dl className="performance-deadlines">
            <div>
              <dt>{t("Hạn quản lý đánh giá")}</dt>
              <dd>{dayLabel(item.managerDue)}</dd>
            </div>
            <div>
              <dt>{t("Người đánh giá")}</dt>
              <dd>{item.reviewerName}</dd>
            </div>
          </dl>
          <div className="performance-detail-goals">
            {item.goals.map((g, i) => (
              <section key={g.id}>
                <span className="performance-goal-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{g.title}</h3>
                  {g.kind === "qualitative" ? (
                    <p className="performance-expectation">{g.expectation}</p>
                  ) : (
                    <span>
                      {t(
                        g.direction === "higher"
                          ? "Càng cao càng tốt"
                          : "Càng thấp càng tốt",
                      )}
                    </span>
                  )}
                </div>
                <strong>
                  {g.kind === "qualitative"
                    ? t(performancePriorities[g.priority])
                    : `${g.target} ${g.unit}`}
                  <small>{t("Tỷ trọng {0}%", [g.weight])}</small>
                </strong>
              </section>
            ))}
          </div>
        </SectionTabPanel>
        <SectionTabPanel
          id={id}
          value="results"
          active={tab}
          className="performance-detail-panel"
        >
          <div className="performance-score-comparison">
            {([["Đánh giá quản lý", item.managerAssessment]] as const).map(
              ([label, a]) => (
                <div key={label}>
                  <span>{t(label)}</span>
                  <strong>
                    {a?.score === null || a?.score === undefined
                      ? "—"
                      : `${a.score}%`}
                  </strong>
                  <small>
                    {a
                      ? t(a.submitted ? "Đã gửi" : "Bản nháp")
                      : t("Chưa công bố")}
                  </small>
                </div>
              ),
            )}
          </div>
          <p className="performance-score-method">
            {t("Mục tiêu 70% · Năng lực 30%")}
          </p>
          {item.finalNote && (
            <section className="performance-final-note">
              <h3>{t("Kết luận cuối kỳ")}</h3>
              <p>{item.finalNote}</p>
              <small>{dayLabel(item.finalAt.slice(0, 10))}</small>
            </section>
          )}
          {item.selfAssessment && (
            <details
              className="performance-assessment-detail"
              open={!item.managerAssessment}
            >
              <summary>{t("Tự đánh giá trước đây")}</summary>
              <SavedAssessment assessment={item.selfAssessment} item={item} />
            </details>
          )}
          {item.managerAssessment && (
            <details className="performance-assessment-detail" open>
              <summary>{t("Đánh giá quản lý")}</summary>
              <SavedAssessment
                assessment={item.managerAssessment}
                item={item}
              />
            </details>
          )}
          {!item.selfAssessment && !item.managerAssessment && (
            <p className="performance-empty">
              {t("Chưa có đánh giá được công bố.")}
            </p>
          )}
        </SectionTabPanel>
        <SectionTabPanel
          id={id}
          value="history"
          active={tab}
          className="performance-detail-panel"
        >
          <ol className="performance-timeline">
            {[...item.history].reverse().map((h, i) => (
              <li key={i}>
                <strong>
                  {t(
                    performanceHistoryLabels[
                      h.action.replace("performance_", "")
                    ] ?? "Cập nhật đánh giá",
                  )}
                </strong>
                <span>
                  {h.name} · {new Date(h.at).toLocaleString(intlLocale())}
                </span>
                {h.reason && <p>{h.reason}</p>}
              </li>
            ))}
          </ol>
          {!!item.revisions.length && (
            <details className="performance-assessment-detail">
              <summary>
                {t("Bản đánh giá trước ({0})", [item.revisions.length])}
              </summary>
              {[...item.revisions].reverse().map((r, i) => (
                <section key={i}>
                  <h3>
                    {t(r.phase === "self" ? "Tự đánh giá" : "Đánh giá quản lý")}
                  </h3>
                  <SavedAssessment assessment={r.assessment} item={item} />
                </section>
              ))}
            </details>
          )}
        </SectionTabPanel>
        <div className="form-actions performance-detail-actions">
          {item.canEdit && (
            <Button variant="secondary" onClick={onEdit}>
              <Pencil size={16} />
              {t("Chỉnh sửa mục tiêu")}
            </Button>
          )}
          {item.actions.map((a) => (
            <Button
              key={a}
              variant={
                ["cancel", "return_self", "return_manager"].includes(a)
                  ? "secondary"
                  : "primary"
              }
              tone={
                a === "cancel"
                  ? "danger"
                  : ["finalize", "acknowledge"].includes(a)
                    ? "success"
                    : undefined
              }
              onClick={() => onAction(a)}
            >
              {t(performanceActions[a])}
              {a === "self" || a === "manager" ? (
                <ArrowRight size={16} />
              ) : null}
            </Button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
function SavedAssessment({
  assessment: a,
  item,
}: {
  assessment: SavedPerformanceAssessment;
  item: PerformanceView;
}) {
  return (
    <div className="performance-saved">
      <p className="performance-saved-author">
        {a.name} · {new Date(a.at).toLocaleString(intlLocale())}
      </p>
      <dl>
        {a.data.goals.map((g) => {
          const goal = item.goals.find((x) => x.id === g.goalId);
          return (
            <div key={g.goalId}>
              <dt>{goal?.title}</dt>
              <dd>
                {g.outcome
                  ? t(performanceOutcomeLabels[g.outcome])
                  : `${g.actual ?? "—"} ${goal?.kind !== "qualitative" ? (goal?.unit ?? "") : ""}`}
              </dd>
              <p>{g.evidence || "—"}</p>
            </div>
          );
        })}
        {a.data.competencies.map((c) => (
          <div key={c.criterionId}>
            <dt>
              {t(
                performanceCompetencies.find((x) => x.id === c.criterionId)
                  ?.label,
              )}
            </dt>
            <dd>{t(performanceLevels[c.rating - 1] ?? "Chưa đánh giá")}</dd>
            <p>{c.evidence || "—"}</p>
          </div>
        ))}
      </dl>
      {(
        [
          ["strengths", "Điểm mạnh"],
          ["improvements", "Điểm cần cải thiện"],
          ["developmentPlan", "Kế hoạch phát triển"],
        ] as const
      ).map(([key, label]) => (
        <section key={key}>
          <h4>{t(label)}</h4>
          <p>{a.data[key] || "—"}</p>
        </section>
      ))}
    </div>
  );
}
