import { StableText } from "../../i18n/stable-text";
import { t, useLocale } from "../../i18n";
import { catalogPath } from "../../services/query-cache";
import { FileText } from "lucide-react";
import {
  candidateSchema,
  candidateHireSchema,
  candidateEditSchema,
  interviewSchema,
  candidateTransitionSchema,
  reviewSchema,
  workflowLabels,
  type Candidate,
  type RecruitmentJob,
  type CandidateInput,
  type Catalog,
  type Page,
} from "@hoosoo/shared";
import { useAction, useApi } from "../../hooks/data";
import {
  Form,
  Modal,
  Loading,
  ErrorBox,
  type FormField,
} from "../../components/ui";
import { today } from "../workflows/workflow-ui";
import type { RecruitmentDirectory } from "./job-editor";
import { candidateMovement } from "./candidate-movement";
import { CandidateEvaluationDialog } from "./candidate-evaluation";
import {
  InterviewLocation,
  interviewLocationDefaults,
  interviewLocationSchema,
} from "./interview-location";
export { CandidateDetail, type CandidateAction } from "./candidate-detail";
import type { CandidateAction } from "./candidate-detail";
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
  useLocale();
  const save = useAction();
  const defaults: CandidateInput = {
    jobId: job.id,
    name: sample ? t("Nguyễn Minh Anh (mẫu)") : "",
    email: sample ? `candidate-${Date.now()}@example.test` : "",
    phone: sample ? "0900000000" : "",
    address: sample ? t("Hồ Chí Minh") : "",
    education: sample
      ? t("Cử nhân Quản trị kinh doanh\nĐại học mẫu · 2020–2024")
      : "",
    experience: sample
      ? t(
          "Chuyên viên vận hành · Công ty mẫu\nHỗ trợ quy trình và báo cáo nội bộ (2024–2026).",
        )
      : "",
    skills: sample ? t("Giao tiếp, phân tích dữ liệu, quản lý thời gian") : "",
    source: sample ? "sample" : "application",
    note: sample
      ? t("Dữ liệu giả lập để trải nghiệm quy trình tuyển dụng.")
      : "",
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
          ? t("Chỉnh sửa hồ sơ ứng viên")
          : sample
            ? t("Tạo hồ sơ ứng viên mẫu")
            : t("Tiếp nhận ứng viên")
      }
      description={job.title}
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
          { name: "name", label: t("Họ và tên"), required: true },
          {
            name: "email",
            label: t("Email liên hệ"),
            type: "email",
            required: true,
          },
          { name: "phone", label: t("Số điện thoại"), required: true },
          {
            name: "source",
            label: t("Nguồn ứng viên"),
            type: "select",
            options: ["application", "referral", "sourced", "sample"].map(
              (value) => ({ value, label: t(workflowLabels[value]) }),
            ),
          },
          { name: "address", label: t("Địa chỉ / nơi cư trú"), span: "full" },
          {
            name: "education",
            label: t("Học vấn & bằng cấp"),
            type: "textarea",
            required: true,
            span: "full",
            section: t("Nội dung hồ sơ"),
          },
          {
            name: "experience",
            label: t("Kinh nghiệm làm việc"),
            type: "textarea",
            required: true,
            span: "full",
          },
          {
            name: "skills",
            label: t("Kỹ năng & chứng chỉ"),
            placeholder: t("React, TypeScript; Tiếng Anh: IELTS 6.5"),
            type: "textarea",
            span: "full",
          },
          {
            name: "note",
            label: t("Ghi chú tiếp nhận"),
            type: "textarea",
            span: "full",
          },
        ]}
        submitLabel={t("Lưu hồ sơ ứng viên")}
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
export function CandidateActionDialog({
  candidate: c,
  job,
  directory,
  action,
  moveTargetId,
  currentCandidate,
  canMove = false,
  interviewLocations = [],
  onClose,
}: {
  candidate: Candidate;
  job: RecruitmentJob;
  directory: RecruitmentDirectory;
  action: CandidateAction;
  moveTargetId?: string;
  currentCandidate?: Candidate;
  canMove?: boolean;
  interviewLocations?: string[];
  onClose: () => void;
}) {
  useLocale();
  const hiring = ["hire", "direct-hire", "employee"].includes(action);
  const positions = useApi<Page<Catalog>>(catalogPath("positions"), hiring);
  const save = useAction(),
    next = job.stages[job.stages.findIndex((s) => s.id === c.stageId) + 1],
    interview = c.rounds.find((r) => r.stageId === c.stageId)?.interview;
  const title = {
    evaluate: t("Đánh giá vòng tuyển dụng"),
    move: t("Chuyển sang vòng kế tiếp"),
    interview: t("Đề xuất lịch phỏng vấn"),
    "confirm-interview": t("Duyệt lịch phỏng vấn"),
    hire: t("Xác nhận trúng tuyển"),
    employee: t("Tạo hồ sơ nhân viên"),
    reject: t("Dừng tuyển dụng ứng viên"),
    "direct-hire": t("Xác nhận tuyển thẳng"),
  }[action];
  if (action === "evaluate")
    return (
      <CandidateEvaluationDialog candidate={c} job={job} onClose={onClose} />
    );
  const schema = hiring
    ? candidateHireSchema
    : action === "interview"
      ? interviewSchema.extend({ location: interviewLocationSchema })
      : action === "move"
        ? candidateTransitionSchema
        : reviewSchema;
  const fields: FormField[] =
    action === "interview"
      ? [
          {
            name: "date",
            label: t("Ngày phỏng vấn"),
            type: "date",
            required: true,
          },
          {
            name: "interviewerId",
            label: t("Người phỏng vấn"),
            type: "select",
            required: true,
            options: directory.reviewers
              .filter((r) => r.hr || r.id === job.hiringManagerId)
              .map((r) => ({ value: r.id, label: r.name })),
          },
          { name: "start", label: t("Bắt đầu"), type: "time", required: true },
          { name: "end", label: t("Kết thúc"), type: "time", required: true },
          {
            name: "location",
            label: t("Địa điểm phỏng vấn"),
            required: true,
            span: "full",
            render: (props) => (
              <InterviewLocation {...props} locations={interviewLocations} />
            ),
          },
        ]
      : [
          ...(hiring
            ? [
                {
                  name: "positionId",
                  label: t("Chức danh nhận việc"),
                  type: "select" as const,
                  required: true,
                  options: [
                    { value: "", label: t("Chọn chức danh") },
                    ...(positions.data?.items
                      .filter((p) => p.active)
                      .map((p) => ({ value: p.id, label: p.name })) ?? []),
                  ],
                },
                {
                  name: "hireDate",
                  label: t("Ngày vào làm"),
                  type: "date" as const,
                  required: true,
                },
                {
                  name: "workEmail",
                  label: t("Email công việc"),
                  type: "email" as const,
                  required: true,
                },
                {
                  name: "employmentStatus",
                  label: t("Trạng thái nhận việc"),
                  type: "select" as const,
                  options: [
                    { value: "probation", label: t("Thử việc") },
                    { value: "active", label: t("Đang làm việc") },
                  ],
                },
              ]
            : []),
          {
            name: "reason",
            label: t("Lý do / nội dung xác nhận"),
            type: "textarea",
            required: true,
            span: "full",
            hint:
              action === "direct-hire"
                ? t("Tuyển thẳng sẽ bỏ qua các vòng còn lại.")
                : action === "hire"
                  ? t("Tạo hồ sơ nhân viên khi xác nhận tuyển dụng.")
                  : undefined,
          },
        ];
  const keys = hiring
    ? [
        "version",
        "reason",
        "positionId",
        "hireDate",
        "workEmail",
        "employmentStatus",
      ]
    : action === "interview"
      ? ["version", "date", "start", "end", "interviewerId", "location"]
      : action === "move"
        ? ["version", "stageId", "reason"]
        : ["version", "reason"];
  const defaults: Record<string, unknown> = {
    version: c.version,
    positionId:
      positions.data?.items.find(
        (p) =>
          p.active &&
          p.name.toLocaleLowerCase("vi") === job.title.toLocaleLowerCase("vi"),
      )?.id ?? "",
    hireDate: today(),
    workEmail: c.email,
    employmentStatus: "probation",
    stageId: moveTargetId ?? next?.id ?? "",
    reason: "",
    date: interview?.date ?? today(),
    start: interview?.start ?? "09:00",
    end: interview?.end ?? "10:00",
    interviewerId: interview?.interviewerId ?? job.hiringManagerId,
    location: interviewLocationDefaults(interview?.location),
  };
  return (
    <Modal
      title={title}
      description={`${c.name}${action === "move" ? ` → ${next?.name}` : ""}`}
      onClose={onClose}
      size={action === "interview" || hiring ? "wide" : "medium"}
    >
      {hiring && (
        <p className="workflow-notice">
          <StableText>{t("Phòng ban:")}</StableText>{" "}
          {directory.departments.find((d) => d.id === job.departmentId)?.name ??
            t("Phòng ban tuyển dụng")}{" "}
          <StableText>{t("· Quản lý trực tiếp:")}</StableText>{" "}
          {directory.reviewers.find((r) => r.id === job.hiringManagerId)
            ?.name ?? t("Người phụ trách tuyển dụng")}
        </p>
      )}
      {hiring && positions.isPending ? (
        <Loading />
      ) : hiring && positions.error ? (
        <ErrorBox
          error={positions.error}
          retry={() => void positions.refetch()}
        />
      ) : (
        <Form
          schema={schema}
          columns={action === "interview" || hiring ? 2 : 1}
          defaults={Object.fromEntries(keys.map((k) => [k, defaults[k]]))}
          fields={fields}
          submitLabel={title}
          submitTone={
            action === "reject"
              ? "danger"
              : action === "interview"
                ? undefined
                : "success"
          }
          onSubmit={async (values) => {
            if (action === "move") {
              const movement =
                currentCandidate &&
                candidateMovement(currentCandidate, job, canMove);
              if (
                !currentCandidate ||
                currentCandidate.version !== c.version ||
                currentCandidate.stageId !== c.stageId ||
                !movement?.allowed ||
                movement.next?.id !== values.stageId ||
                values.stageId !== moveTargetId
              )
                throw new Error(
                  t(
                    "Hồ sơ hoặc quy trình vừa thay đổi. Đóng hộp thoại và kiểm tra lại.",
                  ),
                );
            }
            await save.mutateAsync({
              path: `/recruitment/candidates/${c.id}/${action}`,
              body: Object.fromEntries(keys.map((k) => [k, values[k]])),
            });
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
