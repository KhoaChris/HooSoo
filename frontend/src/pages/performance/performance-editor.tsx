import { useEffect, useRef, useState, type ReactNode } from "react";
import { Target, Send, Save } from "lucide-react";
import {
  performanceSaveSchema,
  performanceActionSchema,
  performanceActions,
  performanceCompetencies,
  performanceLevels,
  performanceOutcomes,
  performanceOutcomeLabels,
  performanceAssessmentSchema,
  performanceScore,
  type PerformanceView,
  type PerformanceAction,
  type PerformanceDraft,
} from "@hoosoo/shared";
import {
  Button,
  Select,
  Textarea,
  Form,
  Modal,
  ErrorBox,
} from "../../components/ui";
import { useModalForm } from "../../components/ui/modal";
import { useAction } from "../../hooks/data";
import { t, useLocale } from "../../i18n";
import { reviewTitle } from "./performance-planning";

export { PerformanceEditor } from "./performance-setup";
export function PerformanceDecision({
  item,
  action,
  onClose,
}: {
  item: PerformanceView;
  action: PerformanceAction;
  onClose: () => void;
}) {
  const save = useAction();
  useLocale();
  return (
    <Modal
      title={t(performanceActions[action])}
      description={`${item.employeeName} · ${reviewTitle(item)}`}
      onClose={onClose}
    >
      <Form
        schema={performanceActionSchema}
        defaults={{
          version: item.version,
          reason:
            action === "acknowledge"
              ? t("Đã xem và xác nhận kết quả đánh giá.")
              : "",
        }}
        fields={[
          {
            name: "reason",
            label:
              action === "finalize" ? "Kết luận cuối kỳ" : "Nội dung xác nhận",
            type: "textarea",
            required: true,
          },
        ]}
        submitLabel={t(performanceActions[action])}
        submitTone={
          action === "cancel"
            ? "danger"
            : ["finalize", "acknowledge"].includes(action)
              ? "success"
              : undefined
        }
        onCancel={onClose}
        onSubmit={async (body) => {
          await save.mutateAsync({
            path: `/performance/reviews/${item.id}/${action}`,
            body,
          });
          onClose();
        }}
      />
    </Modal>
  );
}
export function PerformanceAssessmentDialog({
  item,
  phase,
  onClose,
}: {
  item: PerformanceView;
  phase: "self" | "manager";
  onClose: () => void;
}) {
  useLocale();
  return (
    <Modal
      title={t(performanceActions[phase])}
      description={`${item.employeeName} · ${reviewTitle(item)}`}
      size="wide"
      className="performance-review-dialog"
      onClose={onClose}
    >
      <AssessmentForm item={item} phase={phase} onClose={onClose} />
    </Modal>
  );
}
function AssessmentForm({
  item,
  phase,
  onClose,
}: {
  item: PerformanceView;
  phase: "self" | "manager";
  onClose: () => void;
}) {
  const existing =
    phase === "self" ? item.selfAssessment : item.managerAssessment;
  const [draft, setDraft] = useState<PerformanceDraft>(() =>
    structuredClone(
      existing?.data ?? {
        goals: item.goals.map((g) => ({
          goalId: g.id,
          actual: null,
          evidence: "",
        })),
        competencies: performanceCompetencies.map((c) => ({
          criterionId: c.id,
          rating: 0,
          evidence: "",
        })),
        strengths: "",
        improvements: "",
        developmentPlan: "",
      },
    ),
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<Error | null>(null),
    [busy, setBusy] = useState(false),
    [invalid, setInvalid] = useState<string[]>([]);
  const initial = useRef(JSON.stringify(draft)),
    version = useRef(item.version),
    saving = useRef(false),
    form = useRef<HTMLFormElement>(null);
  const modal = useModalForm(),
    report = modal?.setFormStatus,
    save = useAction(),
    dirty = JSON.stringify(draft) !== initial.current || !!reason;
  useEffect(() => {
    report?.({ dirty, busy });
    return () => report?.({ dirty: false, busy: false });
  }, [report, dirty, busy]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  const full = performanceAssessmentSchema.safeParse(draft),
    score = full.success ? performanceScore(item, full.data) : null;
  const invalidField = (path: string) =>
    invalid.some((x) => x.startsWith(path));
  const send = async (submit: boolean) => {
    if (saving.current) return;
    const parsed = performanceSaveSchema.safeParse({
      version: version.current,
      submit,
      assessment: draft,
      reason,
    });
    if (existing && reason.trim().length < 5) {
      setInvalid(["reason"]);
      setError(new Error(t("Nhập lý do chỉnh sửa đánh giá.")));
      requestAnimationFrame(() =>
        form.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus(),
      );
      return;
    }
    if (!parsed.success) {
      setInvalid(parsed.error.issues.map((i) => i.path.slice(1).join(".")));
      setError(new Error(t("Hoàn tất kết quả và minh chứng trước khi gửi.")));
      requestAnimationFrame(() =>
        form.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus(),
      );
      return;
    }
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      await save.mutateAsync({
        path: `/performance/reviews/${item.id}/${phase}`,
        body: parsed.data,
      });
      onClose();
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
      saving.current = false;
    }
  };
  return (
    <form
      ref={form}
      className="performance-form"
      noValidate
      aria-busy={busy}
      onSubmit={(e) => {
        e.preventDefault();
        void send(true);
      }}
    >
      <div className="performance-score-strip">
        <Target size={22} />
        <div>
          <strong>{t("Kết quả tổng hợp")}</strong>
          <small>{t("Mục tiêu 70% · Năng lực 30%")}</small>
        </div>
        <b>{score === null ? "—" : `${score}%`}</b>
      </div>
      <ErrorBox error={error} />
      <fieldset disabled={busy} className="performance-assessment-section">
        <legend>{t("Kết quả mục tiêu")}</legend>
        {item.goals.map((goal, i) => (
          <section className="performance-assessment-goal" key={goal.id}>
            <div className="performance-section-heading">
              <div>
                <h3>{goal.title}</h3>
                {goal.kind === "qualitative" ? (
                  <p className="performance-expectation">{goal.expectation}</p>
                ) : (
                  <small>
                    {t("Mục tiêu: {0} {1} · Trọng số {2}%", [
                      goal.target,
                      goal.unit,
                      goal.weight,
                    ])}
                  </small>
                )}
              </div>
            </div>
            {phase === "manager" && item.selfAssessment && (
              <p className="performance-self-reference">
                {t("Tự đánh giá")}:{" "}
                {
                  item.selfAssessment.data.goals.find(
                    (g) => g.goalId === goal.id,
                  )?.actual
                }{" "}
                {goal.kind !== "qualitative" ? goal.unit : ""} ·{" "}
                {
                  item.selfAssessment.data.goals.find(
                    (g) => g.goalId === goal.id,
                  )?.evidence
                }
              </p>
            )}
            <div className="performance-goal-response">
              <fieldset
                className="performance-outcomes"
                aria-invalid={invalidField(`goals.${i}`)}
              >
                <legend>{t("Mức đáp ứng mục tiêu")} *</legend>
                {draft.goals[i].actual !== null && (
                  <p className="performance-legacy-result">
                    {t("Kết quả đã lưu: {0}", [draft.goals[i].actual])}{" "}
                    {goal.kind !== "qualitative" ? goal.unit : ""}
                  </p>
                )}
                <div>
                  {performanceOutcomes.map((outcome, index) => (
                    <label
                      key={outcome}
                      data-tone={
                        index === 0
                          ? "danger"
                          : index === 1
                            ? "warning"
                            : "success"
                      }
                    >
                      <input
                        type="radio"
                        name={`goal-outcome-${goal.id}`}
                        value={outcome}
                        checked={draft.goals[i].outcome === outcome}
                        aria-invalid={invalidField(`goals.${i}.outcome`)}
                        onChange={() =>
                          setDraft((d) => ({
                            ...d,
                            goals: d.goals.map((g, n) =>
                              n === i ? { ...g, actual: null, outcome } : g,
                            ),
                          }))
                        }
                      />
                      <span>{t(performanceOutcomeLabels[outcome])}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label>
                <span>{t("Nhận xét & dẫn chứng")} *</span>
                <Textarea
                  maxLength={1000}
                  aria-invalid={invalidField(`goals.${i}.evidence`)}
                  value={draft.goals[i].evidence}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      goals: d.goals.map((g, n) =>
                        n === i ? { ...g, evidence: e.target.value } : g,
                      ),
                    }))
                  }
                />
              </label>
            </div>
          </section>
        ))}
      </fieldset>
      <fieldset disabled={busy} className="performance-assessment-section">
        <legend>{t("Năng lực làm việc")}</legend>
        {performanceCompetencies.map((c, i) => (
          <div className="performance-competency" key={c.id}>
            <label>
              <span>{t(c.label)} *</span>
              <Select
                aria-invalid={invalidField(`competencies.${i}.rating`)}
                value={
                  draft.competencies[i].rating
                    ? String(draft.competencies[i].rating)
                    : ""
                }
                options={[
                  { value: "", label: t("Chọn mức đánh giá"), disabled: true },
                  ...performanceLevels.map((l, n) => ({
                    value: String(n + 1),
                    label: t(l),
                  })),
                ]}
                onValueChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    competencies: d.competencies.map((x, n) =>
                      n === i ? { ...x, rating: Number(v) } : x,
                    ),
                  }))
                }
              />
            </label>
            <label>
              <span>{t("Minh chứng")} *</span>
              <Textarea
                aria-invalid={invalidField(`competencies.${i}.evidence`)}
                maxLength={1000}
                value={draft.competencies[i].evidence}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    competencies: d.competencies.map((x, n) =>
                      n === i ? { ...x, evidence: e.target.value } : x,
                    ),
                  }))
                }
              />
            </label>
          </div>
        ))}
      </fieldset>
      <fieldset disabled={busy} className="performance-assessment-section">
        <legend>{t("Phát triển sau đánh giá")}</legend>
        {(
          [
            ["strengths", "Điểm mạnh"],
            ["improvements", "Điểm cần cải thiện"],
            ["developmentPlan", "Kế hoạch phát triển"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            <span>{t(label)} *</span>
            <Textarea
              maxLength={1000}
              aria-invalid={invalidField(key)}
              value={draft[key]}
              onChange={(e) =>
                setDraft((d) => ({ ...d, [key]: e.target.value }))
              }
            />
          </label>
        ))}
      </fieldset>
      {existing && (
        <label className="performance-revision-reason">
          <span>{t("Lý do chỉnh sửa")} *</span>
          <Textarea
            value={reason}
            maxLength={1000}
            aria-invalid={invalidField("reason")}
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      )}
      <div className="form-actions">
        <Button
          variant="secondary"
          type="button"
          disabled={busy}
          onClick={() => modal?.requestClose()}
        >
          {t("Hủy")}
        </Button>
        <Button
          variant="secondary"
          type="button"
          busy={busy}
          onClick={() => void send(false)}
        >
          <Save size={16} />
          {t("Lưu nháp")}
        </Button>
        <Button type="submit" busy={busy}>
          <Send size={16} />
          {t("Hoàn tất đánh giá")}
        </Button>
      </div>
    </form>
  );
}
export function PerformanceField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt>{t(label)}</dt>
      <dd>{children}</dd>
    </div>
  );
}
