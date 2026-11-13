import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, GripVertical, LockKeyhole, Eye, Ban } from "lucide-react";
import type { Candidate, RecruitmentJob } from "@hoosoo/shared";
import { t } from "../../i18n";
import {
  dismissWarningToast,
  showToast,
} from "../../components/ui/toast-events";
import {
  CandidateCardContent,
  type CandidateDetailTab,
} from "./candidate-card-content";
import { candidateInitials as initials } from "./candidate-card-model";
import {
  candidateMovement,
  canDropCandidate,
  candidateDropReason,
} from "./candidate-movement";
import { useCandidateDrag } from "./use-candidate-drag";

export function RecruitmentBoard({
  job,
  candidates,
  canManage,
  onOpen,
  onMove,
}: {
  job: RecruitmentJob;
  candidates: Candidate[];
  canManage: boolean;
  onOpen: (id: string, tab?: CandidateDetailTab) => void;
  onMove: (candidate: Candidate, targetId: string) => void;
}) {
  const [notice, setNotice] = useState("");
  const warned = useRef(new Set<string>());
  const warn = useCallback((key: string, message: string) => {
    setNotice(message);
    if (warned.current.has(key)) return;
    warned.current.add(key);
    showToast(message, "warning");
  }, []);
  const dnd = useCandidateDrag({
    onLift: (id, version) => {
      warned.current.clear();
      const candidate = candidates.find((c) => c.id === id);
      const reason =
        !candidate || candidate.version !== version
          ? "Hồ sơ vừa thay đổi. Vui lòng kiểm tra lại."
          : candidateMovement(candidate, job, canManage).reason;
      if (reason) {
        warn("lift", reason);
        return false;
      }
      dismissWarningToast();
      setNotice("");
      return true;
    },
    onCancel: () => {
      dismissWarningToast();
      setNotice("Đã hủy kéo thả.");
    },
    onDrop: (drag) => {
      const candidate = candidates.find((c) => c.id === drag.id);
      if (!candidate || candidate.version !== drag.version) {
        warn("stale", "Hồ sơ vừa thay đổi. Vui lòng kiểm tra lại.");
      } else if (
        drag.target &&
        canDropCandidate(candidate, job, drag.target, canManage)
      ) {
        dismissWarningToast();
        setNotice("");
        onMove(candidate, drag.target);
      } else if (drag.target === candidate.stageId) setNotice("");
      else
        warn(
          `target:${drag.target}`,
          candidateDropReason(candidate, job, drag.target, canManage),
        );
    },
  });
  const dragged = candidates.find((c) => c.id === dnd.drag?.id);
  const movement = dragged
    ? candidateMovement(dragged, job, canManage)
    : undefined;
  const nextName = movement?.next?.name ?? "";
  const sourceName =
    job.stages.find((s) => s.id === dragged?.stageId)?.name ?? "";
  const dropReason =
    dragged && dnd.drag
      ? candidateDropReason(dragged, job, dnd.drag.target, canManage)
      : "";
  const hoverTarget = dnd.drag?.target;
  useEffect(() => {
    if (!hoverTarget || !dropReason) return;
    const timer = window.setTimeout(
      () => warn(`target:${hoverTarget}`, dropReason),
      300,
    );
    return () => clearTimeout(timer);
  }, [hoverTarget, dropReason, warn]);
  const stale =
    !!dnd.drag &&
    (!dragged || dragged.version !== dnd.drag.version || !movement?.allowed);
  useEffect(() => {
    if (stale) {
      dnd.cancel();
      warn("stale", "Hồ sơ vừa thay đổi. Vui lòng kiểm tra lại.");
    }
  }, [stale]); // Cancel when a live update invalidates the held card.
  return (
    <>
      <div className="kanban-feedback" role="status" aria-live="polite">
        {dnd.drag
          ? dnd.drag.keyboard
            ? t("{0}: nhấn → để chọn vòng kế tiếp, Enter để thả, Esc để hủy.", [
                dragged?.name ?? "",
              ])
            : dropReason
              ? t(dropReason)
              : t("Thả vào {0} để xác nhận chuyển vòng.", [nextName])
          : t(notice)}
      </div>
      <div
        className={`kanban-scroll ${dnd.drag ? "has-drag" : ""}`}
        ref={dnd.board}
        aria-label={t("Quy trình tuyển dụng")}
      >
        <div className="kanban-board">
          {[
            ...job.stages.map((s, i) => ({ ...s, step: i + 1 })),
            { id: "hired", name: t("Trúng tuyển"), kind: "terminal", step: 0 },
            {
              id: "rejected",
              name: t("Không tiếp tục"),
              kind: "terminal",
              step: 0,
            },
          ].map((stage) => {
            const items = candidates.filter((c) =>
              stage.kind === "terminal"
                ? c.status === stage.id
                : c.status === "active" && c.stageId === stage.id,
            );
            const allowed =
              !!dragged && canDropCandidate(dragged, job, stage.id, canManage);
            const over = dnd.drag?.target === stage.id;
            return (
              <section
                key={stage.id}
                data-stage-id={stage.id}
                aria-label={stage.name}
                className={`kanban-column ${allowed ? "can-drop" : ""} ${over && allowed ? "is-over" : ""} ${over && !allowed && stage.id !== dragged?.stageId ? "drop-blocked" : ""}`}
              >
                <header>
                  <div>
                    {stage.step > 0 ? (
                      <span className="kanban-step">
                        {String(stage.step).padStart(2, "0")}
                      </span>
                    ) : (
                      <span
                        className={`kanban-terminal terminal-${stage.id}`}
                      />
                    )}
                    <h3>{stage.name}</h3>
                  </div>
                  <span className="kanban-count">{items.length}</span>
                </header>
                <div className="kanban-cards">
                  {allowed && dragged && (
                    <div
                      className={`kanban-drop-slot ${over ? "is-over" : ""}`}
                      aria-hidden="true"
                    >
                      <span className="kanban-ghost-label">
                        <Eye size={15} />
                        {t("Xem trước")}
                      </span>
                      <div className="kanban-ghost-person">
                        <span className="candidate-initial">
                          {initials(dragged.name)}
                        </span>
                        <div>
                          <strong>{dragged.name}</strong>
                          <span>{dragged.email}</span>
                        </div>
                      </div>
                      <div className="kanban-ghost-route">
                        <span>{sourceName}</span>
                        <ArrowRight size={14} />
                        <strong>{stage.name}</strong>
                      </div>
                      <span className="kanban-ghost-hint">
                        {t(over ? "Thả để mở xác nhận" : "Kéo đến đây")}
                      </span>
                    </div>
                  )}
                  {items.map((c) => {
                    const move = candidateMovement(c, job, canManage);
                    return (
                      <article
                        key={c.id}
                        data-candidate-id={c.id}
                        className={`candidate-card card-${c.status === "active" ? (c.rounds.find((r) => r.stageId === c.stageId)?.result ?? "pending") : c.status} ${move.allowed ? "is-draggable" : ""} ${dnd.drag?.id === c.id ? "is-dragging" : ""}`}
                        onPointerDown={(e) => {
                          setNotice("");
                          dnd.start(e, c.id, c.version);
                        }}
                        onDragStart={(e) => e.preventDefault()}
                        onClickCapture={(e) => {
                          if (dnd.consumeClick()) {
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        }}
                      >
                        <CandidateCardContent
                          candidate={c}
                          job={job}
                          nextStage={move.allowed ? move.next?.name : undefined}
                          onMove={() => onMove(c, move.next!.id)}
                          onOpen={(tab) => onOpen(c.id, tab)}
                          dragControl={
                            move.allowed ? (
                              <button
                                type="button"
                                className="candidate-drag-handle"
                                aria-label={t("Kéo {0} sang vòng tiếp theo", [
                                  c.name,
                                ])}
                                title={t(
                                  "Nhấn giữ để kéo · Enter để dùng bàn phím",
                                )}
                                aria-pressed={dnd.drag?.id === c.id}
                                onKeyDown={(e) => {
                                  if (
                                    [
                                      " ",
                                      "Enter",
                                      "ArrowRight",
                                      "ArrowLeft",
                                      "Escape",
                                    ].includes(e.key)
                                  ) {
                                    e.preventDefault();
                                    dnd.keyboard(
                                      c.id,
                                      c.version,
                                      e.key,
                                      move.next!.id,
                                      e.currentTarget,
                                    );
                                  }
                                }}
                                onBlur={() => {
                                  if (dnd.drag?.keyboard) dnd.cancel();
                                }}
                              >
                                <GripVertical size={18} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="candidate-drag-lock"
                                aria-label={t(move.reason)}
                                title={t(move.reason)}
                                onClick={() => {
                                  warned.current.clear();
                                  warn("lift", move.reason);
                                }}
                              >
                                <LockKeyhole size={15} />
                              </button>
                            )
                          }
                        />
                      </article>
                    );
                  })}
                  {!items.length && !allowed && (
                    <div className="kanban-empty">{t("Chưa có ứng viên")}</div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      {dnd.drag &&
        !dnd.drag.keyboard &&
        dragged &&
        createPortal(
          <div
            className={`candidate-drag-preview ${dropReason ? "is-blocked" : ""}`}
            aria-hidden="true"
            style={{
              left: Math.max(
                12,
                Math.min(
                  dnd.drag.x + 14,
                  window.innerWidth - Math.min(dnd.drag.width, 280) - 12,
                ),
              ),
              top: Math.max(
                12,
                Math.min(dnd.drag.y + 14, window.innerHeight - 120),
              ),
              width: Math.min(dnd.drag.width, 280),
              maxWidth: "calc(100vw - 28px)",
            }}
          >
            {dropReason ? <Ban size={18} /> : <GripVertical size={18} />}
            <div>
              <strong>{dragged.name}</strong>
              <span>
                {dropReason ? t(dropReason) : t("Chuyển đến {0}", [nextName])}
              </span>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
