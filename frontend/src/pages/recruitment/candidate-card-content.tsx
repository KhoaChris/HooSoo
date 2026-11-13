import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  GraduationCap,
  Languages,
  MapPin,
  UserRound,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import {
  workflowLabels,
  type Candidate,
  type RecruitmentJob,
} from "@hoosoo/shared";
import { t } from "../../i18n";
import { dateText } from "../../utils/date-time";
import { dayLabel } from "../workflows/workflow-ui";
import { candidateCardModel, candidateInitials } from "./candidate-card-model";
import { statusTone } from "../../components/ui/status-tone";

export type CandidateDetailTab = "profile" | "rounds";

export function CandidateCardContent({
  candidate: c,
  job,
  dragControl,
  nextStage,
  onMove,
  onOpen,
}: {
  candidate: Candidate;
  job: RecruitmentJob;
  dragControl: ReactNode;
  nextStage?: string;
  onMove: () => void;
  onOpen: (tab?: CandidateDetailTab) => void;
}) {
  const model = candidateCardModel(c, job);
  const { round, kind, score, decision } = model;
  const terminal = kind === "hired" || kind === "rejected";
  const interview = round?.interview;
  const result = terminal ? kind : round?.result;
  const resultText =
    kind === "hired"
      ? decision?.action === "direct_hired"
        ? "Tuyển thẳng"
        : "Trúng tuyển"
      : kind === "rejected"
        ? "Không tiếp tục"
        : round?.result === "passed"
          ? "Đạt yêu cầu"
          : round?.result === "failed"
            ? "Chưa đạt"
            : kind === "decision"
              ? "Chờ quyết định"
              : kind === "interview"
                ? "Chờ đánh giá"
                : "Chờ sơ tuyển";
  const ResultIcon =
    result === "hired" || result === "passed"
      ? CheckCircle2
      : result === "rejected" || result === "failed"
        ? XCircle
        : Clock3;
  const actionText = nextStage
    ? "Chuyển vòng"
    : terminal
      ? "Xem hồ sơ"
      : round?.result === "failed"
        ? "Xem đánh giá"
        : kind === "interview"
          ? "Lịch & đánh giá"
          : kind === "decision"
            ? "Xem quyết định"
            : "Xem hồ sơ";
  const source = workflowLabels[c.source] ?? "Ứng tuyển";

  return (
    <>
      <div className="candidate-card-top">
        <button
          type="button"
          className="candidate-open"
          onClick={() => onOpen("profile")}
          aria-label={t("Xem hồ sơ {0}", [c.name])}
        >
          <span className="candidate-initial" aria-hidden="true">
            {candidateInitials(c.name)}
          </span>
          <span className="candidate-identity">
            <strong title={c.name}>{c.name}</strong>
            <span title={c.email}>{c.email}</span>
          </span>
        </button>
        {dragControl}
      </div>
      <div
        className={`candidate-stage-status status-tone ${result ?? "pending"}`}
        data-tone={statusTone(result ?? "pending")}
      >
        <ResultIcon size={14} aria-hidden="true" />
        <span>{t(resultText)}</span>
        {score !== null && !terminal && kind !== "screening" && (
          <span
            className="candidate-score-number"
            aria-label={
              round?.assessment
                ? t("Mức độ phù hợp: {0}%", [round.assessment.totalPercent])
                : t("Điểm đánh giá: {0} trên 5", [score])
            }
          >
            {round?.assessment ? (
              `${round.assessment.totalPercent}%`
            ) : (
              <>
                {score}
                <small>/5</small>
              </>
            )}
          </span>
        )}
      </div>
      {kind === "screening" && <CandidateMatchBar match={model.match} />}

      <div className={`candidate-stage-content candidate-stage-${kind}`}>
        {kind === "screening" && (
          <>
            <dl className="candidate-facts">
              <CardFact
                icon={<GraduationCap size={15} />}
                label="Học vấn"
                value={c.education}
              />
              <CardFact
                icon={<Languages size={15} />}
                label="Tiếng Anh"
                value={model.english}
              />
            </dl>
            {model.skills.length > 0 && (
              <div className="candidate-skills" aria-label={t("Kỹ năng")}>
                {model.skills.slice(0, 2).map((skill, index) => (
                  <span key={`${skill}-${index}`} title={skill}>
                    {skill}
                  </span>
                ))}
                {model.skills.length > 2 && (
                  <span title={model.skills.slice(2).join(", ")}>
                    +{model.skills.length - 2}
                  </span>
                )}
              </div>
            )}
          </>
        )}

        {kind === "interview" && (
          <>
            {interview ? (
              <>
                <div className="candidate-interview-date">
                  <CalendarDays size={17} aria-hidden="true" />
                  <div>
                    <strong>{dayLabel(interview.date)}</strong>
                    <span>
                      {interview.start} – {interview.end}
                    </span>
                  </div>
                  <span
                    className={`candidate-schedule-status ${interview.status}`}
                  >
                    {t(
                      interview.status === "confirmed"
                        ? "Đã xác nhận"
                        : "Chờ duyệt",
                    )}
                  </span>
                </div>
                <dl className="candidate-facts candidate-interview-facts">
                  <CardFact
                    icon={<UserRound size={14} />}
                    label="Người phỏng vấn"
                    value={interview.interviewerName}
                  />
                  {interview.location && (
                    <CardFact
                      icon={<MapPin size={14} />}
                      label="Địa điểm"
                      value={interview.location}
                    />
                  )}
                </dl>
              </>
            ) : (
              <div className="candidate-no-interview">
                <CalendarDays size={18} aria-hidden="true" />
                <span>{t("Chưa có lịch phỏng vấn")}</span>
              </div>
            )}
            {round?.feedback && (
              <p className="candidate-feedback" title={round.feedback}>
                {round.feedback}
              </p>
            )}
          </>
        )}

        {kind === "decision" && (
          <>
            <div className="candidate-review-heading">
              <span>{t("Kết quả các vòng")}</span>
              <strong>
                {t("{0}/{1} đạt", [
                  model.previousStages.filter((s) => s.result === "passed")
                    .length,
                  model.previousStages.length,
                ])}
              </strong>
            </div>
            <ul className="candidate-round-checklist">
              {model.previousStages.slice(-3).map((stage) => (
                <li key={stage.id} className={stage.result ?? "pending"}>
                  {stage.result === "passed" ? (
                    <Check size={14} />
                  ) : stage.result === "failed" ? (
                    <XCircle size={14} />
                  ) : (
                    <Circle size={12} />
                  )}
                  <span title={stage.name}>{stage.name}</span>
                  <small>
                    {t(
                      stage.result === "passed"
                        ? "Đạt"
                        : stage.result === "failed"
                          ? "Chưa đạt"
                          : "Chưa đánh giá",
                    )}
                  </small>
                </li>
              ))}
            </ul>
            {model.previousStages.length > 3 && (
              <span className="candidate-extra-rounds">
                {t("+{0} vòng trước", [model.previousStages.length - 3])}
              </span>
            )}
            {round?.feedback && (
              <p className="candidate-feedback" title={round.feedback}>
                {round.feedback}
              </p>
            )}
          </>
        )}

        {terminal && (
          <>
            {decision ? (
              <>
                <dl className="candidate-facts candidate-decision-facts">
                  <CardFact
                    icon={<CalendarDays size={14} />}
                    label="Ngày quyết định"
                    value={dateText(decision.at)}
                  />
                  <CardFact
                    icon={<UserRound size={14} />}
                    label="Người quyết định"
                    value={decision.name}
                  />
                </dl>
                {decision.reason && (
                  <p className="candidate-feedback" title={decision.reason}>
                    {decision.reason}
                  </p>
                )}
              </>
            ) : (
              <p className="candidate-missing-decision">
                {t("Chưa có thông tin quyết định")}
              </p>
            )}
            {kind === "hired" && c.employeeId && (
              <div className="candidate-employee-linked">
                <UserRoundCheck size={15} aria-hidden="true" />
                {t("Đã tạo hồ sơ nhân viên")}
              </div>
            )}
          </>
        )}
      </div>
      <div className="candidate-card-footer">
        <span className="candidate-source" title={t(source)}>
          {t(source)}
        </span>
        <button
          type="button"
          className="candidate-card-action"
          title={nextStage ? t("Chuyển đến {0}", [nextStage]) : undefined}
          onClick={() =>
            nextStage
              ? onMove()
              : onOpen(
                  !terminal &&
                    (kind !== "screening" || round?.result === "failed")
                    ? "rounds"
                    : "profile",
                )
          }
        >
          {t(actionText)}
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </>
  );
}

