import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  XCircle,
} from "lucide-react";
import {
  observationLabels,
  interviewQuestionPrompts,
  assessmentCriteria,
  assessmentLevels,
  assessmentRatingPercent,
  evaluationSchema,
  type Candidate,
  type CandidateRound,
  type RecruitmentJob,
  type RecruitmentAssessment,
} from "@hoosoo/shared";
import {
  Button,
  ErrorBox,
  Input,
  Modal,
  Select,
  Textarea,
  Radio,
} from "../../components/ui";
import { useModalForm } from "../../components/ui/modal";
import { useAction } from "../../hooks/data";
import { intlLocale, t, useLocale } from "../../i18n";

function observationTitle(kind: string) {
  return kind === "screening"
    ? "Đối chiếu hồ sơ"
    : kind === "decision"
      ? "Căn cứ quyết định"
      : "Ghi nhận phỏng vấn";
}

export function CandidateEvaluationDialog({
  candidate,
  job,
  onClose,
}: {
  candidate: Candidate;
  job: RecruitmentJob;
  onClose: () => void;
}) {
  useLocale();
  const stage = job.stages.find((s) => s.id === candidate.stageId)!;
  return (
    <Modal
      title={t("Phiếu đánh giá ứng viên")}
      description={`${candidate.name} · ${stage.name}`}
      icon={<ClipboardCheck size={22} />}
      size="wide"
      onClose={onClose}
    >
      <EvaluationForm candidate={candidate} job={job} onClose={onClose} />
    </Modal>
  );
}

