import { useState } from "react";
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
  const { me } = useAuth(),
    q = useApi<ProfessionalWorkspace>("/professional/workspace"),
    save = useAction();
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [editor, setEditor] = useState<WorkItemView | "new" | null>(null),
    [detailId, setDetailId] = useState<string | null>(null),
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
    { name: "title", label: "Tên công việc", span: "full", required: true },
    {
      name: "kind",
      label: "Loại công việc",
      type: "select",
      options: (data?.kinds ?? []).map((k) => ({
        value: k,
        label: workKindLabels[k],
      })),
    },
    { name: "project", label: "Dự án / sản phẩm", required: true },
    {
      name: "departmentId",
      label: "Phòng ban",
      type: "select",
      options:
        data?.departments.map((d) => ({ value: d.id, label: d.name })) ?? [],
    },
    {
      name: "assigneeId",
      label: "Người phụ trách",
      type: "select",
      options: (data?.people ?? [])
        .filter(
          (p) =>
            (data?.canAssign && outranks(me!.actor.role, p.role)) ||
            p.id === me!.actor.employeeId,
        )
        .map((p) => ({ value: p.id, label: `${p.name} · ${labels[p.role]}` })),
      hint: "Vai trò của người phụ trách phải phù hợp với loại công việc.",
    },
    {
      name: "reviewerId",
      label: "Người rà soát / nghiệm thu",
      type: "select",
      options: (data?.people ?? [])
        .filter((p) => isSupervisorRole(p.role))
        .map((p) => ({ value: p.id, label: `${p.name} · ${labels[p.role]}` })),
      hint: "Cấp quản lý phụ trách, cao hơn và khác người thực hiện.",
    },
    { name: "dueDate", label: "Hạn hoàn thành", type: "date", required: true },
    {
      name: "priority",
      label: "Mức ưu tiên",
      type: "select",
      options: [
        { value: "low", label: "Thấp" },
        { value: "normal", label: "Bình thường" },
        { value: "high", label: "Cao" },
      ],
    },
    {
      name: "description",
      label: "Nội dung / yêu cầu",
      type: "textarea",
      span: "full",
      required: true,
    },
    {
      name: "criteria",
      label: "Tiêu chí hoàn thành",
      type: "textarea",
      span: "full",
      required: true,
    },
  ];
  return (
    <>
      <Heading
        title="Công việc chuyên môn"
        description="Điều phối công việc, theo dõi bàn giao và nghiệm thu trong phạm vi phụ trách."
        action={
          data && (
            <Button onClick={() => setEditor("new")}>
              <Plus size={17} />
              Tạo công việc
            </Button>
          )
        }
      />
      <div className="professional-context">
        <BriefcaseBusiness size={18} />
        <strong>{labels[me!.actor.role]}</strong>
        <span>{data?.kinds.map((k) => workKindLabels[k]).join(" · ")}</span>
      </div>
      <DataTable
        title="Công việc trong phạm vi của bạn"
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
                aria-label="Tìm công việc"
                placeholder="Tên công việc, dự án, người phụ trách…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <Select
              aria-label="Trạng thái công việc"
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { value: "", label: "Tất cả trạng thái" },
                ...Object.entries(workStatusLabels).map(([value, label]) => ({
                  value,
                  label,
                })),
              ]}
            />
          </div>
        }
        columns={[
          {
            label: "Công việc",
            render: (w) => (
              <div>
                <strong>{w.title}</strong>
                <small className="workflow-cell-subtext">
                  {w.project} · {workKindLabels[w.kind]}
                </small>
              </div>
            ),
          },
          {
            label: "Phụ trách",
            render: (w) => (
              <div>
                {w.assigneeName}
                <small className="workflow-cell-subtext">
                  Rà soát: {w.reviewerName}
                </small>
              </div>
            ),
          },
          {
            label: "Hạn hoàn thành",
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
            label: "Trạng thái",
            render: (w) => (
              <span className={"professional-status state-" + w.status}>
                {workStatusLabels[w.status]}
              </span>
            ),
          },
          {
            label: "",
            render: (w) => (
              <Button variant="ghost" onClick={() => setDetailId(w.id)}>
                Xem công việc
                <ArrowUpRight size={15} />
              </Button>
            ),
          },
        ]}
      />
      {editor && data && (
        <Modal
          size="wide"
          title={old ? "Chỉnh sửa công việc" : "Tạo công việc chuyên môn"}
          description="Ghi rõ yêu cầu, người thực hiện và tiêu chí trước khi bắt đầu."
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
            submitLabel="Lưu công việc"
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
          description={`${detail.project} · ${workKindLabels[detail.kind]}`}
          onClose={() => setDetailId(null)}
        >
          <div className="professional-detail-status">
            <span className={"professional-status state-" + detail.status}>
              {workStatusLabels[detail.status]}
            </span>
            <span>Hạn: {dayLabel(detail.dueDate)}</span>
          </div>
          <dl className="workflow-facts">
            <div>
              <dt>Người phụ trách</dt>
              <dd>{detail.assigneeName}</dd>
            </div>
            <div>
              <dt>Người nghiệm thu</dt>
              <dd>{detail.reviewerName}</dd>
            </div>
          </dl>
          <h3>Yêu cầu công việc</h3>
          <p className="workflow-prose">{detail.description}</p>
          <h3>Tiêu chí hoàn thành</h3>
          <p className="workflow-prose">{detail.criteria}</p>
          {detail.outcome && (
            <div className="workflow-resolution">
              <strong>Kết quả bàn giao</strong>
              <p>{detail.outcome}</p>
              {detail.evidenceUrl && (
                <a
                  className="text-link"
                  href={detail.evidenceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Mở tài liệu / bằng chứng
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
                Chỉnh sửa
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
                {workActionLabels[a]}
              </Button>
            ))}
          </div>
        </Modal>
      )}
      {decision && (
        <Modal
          title={workActionLabels[decision.action]}
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
                    ? "Kết quả và nội dung bàn giao"
                    : "Nội dung xác nhận / phản hồi",
                type: "textarea",
                required: true,
              },
              ...(decision.action === "submit"
                ? [
                    {
                      name: "evidenceUrl",
                      label: "Liên kết tài liệu / bằng chứng",
                      hint: "Liên kết http/https. Tài liệu sẽ được người rà soát sử dụng để nghiệm thu.",
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
