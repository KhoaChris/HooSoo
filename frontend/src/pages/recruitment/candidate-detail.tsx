import { useId, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  History,
  UserRound,
} from "lucide-react";
import type { Candidate, RecruitmentJob } from "@hoosoo/shared";
import { Button, Modal } from "../../components/ui";
import { SectionTabs, SectionTabPanel } from "../../components/ui/section-tabs";
import { Avatar } from "../../components/ui/avatar";
import { t, useLocale } from "../../i18n";
import { WorkflowHistory } from "../workflows/workflow-ui";
import { CandidateCV } from "./candidate-cv";
import { CandidateProfile } from "./candidate-profile";
import { CandidateRounds } from "./candidate-rounds";

export type CandidateAction =
  | "evaluate"
  | "move"
  | "interview"
  | "confirm-interview"
  | "hire"
  | "reject"
  | "direct-hire"
  | "employee";
const tabs = [
  { value: "profile", label: "Hồ sơ", Icon: UserRound },
  { value: "cv", label: "CV gốc", Icon: FileText },
  { value: "rounds", label: "Phỏng vấn", Icon: ClipboardCheck },
  { value: "history", label: "Lịch sử", Icon: History },
] as const;
type CandidateTab = (typeof tabs)[number]["value"];

export function CandidateDetail({
  initialTab = "profile",
  candidate: c,
  job,
  hr,
  onClose,
  onEdit,
  onAction,
}: {
  candidate: Candidate;
  initialTab?: "profile" | "rounds";
  job: RecruitmentJob;
  hr: boolean;
  onClose: () => void;
  onEdit: () => void;
  onAction: (a: CandidateAction) => void;
}) {
  useLocale();
  const [tab, setTab] = useState<CandidateTab>(initialTab);
  const [cvPending, setCvPending] = useState(false);
  const id = useId();
  const round = c.rounds.find((r) => r.stageId === c.stageId);
  const stageIndex = job.stages.findIndex((s) => s.id === c.stageId);
  const stage = job.stages[stageIndex];
  const next = job.stages[stageIndex + 1];
  return (
    <Modal
      title={c.name}
      description={job.title}
      icon={<Avatar name={c.name} className="candidate-detail-avatar" />}
      size="wide"
      className="candidate-detail-modal"
      onClose={onClose}
    >
      <div className="candidate-detail-context">
        <span className={`candidate-detail-status is-${c.status}`}>
          <span aria-hidden="true" />
          {c.status === "active"
            ? stage?.name || t("Đang tuyển dụng")
            : t(c.status === "hired" ? "Trúng tuyển" : "Không tiếp tục")}
        </span>
        {c.status === "active" && stage && (
          <span className="candidate-detail-stage-count">
            {t("Vòng")} {stageIndex + 1} / {job.stages.length}
          </span>
        )}
        {c.status === "hired" &&
          (c.employeeId ? (
            <Link
              className="candidate-employee-link"
              to={"/employees/" + c.employeeId}
            >
              {t("Xem hồ sơ nhân viên")}
              <ArrowRight size={14} />
            </Link>
          ) : (
            hr && (
              <Button variant="ghost" onClick={() => onAction("employee")}>
                {t("Tạo hồ sơ nhân viên")}
                <ArrowRight size={14} />
              </Button>
            )
          ))}
      </div>
      <div className="candidate-detail-navigation">
        <SectionTabs
          id={id}
          label={t("Thông tin ứng viên")}
          items={tabs.map(({ value, label, Icon }) => ({
            value,
            label: t(label),
            icon: <Icon size={16} />,
            disabled: cvPending && tab !== value,
          }))}
          value={tab}
          onChange={setTab}
        />
      </div>
      {tabs.map(({ value }) => (
        <SectionTabPanel
          key={value}
          id={id}
          value={value}
          active={tab}
          className="candidate-detail-panel"
        >
          <div className="candidate-panel-content" key={tab}>
            {tab === "profile" && (
              <CandidateProfile candidate={c} editable={hr} onEdit={onEdit} />
            )}
            {tab === "cv" && (
              <>
                <div className="candidate-panel-heading">
                  <h3>{t("CV gốc")}</h3>
                  <span>{t("Tệp đính kèm")}</span>
                </div>
                <CandidateCV
                  candidate={c}
                  editable={hr}
                  onPendingChange={setCvPending}
                />
              </>
            )}
            {tab === "rounds" && <CandidateRounds candidate={c} job={job} />}
            {tab === "history" && (
              <>
                <div className="candidate-panel-heading">
                  <h3>{t("Lịch sử hoạt động")}</h3>
                </div>
                {c.history.length ? (
                  <WorkflowHistory history={c.history} />
                ) : (
                  <div className="candidate-detail-empty">
                    <History size={28} aria-hidden="true" />
                    <p>{t("Chưa có hoạt động")}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </SectionTabPanel>
      ))}
      {c.status === "active" &&
        job.active &&
        stage &&
        round &&
        tab !== "cv" && (
          <footer className="candidate-detail-actions">
            <div className="candidate-secondary-actions">
              {hr && (
                <Button
                  variant="ghost"
                  tone="danger"
                  onClick={() => onAction("reject")}
                >
                  {t("Không tiếp tục")}
                </Button>
              )}
              {hr && stage.kind !== "decision" && (
                <Button
                  variant="ghost"
                  tone="success"
                  onClick={() => onAction("direct-hire")}
                >
                  {t("Tuyển thẳng")}
                </Button>
              )}
            </div>
            <div className="candidate-primary-actions">
              {stage.kind === "interview" && !round.result && (
                <Button
                  variant="secondary"
                  onClick={() => onAction("interview")}
                >
                  <CalendarDays size={15} />
                  {round.interview ? t("Đổi lịch") : t("Đặt lịch")}
                </Button>
              )}
              {hr && round.interview?.status === "proposed" && (
                <Button
                  tone="success"
                  onClick={() => onAction("confirm-interview")}
                >
                  {t("Duyệt lịch phỏng vấn")}
                </Button>
              )}
              {(stage.kind !== "interview" ||
                round.interview?.status === "confirmed") && (
                <Button
                  variant="secondary"
                  onClick={() => onAction("evaluate")}
                >
                  {t("Đánh giá vòng")}
                </Button>
              )}
              {next && round.result === "passed" && (
                <Button tone="success" onClick={() => onAction("move")}>
                  {t("Chuyển vòng")}
                  <ArrowRight size={15} />
                </Button>
              )}
              {hr && stage.kind === "decision" && round.result === "passed" && (
                <Button tone="success" onClick={() => onAction("hire")}>
                  <CheckCircle2 size={15} />
                  {t("Xác nhận trúng tuyển")}
                </Button>
              )}
            </div>
          </footer>
        )}
    </Modal>
  );
}
