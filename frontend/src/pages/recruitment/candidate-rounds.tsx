import {
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  UserRound,
  X,
} from "lucide-react";
import type { Candidate, RecruitmentJob } from "@hoosoo/shared";
import { t } from "../../i18n";
import { dayLabel } from "../workflows/workflow-ui";
import { EvaluationResult } from "./candidate-evaluation";

export function CandidateRounds({
  candidate,
  job,
}: {
  candidate: Candidate;
  job: RecruitmentJob;
}) {
  const currentIndex = job.stages.findIndex(
    (stage) => stage.id === candidate.stageId,
  );
  const stages: { id: string; name: string; kind?: string }[] = [
    ...job.stages,
    ...candidate.rounds
      .filter(
        (round) => !job.stages.some((stage) => stage.id === round.stageId),
      )
      .map((round) => ({ id: round.stageId, name: round.stageName })),
  ];
  return (
    <>
      <div className="candidate-panel-heading">
        <h3>{t("Phỏng vấn & đánh giá")}</h3>
      </div>
      <ol className="candidate-detail-stage-list">
        {stages.map((stage, index) => {
          const round = candidate.rounds.find((r) => r.stageId === stage.id);
          const current =
            candidate.status === "active" && candidate.stageId === stage.id;
          const stopped = candidate.status !== "active" && !round;
          const state = round?.result || (current ? "current" : "waiting");
          return (
            <li
              key={stage.id}
              className={`candidate-detail-stage is-${state}`}
              aria-current={current ? "step" : undefined}
            >
              <span
                className="candidate-detail-stage-marker"
                aria-hidden="true"
              >
                {round?.result === "passed" ? (
                  <Check size={15} />
                ) : round?.result === "failed" ? (
                  <X size={15} />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              <div className="candidate-detail-stage-content">
                <header>
                  <h4>{stage.name}</h4>
                  <span className={`candidate-detail-stage-status is-${state}`}>
                    {t(
                      round?.result === "passed"
                        ? "Đạt yêu cầu"
                        : round?.result === "failed"
                          ? "Chưa đạt"
                          : current
                            ? "Vòng hiện tại"
                            : stopped
                              ? "Không thực hiện"
                              : round || index < currentIndex
                                ? "Chưa đánh giá"
                                : "Chưa đến vòng",
                    )}
                  </span>
                </header>
                {round?.interview && (
                  <div className="candidate-interview-info">
                    <div>
                      <CalendarDays size={15} />
                      <strong>{dayLabel(round.interview.date)}</strong>
                      <span>
                        {round.interview.start} – {round.interview.end}
                      </span>
                    </div>
                    <div>
                      <MapPin size={15} />
                      <span>{round.interview.location}</span>
                    </div>
                    <div>
                      <UserRound size={15} />
                      <span>{round.interview.interviewerName}</span>
                    </div>
                    <div
                      className={`candidate-interview-confirmation ${round.interview.status}`}
                    >
                      <Clock3 size={14} />
                      <span>
                        {t(
                          round.interview.status === "confirmed"
                            ? "Đã duyệt lịch"
                            : "Chờ duyệt lịch",
                        )}
                      </span>
                    </div>
                  </div>
                )}
                {current && !round?.interview && stage.kind === "interview" && (
                  <p className="candidate-detail-stage-empty">
                    {t("Chưa đặt lịch phỏng vấn")}
                  </p>
                )}
                {round?.result && (
                  <details
                    className="candidate-detail-stage-evaluation"
                    open={current || undefined}
                  >
                    <summary>
                      {t("Xem đánh giá")}
                      <span>
                        {round.assessment
                          ? `${round.assessment.totalPercent}%`
                          : round.score !== undefined
                            ? `${round.score}/5`
                            : ""}
                      </span>
                    </summary>
                    <EvaluationResult round={round} />
                  </details>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
