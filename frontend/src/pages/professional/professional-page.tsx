import { StableText } from "../../i18n/stable-text";
import { t, useLocale } from "../../i18n";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BriefcaseBusiness, Plus, Search, ArrowUpRight } from "lucide-react";
import {
  workItemSchema,
  workActionSchema,
  workKindLabels,
  workStatusLabels,
  workActionLabels,
  labels,
  isSupervisorRole,
  outranks,
  type ProfessionalWorkspace,
  type WorkItemView,
  type WorkAction,
} from "@hoosoo/shared";
import { useAuth } from "../../app/auth";
import { useApi, useAction } from "../../hooks/data";
import { statusTone } from "../../components/ui/status-tone";
import {
  Heading,
  DataTable,
  Button,
  Form,
  Modal,
  Input,
  Select,
  type FormField,
} from "../../components/ui";
import { WorkflowHistory, dayLabel, today } from "../workflows/workflow-ui";
export function ProfessionalPage() {
  useLocale();
  const [searchParams] = useSearchParams();
  const { me } = useAuth(),
    q = useApi<ProfessionalWorkspace>("/professional/workspace"),
    save = useAction();
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [editor, setEditor] = useState<WorkItemView | "new" | null>(null),
    [detailId, setDetailId] = useState<string | null>(() => searchParams.get("item")),
    [decision, setDecision] = useState<{
      item: WorkItemView;
      action: WorkAction;
    } | null>(null);
  const data = q.data,
    detail = data?.items.find((w) => w.id === detailId),
    rows = (data?.items ?? []).filter(
      (w) =>
        (!status || w.status === status) &&
        `${w.title} ${w.project} ${w.assigneeName}`
          .toLocaleLowerCase("vi")
          .includes(search.toLocaleLowerCase("vi")),
    ),
    old = editor && editor !== "new" ? editor : undefined;
  const person = data?.people.find((p) => p.id === me!.actor.employeeId),
    assignee = data?.canAssign
      ? data.people.find(
          (p) =>
            p.id !== me!.actor.employeeId && outranks(me!.actor.role, p.role),
        )
      : person;
  const fields: FormField[] = [
    { name: "title", label: t("Tên công việc"), span: "full", required: true },
    {
      name: "kind",
      label: t("Loại công việc"),
      type: "select",
      options: (data?.kinds ?? []).map((k) => ({
        value: k,
        label: t(workKindLabels[k]),
      })),
    },
    { name: "project", label: t("Dự án / sản phẩm"), required: true },
    {
      name: "departmentId",
      label: t("Phòng ban"),
      type: "select",
      options:
        data?.departments.map((d) => ({ value: d.id, label: d.name })) ?? [],
    },
    {
      name: "assigneeId",
      label: t("Người phụ trách"),
      type: "select",
      options: (data?.people ?? [])
        .filter(
          (p) =>
            (data?.canAssign && outranks(me!.actor.role, p.role)) ||
            p.id === me!.actor.employeeId,
        )
        .map((p) => ({
          value: p.id,
          label: `${p.name} · ${t(labels[p.role])}`,
        })),
    },
    {
      name: "reviewerId",
      label: t("Người rà soát / nghiệm thu"),
      type: "select",
      options: (data?.people ?? [])
        .filter((p) => isSupervisorRole(p.role))
        .map((p) => ({
          value: p.id,
          label: `${p.name} · ${t(labels[p.role])}`,
        })),
    },
    {
      name: "dueDate",
      label: t("Hạn hoàn thành"),
      type: "date",
      required: true,
    },
    {
      name: "priority",
      label: t("Mức ưu tiên"),
      type: "select",
      options: [
        { value: "low", label: t("Thấp") },
        { value: "normal", label: t("Bình thường") },
        { value: "high", label: "Cao" },
      ],
    },
    {
      name: "description",
      label: t("Nội dung / yêu cầu"),
      type: "textarea",
      span: "full",
      required: true,
    },
    {
      name: "criteria",
      label: t("Tiêu chí hoàn thành"),
      type: "textarea",
      span: "full",
      required: true,
    },
  ];
  return (
    <>
      <Heading
        title={t("Công việc chuyên môn")}
        action={
          data && (
            <Button onClick={() => setEditor("new")}>
              <Plus size={17} />
              {t("Tạo công việc")}
            </Button>
          )
        }
      />
      <div className="professional-context">
        <BriefcaseBusiness size={18} />
        <strong>
          <StableText>{t(labels[me!.actor.role])}</StableText>
        </strong>
        <span>{data?.kinds.map((k) => t(workKindLabels[k])).join(" · ")}</span>
      </div>
      <DataTable
        title={t("Công việc trong phạm vi của bạn")}
        icon={<BriefcaseBusiness size={18} />}
        data={
          data
            ? {
                items: rows.slice((page - 1) * 15, page * 15),
                total: rows.length,
                page,
                pageSize: 15,
              }
            : undefined
        }
        loading={q.isPending}
        error={q.error}
        onRetry={() => void q.refetch()}
        onPage={setPage}
        toolbar={
          <div className="filters">
            <label className="search-input">
              <Search size={17} />
              <Input
                aria-label={t("Tìm công việc")}
                placeholder={t("Tên công việc, dự án, người phụ trách…")}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <Select
              aria-label={t("Trạng thái công việc")}
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { value: "", label: t("Tất cả trạng thái") },
                ...Object.entries(workStatusLabels).map(([value, label]) => ({
                  value,
                  label: t(label),
                })),
              ]}
            />
          </div>
        }
        columns={[
          {
            minWidth: 310,
            label: t("Công việc"),
            render: (w) => (
              <div>
                <strong>{w.title}</strong>
                <small className="workflow-cell-subtext">
                  {w.project} ·{" "}
                  <StableText>{t(workKindLabels[w.kind])}</StableText>
                </small>
              </div>
            ),
          },
          {
            minWidth: 230,
            label: t("Phụ trách"),
            render: (w) => (
              <div>
                {w.assigneeName}
                <small className="workflow-cell-subtext">
                  <StableText>{t("Rà soát:")}</StableText> {w.reviewerName}
                </small>
              </div>
            ),
          },
          {
            minWidth: 155,
            label: t("Hạn hoàn thành"),
            render: (w) => (
              <span
                className={
                  w.dueDate < today() &&
                  !["done", "cancelled"].includes(w.status)
                    ? "professional-overdue"
                    : ""
                }
              >
                {dayLabel(w.dueDate)}
              </span>
            ),
          },
          {
            minWidth: 200,
            label: t("Trạng thái"),
            render: (w) => (
              <span
                className={"professional-status status-tone state-" + w.status}
                data-tone={statusTone(w.status)}
              >
                {t(workStatusLabels[w.status])}
              </span>
            ),
          },
          {
            minWidth: 140,
            label: "",
            render: (w) => (
              <Button variant="ghost" onClick={() => setDetailId(w.id)}>
                {t("Xem công việc")}
                <ArrowUpRight size={15} />
              </Button>
            ),
          },
        ]}
      />
      {editor && data && (
        <Modal
          size="wide"
          title={old ? t("Chỉnh sửa công việc") : t("Tạo công việc chuyên môn")}
          onClose={() => setEditor(null)}
        >
          <Form
            columns={2}
            schema={workItemSchema}
            fields={fields}
            defaults={
              old
                ? Object.fromEntries(
                    [...fields.map((f) => f.name), "version"].map((k) => [
                      k,
                      old[k as keyof WorkItemView],
                    ]),
                  )
                : {
                    title: "",
                    kind: data.kinds[0],
                    project: "",
                    departmentId:
                      assignee?.departmentId ?? me!.employee.departmentId,
                    assigneeId: assignee?.id ?? me!.actor.employeeId,
                    reviewerId: data.canAssign
                      ? me!.actor.employeeId
                      : me!.employee.managerId,
                    dueDate: today(),
                    priority: "normal",
                    description: "",
                    criteria: "",
                    version: 0,
                  }
            }
            submitLabel={t("Lưu công việc")}
            onSubmit={async (body) => {
              await save.mutateAsync({
                path: "/professional/work-items" + (old ? "/" + old.id : ""),
                method: old ? "PATCH" : "POST",
                body,
              });
              setEditor(null);
            }}
          />
        </Modal>
      )}
      {detail && (
        <Modal
          size="wide"
          title={detail.title}
          description={`${detail.project} · ${t(workKindLabels[detail.kind])}`}
          onClose={() => setDetailId(null)}
        >
          <div className="professional-detail-status">
            <span
              className={
                "professional-status status-tone state-" + detail.status
              }
              data-tone={statusTone(detail.status)}
            >
              {t(workStatusLabels[detail.status])}
            </span>
            <span>
              {t("Hạn:")} {dayLabel(detail.dueDate)}
            </span>
          </div>
          <dl className="workflow-facts">
            <div>
              <dt>
                <StableText>{t("Người phụ trách")}</StableText>
              </dt>
              <dd>{detail.assigneeName}</dd>
            </div>
            <div>
              <dt>
                <StableText>{t("Người nghiệm thu")}</StableText>
              </dt>
              <dd>{detail.reviewerName}</dd>
            </div>
          </dl>
          <h3>
            <StableText>{t("Yêu cầu công việc")}</StableText>
          </h3>
          <p className="workflow-prose">{detail.description}</p>
          <h3>
            <StableText>{t("Tiêu chí hoàn thành")}</StableText>
          </h3>
          <p className="workflow-prose">{detail.criteria}</p>
          {detail.outcome && (
            <div className="workflow-resolution">
              <strong>
                <StableText>{t("Kết quả bàn giao")}</StableText>
              </strong>
              <p>{detail.outcome}</p>
              {detail.evidenceUrl && (
                <a
                  className="text-link"
                  href={detail.evidenceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("Mở tài liệu / bằng chứng")}
                  <ArrowUpRight size={15} />
                </a>
              )}
            </div>
          )}
          <WorkflowHistory history={detail.history} />
          <div className="professional-actions">
            {detail.canEdit && (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditor(detail);
                  setDetailId(null);
                }}
              >
                {t("Chỉnh sửa")}
              </Button>
            )}
            {detail.actions.map((a) => (
              <Button
                key={a}
                variant={
                  a === "cancel" || a === "return" ? "secondary" : "primary"
                }
                onClick={() => {
                  setDecision({ item: detail, action: a });
                  setDetailId(null);
                }}
              >
                {t(workActionLabels[a])}
              </Button>
            ))}
          </div>
        </Modal>
      )}
      {decision && (
        <Modal
          title={t(workActionLabels[decision.action])}
          description={decision.item.title}
          onClose={() => setDecision(null)}
        >
          <Form
            schema={workActionSchema}
            defaults={{
              version: decision.item.version,
              note: "",
              evidenceUrl: "",
            }}
            fields={[
              {
                name: "note",
                label:
                  decision.action === "submit"
                    ? t("Kết quả và nội dung bàn giao")
                    : t("Nội dung xác nhận / phản hồi"),
                type: "textarea",
                required: true,
              },
              ...(decision.action === "submit"
                ? [
                    {
                      name: "evidenceUrl",
                      label: t("Liên kết tài liệu / bằng chứng"),
                      hint: t("Liên kết HTTP hoặc HTTPS."),
                    },
                  ]
                : []),
            ]}
            submitLabel={workActionLabels[decision.action]}
            onSubmit={async (body) => {
              await save.mutateAsync({
                path: `/professional/work-items/${decision.item.id}/${decision.action}`,
                body,
              });
              setDecision(null);
            }}
          />
        </Modal>
      )}
    </>
  );
}
