import { useState } from "react";
import { FileText, CalendarDays, ArrowRight, CheckCircle2 } from "lucide-react";
import {
  candidateSchema,
  candidateEditSchema,
  evaluationSchema,
  interviewSchema,
  candidateTransitionSchema,
  reviewSchema,
  workflowLabels,
  type Candidate,
  type RecruitmentJob,
  type CandidateInput,
} from "@hoosoo/shared";
import { useAction } from "../../hooks/data";
import { Form, Modal, Button, type FormField } from "../../components/ui";
import { WorkflowHistory, today, dayLabel } from "../workflows/workflow-ui";
import { CandidateCV } from "./candidate-cv";
import type { RecruitmentDirectory } from "./job-editor";
export type CandidateAction =
  | "evaluate"
  | "move"
  | "interview"
  | "confirm-interview"
  | "hire"
  | "reject"
  | "direct-hire";
export function CandidateCreate({
  job,
  sample,
  candidate,
  onClose,
}: {
  job: RecruitmentJob;
  sample: boolean;
  candidate?: Candidate;
  onClose: () => void;
}) {
  const save = useAction();
  const defaults: CandidateInput = {
    jobId: job.id,
    name: sample ? "Nguyễn Minh Anh (mẫu)" : "",
    email: sample ? `candidate-${Date.now()}@example.test` : "",
    phone: sample ? "0900000000" : "",
    address: sample ? "Hồ Chí Minh" : "",
    education: sample
      ? "Cử nhân Quản trị kinh doanh\nĐại học mẫu · 2020–2024"
      : "",
    experience: sample
      ? "Chuyên viên vận hành · Công ty mẫu\nHỗ trợ quy trình và báo cáo nội bộ (2024–2026)."
      : "",
    skills: sample ? "Giao tiếp, phân tích dữ liệu, quản lý thời gian" : "",
    source: sample ? "sample" : "application",
    note: sample ? "Dữ liệu giả lập để trải nghiệm quy trình tuyển dụng." : "",
  };
  const editableDefaults = candidate
    ? Object.fromEntries(
        Object.keys(defaults).map((key) => [
          key,
          candidate[key as keyof Candidate],
        ]),
      )
    : defaults;
  return (
    <Modal
      title={
        candidate
          ? "Chỉnh sửa hồ sơ ứng viên"
          : sample
            ? "Tạo hồ sơ ứng viên mẫu"
            : "Tiếp nhận ứng viên"
      }
      description={`${job.title} · CV gốc có thể đính kèm sau khi lưu hồ sơ.`}
      size="wide"
      icon={<FileText size={22} />}
      onClose={onClose}
    >
      <Form
        schema={candidate ? candidateEditSchema : candidateSchema}
        defaults={{
          ...editableDefaults,
          ...(candidate ? { version: candidate.version } : {}),
        }}
        columns={2}
        fields={[
          { name: "name", label: "Họ và tên", required: true },
          {
            name: "email",
            label: "Email liên hệ",
            type: "email",
            required: true,
          },
          { name: "phone", label: "Số điện thoại", required: true },
          {
            name: "source",
            label: "Nguồn ứng viên",
            type: "select",
            options: ["application", "referral", "sourced", "sample"].map(
              (value) => ({ value, label: workflowLabels[value] }),
            ),
          },
          { name: "address", label: "Địa chỉ / nơi cư trú", span: "full" },
          {
            name: "education",
            label: "Học vấn & bằng cấp",
            type: "textarea",
            required: true,
            span: "full",
            section: "Nội dung hồ sơ",
          },
          {
            name: "experience",
            label: "Kinh nghiệm làm việc",
            type: "textarea",
            required: true,
            span: "full",
          },
          {
            name: "skills",
            label: "Kỹ năng & chứng chỉ",
            type: "textarea",
            span: "full",
          },
          {
            name: "note",
            label: "Ghi chú tiếp nhận",
            type: "textarea",
            span: "full",
          },
        ]}
        submitLabel="Lưu hồ sơ ứng viên"
        onSubmit={async (body) => {
          await save.mutateAsync({
            path: candidate
              ? `/recruitment/candidates/${candidate.id}`
              : "/recruitment/candidates",
            method: candidate ? "PATCH" : "POST",
            body,
          });
          onClose();
        }}
      />
    </Modal>
  );
}
export function CandidateDetail({
  candidate: c,
  job,
  hr,
  onClose,
  onEdit,
  onAction,
}: {
  candidate: Candidate;
  job: RecruitmentJob;
  hr: boolean;
  onClose: () => void;
  onEdit: () => void;
  onAction: (a: CandidateAction) => void;
}) {
  const [tab, setTab] = useState("profile"),
    [cvPending, setCvPending] = useState(false),
    round = c.rounds.find((r) => r.stageId === c.stageId)!,
    stage = job.stages.find((s) => s.id === c.stageId)!,
    next = job.stages[job.stages.findIndex((s) => s.id === c.stageId) + 1];
  return (
    <Modal
      title={c.name}
      description={`${job.title} · ${c.status === "active" ? stage.name : c.status === "hired" ? "Trúng tuyển" : "Không tiếp tục"}`}
      size="wide"
      onClose={onClose}
    >
      <div className="candidate-contact">
        <span>{c.email}</span>
        <span>{c.phone}</span>
        <span>{workflowLabels[c.source]}</span>
      </div>
      <div
        className="tabs candidate-tabs"
        role="tablist"
        aria-label="Thông tin ứng viên"
      >
        {[
          ["profile", "Hồ sơ"],
          ["cv", "CV gốc"],
          ["rounds", "Phỏng vấn & đánh giá"],
          ["history", "Lịch sử"],
        ].map(([value, label]) => (
          <button
            key={value}
            role="tab"
            disabled={cvPending && tab !== value}
            aria-selected={tab === value}
            className={tab === value ? "selected" : ""}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="candidate-tab-panel" role="tabpanel">
        {tab === "profile" && (
          <>
            {hr && (
              <div className="workflow-actions">
                <Button variant="secondary" onClick={onEdit}>
                  Chỉnh sửa hồ sơ
                </Button>
              </div>
            )}
            <dl className="workflow-facts">
              <div>
                <dt>Nơi cư trú</dt>
                <dd>{c.address || "Chưa cung cấp"}</dd>
              </div>
              <div>
                <dt>Ngày tiếp nhận</dt>
                <dd>
                  {c.createdAt
                    ? new Date(c.createdAt).toLocaleDateString("vi-VN")
                    : "—"}
                </dd>
              </div>
            </dl>
            {[
              ["Học vấn & bằng cấp", c.education],
              ["Kinh nghiệm làm việc", c.experience],
              ["Kỹ năng & chứng chỉ", c.skills],
              ["Ghi chú tiếp nhận", c.note],
            ].map(([label, value]) => (
              <section className="candidate-section" key={label}>
                <h3>{label}</h3>
                <p className="workflow-prose">{value || "Chưa cung cấp"}</p>
              </section>
            ))}
          </>
        )}
        {tab === "cv" && (
          <CandidateCV
            candidate={c}
            editable={hr}
            onPendingChange={setCvPending}
          />
        )}
        {tab === "history" && <WorkflowHistory history={c.history} />}
        {tab === "rounds" && (
          <div className="candidate-rounds">
            {c.rounds.map((r, i) => (
              <section key={r.stageId}>
                <span className="round-number">{i + 1}</span>
                <div>
                  <h3>{r.stageName}</h3>
                  {r.interview ? (
                    <>
                      <p>
                        <CalendarDays size={15} />
                        {dayLabel(r.interview.date)} · {r.interview.start} –{" "}
                        {r.interview.end}
                      </p>
                      <p>
                        {r.interview.location} · {r.interview.interviewerName}
                      </p>
                      <small>
                        {r.interview.status === "confirmed"
                          ? "Lịch đã được nhân sự duyệt"
                          : "Lịch đang chờ nhân sự duyệt"}
                      </small>
                    </>
                  ) : (
                    <p>
                      {job.stages.find((s) => s.id === r.stageId)?.kind ===
                      "interview"
                        ? "Chưa đặt lịch phỏng vấn"
                        : "Đánh giá hồ sơ và mức độ phù hợp"}
                    </p>
                  )}
                  {r.result && (
                    <div className={`round-result result-${r.result}`}>
                      <strong>
                        {workflowLabels[r.result]} · {r.score}/5
                      </strong>
                      <p>{r.feedback}</p>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
      {c.status === "active" && job.active && tab !== "cv" && (
        <div className="candidate-actions">
          <div className="row-actions">
            {hr && (
              <Button variant="ghost" onClick={() => onAction("reject")}>
                Không tiếp tục
              </Button>
            )}
            {hr && stage.kind !== "decision" && (
              <Button variant="ghost" onClick={() => onAction("direct-hire")}>
                Tuyển thẳng
              </Button>
            )}
          </div>
          <div className="row-actions">
            {stage.kind === "interview" && !round.result && (
              <Button variant="secondary" onClick={() => onAction("interview")}>
                <CalendarDays size={15} />
                {round.interview ? "Đổi lịch" : "Đặt lịch"}
              </Button>
            )}
            {hr && round.interview?.status === "proposed" && (
              <Button onClick={() => onAction("confirm-interview")}>
                Duyệt lịch phỏng vấn
              </Button>
            )}
            {(stage.kind !== "interview" ||
              round.interview?.status === "confirmed") && (
              <Button variant="secondary" onClick={() => onAction("evaluate")}>
                Đánh giá vòng
              </Button>
            )}
            {next && round.result === "passed" && (
              <Button onClick={() => onAction("move")}>
                Chuyển vòng
                <ArrowRight size={15} />
              </Button>
            )}
            {hr && stage.kind === "decision" && round.result === "passed" && (
              <Button onClick={() => onAction("hire")}>
                <CheckCircle2 size={15} />
                Xác nhận trúng tuyển
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
export function CandidateActionDialog({
  candidate: c,
  job,
  directory,
  action,
  onClose,
}: {
  candidate: Candidate;
  job: RecruitmentJob;
  directory: RecruitmentDirectory;
  action: CandidateAction;
  onClose: () => void;
}) {
  const save = useAction(),
    next = job.stages[job.stages.findIndex((s) => s.id === c.stageId) + 1],
    interview = c.rounds.find((r) => r.stageId === c.stageId)?.interview;
  const title = {
    evaluate: "Đánh giá vòng tuyển dụng",
    move: "Chuyển sang vòng kế tiếp",
    interview: "Đề xuất lịch phỏng vấn",
    "confirm-interview": "Duyệt lịch phỏng vấn",
    hire: "Xác nhận trúng tuyển",
    reject: "Dừng tuyển dụng ứng viên",
    "direct-hire": "Xác nhận tuyển thẳng",
  }[action];
  const schema =
    action === "evaluate"
      ? evaluationSchema
      : action === "interview"
        ? interviewSchema
        : action === "move"
          ? candidateTransitionSchema
          : reviewSchema;
  const fields: FormField[] =
    action === "interview"
      ? [
          {
            name: "date",
            label: "Ngày phỏng vấn",
            type: "date",
            required: true,
          },
          {
            name: "interviewerId",
            label: "Người phỏng vấn",
            type: "select",
            required: true,
            options: directory.reviewers
              .filter((r) => r.hr || r.id === job.hiringManagerId)
              .map((r) => ({ value: r.id, label: r.name })),
          },
          { name: "start", label: "Bắt đầu", type: "time", required: true },
          { name: "end", label: "Kết thúc", type: "time", required: true },
          {
            name: "location",
            label: "Địa điểm / liên kết họp",
            required: true,
            span: "full",
          },
        ]
      : [
          ...(action === "evaluate"
            ? [
                {
                  name: "result",
                  label: "Kết quả",
                  type: "select" as const,
                  options: [
                    { value: "passed", label: "Đạt yêu cầu" },
                    { value: "failed", label: "Chưa đạt" },
                  ],
                },
                {
                  name: "score",
                  label: "Mức độ phù hợp (1–5)",
                  type: "number" as const,
                  required: true,
                },
              ]
            : []),
          {
            name: "reason",
            label:
              action === "evaluate"
                ? "Nhận xét & căn cứ đánh giá"
                : "Lý do / nội dung xác nhận",
            type: "textarea",
            required: true,
            span: "full",
            hint:
              action === "direct-hire"
                ? "Tuyển thẳng bỏ qua các vòng còn lại. Cần ghi rõ căn cứ quyết định; hệ thống lưu lịch sử riêng."
                : action === "hire"
                  ? "Xác nhận kết quả tuyển dụng. Tài khoản và hồ sơ nhân viên được cấp riêng sau khi hoàn tất thủ tục."
                  : undefined,
          },
        ];
  const keys =
    action === "interview"
      ? ["version", "date", "start", "end", "interviewerId", "location"]
      : action === "evaluate"
        ? ["version", "result", "score", "reason"]
        : action === "move"
          ? ["version", "stageId", "reason"]
          : ["version", "reason"];
  const defaults: Record<string, unknown> = {
    version: c.version,
    stageId: next?.id ?? "",
    reason: "",
    result: "passed",
    score: 3,
    date: interview?.date ?? today(),
    start: interview?.start ?? "09:00",
    end: interview?.end ?? "10:00",
    interviewerId: interview?.interviewerId ?? job.hiringManagerId,
    location: interview?.location ?? "",
  };
  return (
    <Modal
      title={title}
      description={`${c.name}${action === "move" ? ` → ${next?.name}` : ""}`}
      onClose={onClose}
      size={action === "interview" ? "wide" : "medium"}
    >
      <Form
        schema={schema}
        columns={action === "interview" ? 2 : 1}
        defaults={Object.fromEntries(keys.map((k) => [k, defaults[k]]))}
        fields={fields}
        submitLabel={title}
        onSubmit={async (values) => {
          const keys =
            action === "interview"
              ? ["version", "date", "start", "end", "interviewerId", "location"]
              : action === "evaluate"
                ? ["version", "result", "score", "reason"]
                : action === "move"
                  ? ["version", "stageId", "reason"]
                  : ["version", "reason"];
          await save.mutateAsync({
            path: `/recruitment/candidates/${c.id}/${action}`,
            body: Object.fromEntries(keys.map((k) => [k, values[k]])),
          });
          onClose();
        }}
      />
    </Modal>
  );
}