function CandidateMatchBar({
  match,
}: {
  match: ReturnType<typeof candidateCardModel>["match"];
}) {
  const description = match
    ? "criterionCount" in match
      ? t("Tổng hợp {0} tiêu chí sơ tuyển: {1}%.", [
          match.criterionCount,
          match.percent,
        ])
      : t("Điểm sơ tuyển {0}/5, quy đổi thành {1}%.", [
          match.score,
          match.percent,
        ])
    : t("Chưa có điểm sơ tuyển.");
  return (
    <div
      className={`candidate-match ${match ? "" : "is-unrated"}`}
      title={description}
    >
      <div className="candidate-match-heading">
        <span className="candidate-match-label">
          <span>{t("Độ tương thích")}</span>
          {match && (
            <span className="candidate-match-source">· {t("Sơ tuyển")}</span>
          )}
        </span>
        <strong>{match ? `${match.percent}%` : t("Chưa đánh giá")}</strong>
      </div>
      {match ? (
        <div
          className="candidate-match-track"
          role="meter"
          aria-label={t("Độ tương thích theo đánh giá sơ tuyển")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={match.percent}
          aria-valuetext={description}
        >
          <span style={{ width: `${match.percent}%` }} />
        </div>
      ) : (
        <div className="candidate-match-track" aria-hidden="true" />
      )}
    </div>
  );
}

function CardFact({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <dt title={t(label)}>
        {icon}
        <span className="candidate-fact-label">{t(label)}</span>
      </dt>
      <dd title={value || undefined} className={value ? "" : "is-missing"}>
        {value || t("Chưa cập nhật")}
      </dd>
    </div>
  );
}