function EvaluationForm({
  candidate,
  job,
  onClose,
}: {
  candidate: Candidate;
  job: RecruitmentJob;
  onClose: () => void;
}) {
  useLocale();
  const stage = job.stages.find((s) => s.id === candidate.stageId)!;
  const round = candidate.rounds.find((r) => r.stageId === stage.id);
  const existing =
    round?.assessment?.kind === stage.kind ? round.assessment : undefined;
  const criteria = assessmentCriteria[stage.kind];
  const [ratings, setRatings] = useState(() =>
    criteria.map((c) => ({
      criterionId: c.id,
      rating:
        existing?.ratings.find((r) => r.criterionId === c.id)?.rating ?? 0,
      evidence:
        existing?.ratings.find((r) => r.criterionId === c.id)?.evidence ?? "",
    })),
  );
  const [observations, setObservations] = useState(
    existing?.observations ?? [
      { question: "", answer: "", signal: "not_observed" as const },
    ],
  );
  const [followUp, setFollowUp] = useState(existing?.followUp ?? "");
  const [strengths, setStrengths] = useState(existing?.strengths ?? "");
  const [concerns, setConcerns] = useState(existing?.concerns ?? "");
  const [summary, setSummary] = useState(round?.feedback ?? "");
  const [result, setResult] = useState(round?.result ?? "");
  const [expanded, setExpanded] = useState<string[]>(
    ratings.filter((r) => r.evidence).map((r) => r.criterionId),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [invalid, setInvalid] = useState<string[]>([]);
  const modal = useModalForm(),
    report = modal?.setFormStatus;
  const form = useRef<HTMLFormElement>(null),
    submitting = useRef(false);
  const state = JSON.stringify({
    observations,
    followUp,
    ratings,
    strengths,
    concerns,
    summary,
    result,
  });
  const initial = useRef(state);
  const baseVersion = useRef(candidate.version);
  const dirty = state !== initial.current;
  const save = useAction();
  const percent = assessmentRatingPercent(stage.kind, ratings);
  const completed = ratings.filter((r) => r.rating > 0).length;
  useEffect(() => {
    report?.({ dirty, busy });
  }, [report, dirty, busy]);
  useEffect(() => () => report?.({ dirty: false, busy: false }), [report]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  const clearIssue = (field: string) => {
    setInvalid((current) => current.filter((id) => id !== field));
    setError(null);
  };
  const update = (id: string, value: Partial<(typeof ratings)[number]>) => {
    clearIssue(id);
    setRatings((current) =>
      current.map((r) => (r.criterionId === id ? { ...r, ...value } : r)),
    );
  };

  return (
    <form
      ref={form}
      className="evaluation-form"
      noValidate
      aria-busy={busy}
      onSubmit={async (event) => {
        event.preventDefault();
        if (submitting.current) return;
        const fields = [
          ...ratings
            .filter((r) => !r.rating || r.evidence.trim().length < 5)
            .map((r) => r.criterionId),
          ...(!observations.length ||
          observations.some(
            (o) => o.question.trim().length < 5 || o.answer.trim().length < 5,
          )
            ? ["observations"]
            : []),
          ...(strengths.trim().length < 5 ? ["strengths"] : []),
          ...(concerns.trim().length < 5 ? ["concerns"] : []),
          ...(summary.trim().length < 5 ? ["summary"] : []),
          ...(!result ? ["result"] : []),
        ];
        setInvalid(fields);
        if (fields.length) {
          setError(new Error(t("Hoàn tất các mục đánh giá được đánh dấu.")));
          setExpanded(criteria.map((c) => c.id));
          requestAnimationFrame(() =>
            form.current
              ?.querySelector<HTMLElement>('[aria-invalid="true"]')
              ?.focus(),
          );
          return;
        }
        const parsed = evaluationSchema.safeParse({
          version: baseVersion.current,
          result,
          reason: summary,
          assessment: {
            rubricVersion: 2,
            observations,
            followUp,
            kind: stage.kind,
            ratings,
            strengths,
            concerns,
          },
        });
        if (!parsed.success) {
          setError(new Error(t("Kiểm tra lại nội dung phiếu đánh giá.")));
          return;
        }
        submitting.current = true;
        setBusy(true);
        setError(null);
        try {
          await save.mutateAsync({
            path: `/recruitment/candidates/${candidate.id}/evaluate`,
            body: parsed.data,
          });
          onClose();
        } catch (error) {
          setError(error as Error);
        } finally {
          submitting.current = false;
          setBusy(false);
        }
      }}
    >
      <div className="evaluation-overview">
        <div>
          <span>{t("Mức độ phù hợp tổng hợp")}</span>
          <strong>{percent === null ? "—" : `${percent}%`}</strong>
        </div>
        <span className="evaluation-completion">
          <CheckCircle2 size={15} />
          {t("{0}/{1} tiêu chí", [completed, criteria.length])}
        </span>
        <div
          className="evaluation-meter"
          role={percent === null ? undefined : "meter"}
          aria-label={t("Mức độ phù hợp tổng hợp")}
          aria-valuenow={percent ?? undefined}
          aria-valuemin={percent === null ? undefined : 0}
          aria-valuemax={percent === null ? undefined : 100}
        >
          <span style={{ width: `${percent ?? 0}%` }} />
        </div>
      </div>
      <ErrorBox error={error} />
      <fieldset disabled={busy} className="evaluation-criteria">
        <legend>{t("Tiêu chí đánh giá")}</legend>
        {criteria.map((criterion, index) => {
          const rating = ratings[index];
          const open = expanded.includes(criterion.id);
          return (
            <div
              className={`evaluation-criterion ${invalid.includes(criterion.id) ? "is-invalid" : ""}`}
              key={criterion.id}
            >
              <div className="evaluation-criterion-label">
                <label id={`criterion-${criterion.id}`}>
                  {t(criterion.label)}
                  <span>{criterion.weight}%</span>
                </label>
                <small>{t(criterion.detail)}</small>
              </div>
              <Select
                aria-labelledby={`criterion-${criterion.id}`}
                aria-required="true"
                aria-invalid={invalid.includes(criterion.id)}
                value={rating.rating ? String(rating.rating) : ""}
                onValueChange={(value) =>
                  update(criterion.id, { rating: Number(value) })
                }
                options={[
                  { value: "", label: t("Chọn mức đánh giá"), disabled: true },
                  ...assessmentLevels.map((level) => ({
                    value: String(level.value),
                    label: t(level.label),
                  })),
                ]}
              />
              <button
                type="button"
                className="evaluation-evidence-toggle"
                aria-expanded={open}
                aria-controls={`evidence-${criterion.id}`}
                onClick={() =>
                  setExpanded((current) =>
                    open
                      ? current.filter((id) => id !== criterion.id)
                      : [...current, criterion.id],
                  )
                }
              >
                {rating.evidence
                  ? t("Minh chứng đã ghi")
                  : t("Thêm minh chứng")}
                <ChevronDown size={13} />
              </button>
              {open && (
                <Input
                  id={`evidence-${criterion.id}`}
                  className="evaluation-evidence"
                  aria-label={t("Minh chứng: {0}", [t(criterion.label)])}
                  aria-invalid={invalid.includes(criterion.id)}
                  aria-required="true"
                  value={rating.evidence}
                  maxLength={300}
                  placeholder={t("Ví dụ hoặc quan sát cụ thể…")}
                  onChange={(e) =>
                    update(criterion.id, { evidence: e.target.value })
                  }
                />
              )}
            </div>
          );
        })}
      </fieldset>
      <fieldset disabled={busy} className="evaluation-observations">
        <legend>{t(observationTitle(stage.kind))} *</legend>
        {observations.map((o, i) => (
          <div className="evaluation-observation" key={i}>
            <div className="evaluation-observation-heading">
              <strong>
                {t(stage.kind === "interview" ? "Câu hỏi {0}" : "Căn cứ {0}", [
                  i + 1,
                ])}
              </strong>
              <Button
                variant="ghost"
                type="button"
                tone="danger"
                disabled={observations.length === 1}
                aria-label={t(
                  stage.kind === "interview"
                    ? "Xóa câu hỏi {0}"
                    : "Xóa căn cứ {0}",
                  [i + 1],
                )}
                onClick={() =>
                  setObservations((rows) => rows.filter((_, n) => n !== i))
                }
              >
                <Trash2 size={16} />
              </Button>
            </div>
            <label>
              <span>
                {t(
                  stage.kind === "interview"
                    ? "Câu hỏi / tình huống"
                    : "Nội dung cần kiểm tra",
                )}
              </span>
              <Input
                aria-invalid={
                  invalid.includes("observations") &&
                  o.question.trim().length < 5
                }
                value={o.question}
                maxLength={300}
                onChange={(e) => {
                  clearIssue("observations");
                  setObservations((rows) =>
                    rows.map((x, n) =>
                      n === i ? { ...x, question: e.target.value } : x,
                    ),
                  );
                }}
              />
            </label>
            {!o.question && (
              <div className="evaluation-question-suggestions">
                {interviewQuestionPrompts[stage.kind].map((prompt) => (
                  <button
                    type="button"
                    key={prompt}
                    onClick={() =>
                      setObservations((rows) =>
                        rows.map((x, n) =>
                          n === i ? { ...x, question: t(prompt) } : x,
                        ),
                      )
                    }
                  >
                    {t(prompt)}
                  </button>
                ))}
              </div>
            )}
            <label>
              <span>
                {t(
                  stage.kind === "screening"
                    ? "Minh chứng trong hồ sơ"
                    : stage.kind === "decision"
                      ? "Căn cứ tổng hợp"
                      : "Câu trả lời & quan sát",
                )}
              </span>
              <Textarea
                aria-invalid={
                  invalid.includes("observations") && o.answer.trim().length < 5
                }
                value={o.answer}
                maxLength={1500}
                onChange={(e) => {
                  clearIssue("observations");
                  setObservations((rows) =>
                    rows.map((x, n) =>
                      n === i ? { ...x, answer: e.target.value } : x,
                    ),
                  );
                }}
              />
            </label>
            <Select
              aria-label={t("Mức độ minh chứng")}
              value={o.signal}
              options={Object.entries(observationLabels).map(
                ([value, label]) => ({ value, label: t(label) }),
              )}
              onValueChange={(v) =>
                setObservations((rows) =>
                  rows.map((x, n) =>
                    n === i ? { ...x, signal: v as typeof o.signal } : x,
                  ),
                )
              }
            />
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          disabled={observations.length >= 8}
          onClick={() =>
            setObservations((rows) => [
              ...rows,
              { question: "", answer: "", signal: "not_observed" },
            ])
          }
        >
          <Plus size={16} />
          {t(stage.kind === "interview" ? "Thêm câu hỏi" : "Thêm căn cứ")}
        </Button>
        <label>
          <span>{t("Cần xác minh ở vòng tiếp theo")}</span>
          <Textarea
            value={followUp}
            maxLength={1000}
            onChange={(e) => setFollowUp(e.target.value)}
          />
        </label>
      </fieldset>
      <fieldset disabled={busy} className="evaluation-notes">
        <legend>{t("Nhận xét có căn cứ")}</legend>
        <div className="evaluation-note-grid">
          <label>
            <span>{t("Điểm mạnh")} *</span>
            <Textarea
              value={strengths}
              aria-required="true"
              maxLength={1000}
              aria-invalid={invalid.includes("strengths")}
              onChange={(e) => {
                clearIssue("strengths");
                setStrengths(e.target.value);
              }}
              placeholder={t("Năng lực hoặc kết quả nổi bật…")}
            />
          </label>
          <label>
            <span>{t("Điểm cần làm rõ / cải thiện")} *</span>
            <Textarea
              value={concerns}
              aria-required="true"
              maxLength={1000}
              aria-invalid={invalid.includes("concerns")}
              onChange={(e) => {
                clearIssue("concerns");
                setConcerns(e.target.value);
              }}
              placeholder={t("Khoảng trống năng lực hoặc chưa ghi nhận…")}
            />
          </label>
        </div>
        <label className="evaluation-summary">
          <span>{t("Kết luận đánh giá")} *</span>
          <Textarea
            value={summary}
            aria-required="true"
            maxLength={1000}
            aria-invalid={invalid.includes("summary")}
            onChange={(e) => {
              clearIssue("summary");
              setSummary(e.target.value);
            }}
            placeholder={t("Căn cứ cho quyết định của bạn…")}
          />
        </label>
      </fieldset>
      <fieldset disabled={busy} className="evaluation-outcome">
        <legend>{t("Kết quả vòng tuyển dụng")} *</legend>
        {[
          { value: "passed", label: "Đạt yêu cầu", Icon: CheckCircle2 },
          { value: "failed", label: "Chưa đạt", Icon: XCircle },
        ].map(({ value, label, Icon }) => (
          <label
            key={value}
            className={`${value}${result === value ? " is-selected" : ""}`}
          >
            <Radio
              name="evaluation-result"
              required
              value={value}
              checked={result === value}
              aria-invalid={invalid.includes("result")}
              onChange={() => {
                clearIssue("result");
                setResult(value);
              }}
            />
            <Icon size={18} aria-hidden="true" />
            <span>{t(label)}</span>
          </label>
        ))}
      </fieldset>
      <div className="form-actions">
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => modal?.requestClose()}
        >
          {t("Hủy")}
        </Button>
        <Button
          type="submit"
          tone={
            result === "failed"
              ? "danger"
              : result === "passed"
                ? "success"
                : undefined
          }
          busy={busy}
        >
          <ClipboardCheck size={16} />
          {t("Lưu đánh giá")}
        </Button>
      </div>
    </form>
  );
}

export function AssessmentSummary({
  assessment,
}: {
  assessment: RecruitmentAssessment;
}) {
  useLocale();
  return (
    <div className="assessment-saved">
      <dl>
        {assessmentCriteria[assessment.kind].map((c) => {
          const rating = assessment.ratings.find((r) => r.criterionId === c.id);
          return (
            <div key={c.id}>
              <dt>
                {t(c.label)}
                <small>{c.weight}%</small>
              </dt>
              <dd>
                {t(
                  assessmentLevels.find((l) => l.value === rating?.rating)
                    ?.label ?? "Chưa đánh giá",
                )}
              </dd>
              {rating?.evidence && <p>{rating.evidence}</p>}
            </div>
          );
        })}
      </dl>
      {assessment.observations?.length ? (
        <section className="assessment-observations">
          <h4>{t(observationTitle(assessment.kind))}</h4>
          {assessment.observations.map((o, i) => (
            <article key={i}>
              <strong>{o.question}</strong>
              <p>{o.answer}</p>
              <span
                className="badge status-tone"
                data-tone={
                  o.signal === "strong"
                    ? "success"
                    : o.signal === "weak"
                      ? "danger"
                      : o.signal === "not_observed"
                        ? "warning"
                        : "neutral"
                }
              >
                {t(observationLabels[o.signal])}
              </span>
            </article>
          ))}
        </section>
      ) : null}
      {assessment.followUp && (
        <section>
          <h4>{t("Cần xác minh ở vòng tiếp theo")}</h4>
          <p>{assessment.followUp}</p>
        </section>
      )}
      <div className="assessment-saved-notes">
        <section>
          <h4>{t("Điểm mạnh")}</h4>
          <p>{assessment.strengths}</p>
        </section>
        <section>
          <h4>{t("Điểm cần làm rõ / cải thiện")}</h4>
          <p>{assessment.concerns}</p>
        </section>
      </div>
    </div>
  );
}

export function EvaluationResult({ round }: { round: CandidateRound }) {
  useLocale();
  const percent = round.assessment?.totalPercent;
  const ResultIcon = round.result === "passed" ? CheckCircle2 : XCircle;
  return (
    <div className={`round-result evaluation-result result-${round.result}`}>
      <div className="evaluation-result-heading">
        <strong>
          <ResultIcon size={16} aria-hidden="true" />
          {t(round.result === "passed" ? "Đạt yêu cầu" : "Chưa đạt")}
        </strong>
        <span>
          {percent !== undefined ? `${percent}%` : `${round.score}/5`}
        </span>
      </div>
      {round.evaluatedAt && (
        <small className="evaluation-result-date">
          {new Date(round.evaluatedAt).toLocaleString(intlLocale(), {
            timeZone: "Asia/Ho_Chi_Minh",
          })}
        </small>
      )}
      {round.assessment && <AssessmentSummary assessment={round.assessment} />}
      {!!round.evaluationHistory?.length && (
        <details className="evaluation-history">
          <summary>
            {t("Lịch sử đánh giá ({0})", [round.evaluationHistory.length])}
          </summary>
          {[...round.evaluationHistory].reverse().map((revision, i) => (
            <article key={i}>
              <strong>
                {t(revision.result === "passed" ? "Đạt yêu cầu" : "Chưa đạt")} ·{" "}
                {revision.assessment?.totalPercent !== undefined
                  ? `${revision.assessment.totalPercent}%`
                  : `${revision.score}/5`}
              </strong>
              <small>
                {revision.evaluatedAt &&
                  new Date(revision.evaluatedAt).toLocaleString(intlLocale())}
              </small>
              <p>{revision.feedback}</p>
              {revision.assessment && (
                <AssessmentSummary assessment={revision.assessment} />
              )}
            </article>
          ))}
        </details>
      )}
      {round.feedback && (
        <p className="evaluation-result-summary">{round.feedback}</p>
      )}
    </div>
  );
}
