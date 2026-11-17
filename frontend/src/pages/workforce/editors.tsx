import { useAuth } from "../../app/auth";
import { useState } from "react";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import {
  timeRequestSchema,
  payrollSetupSchema,
  personnelChangeSchema,
  personnelDocumentSchema,
  announcementSchema,
  documentCategories,
  type TimeRequestInput,
  type PayrollView,
  type PersonnelChangeView,
  type PersonnelDocumentView,
  type AnnouncementView,
} from "@hoosoo/shared";
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  type FormField,
} from "../../components/ui";
import { useAction, useApi } from "../../hooks/data";
import { t } from "../../i18n";
import { today, type Workspace } from "./common";
const personOptions = (w: Workspace<unknown>) =>
  w.people.map((p) => ({
    value: p.id,
    label: `${p.name} · ${p.employeeCode}`,
  }));
export function TimeEditor({
  workspace: w,
  onClose,
}: {
  workspace: Workspace<unknown>;
  onClose: () => void;
}) {
  const action = useAction(),
    [kind, setKind] = useState<TimeRequestInput["kind"]>("overtime"),
    [slot, setSlot] = useState("custom");
  const schedule = w.schedule;
  const preset =
    slot === "morning" && schedule
      ? { start: schedule.start, end: schedule.breakStart }
      : slot === "afternoon" && schedule
        ? { start: schedule.breakEnd, end: schedule.end }
        : {
            start:
              kind === "overtime"
                ? (schedule?.end ?? "17:00")
                : (schedule?.start ?? "08:00"),
            end:
              kind === "overtime" ? "20:00" : (schedule?.breakStart ?? "12:00"),
          };
  return (
    <Modal title={t("Tạo đề nghị thời gian")} onClose={onClose}>
      <div className="wf-editor-options">
        <label>
          {t("Loại đề nghị")}
          <Select
            value={kind}
            onValueChange={(v) => {
              setKind(v as TimeRequestInput["kind"]);
              setSlot("custom");
            }}
            options={[
              { value: "overtime", label: t("Tăng ca") },
              { value: "hourly_leave", label: t("Nghỉ theo giờ") },
            ]}
          />
        </label>
        {kind === "hourly_leave" && (
          <label>
            {t("Khoảng thời gian")}
            <Select
              value={slot}
              onValueChange={setSlot}
              options={[
                { value: "custom", label: t("Chọn giờ cụ thể") },
                { value: "morning", label: t("Nửa ngày buổi sáng") },
                { value: "afternoon", label: t("Nửa ngày buổi chiều") },
              ]}
            />
          </label>
        )}
      </div>
      <p className="wf-hint">
        {t(
          kind === "overtime"
            ? "Tăng ca cần được duyệt và đối chiếu thời gian chấm công trước khi tính lương."
            : "Giờ nghỉ trưa được loại trừ. Nghỉ có trừ phép sử dụng chung quỹ phép năm.",
        )}
      </p>
      <Form
        key={`${kind}-${slot}`}
        schema={timeRequestSchema}
        columns={2}
        defaults={{
          kind,
          date: today(),
          ...preset,
          leaveTypeId:
            kind === "hourly_leave"
              ? (w.leaveTypes.find((t) => t.active)?.id ?? "")
              : "",
          reason: "",
        }}
        fields={[
          {
            name: "date",
            label: "Ngày đề nghị",
            type: "date",
            required: true,
            span: "full",
          },
          { name: "start", label: "Bắt đầu", type: "time", required: true },
          { name: "end", label: "Kết thúc", type: "time", required: true },
          ...(kind === "hourly_leave"
            ? [
                {
                  name: "leaveTypeId",
                  label: "Loại nghỉ phép",
                  type: "select",
                  options: w.leaveTypes
                    .filter((l) => l.active)
                    .map((l) => ({ value: l.id, label: l.name })),
                  required: true,
                  span: "full",
                } as FormField,
              ]
            : []),
          {
            name: "reason",
            label: "Lý do đề nghị",
            type: "textarea",
            required: true,
            span: "full",
          },
        ]}
        onCancel={onClose}
        submitLabel={t("Gửi đề nghị")}
        onSubmit={async (body) => {
          await action.mutateAsync({ path: "/workforce/time", body });
          onClose();
        }}
      />
    </Modal>
  );
}
function AmountRows({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const rows = (value ?? []) as { label: string; amount: number }[];
  return (
    <div className="wf-amounts">
      {rows.map((r, i) => (
        <div className="wf-amount-row" key={i}>
          <Input
            aria-label={t("Tên khoản điều chỉnh")}
            value={r.label}
            placeholder={t("Tên khoản điều chỉnh")}
            onChange={(e) =>
              onChange(
                rows.map((v, j) =>
                  j === i ? { ...v, label: e.target.value } : v,
                ),
              )
            }
          />
          <Input
            aria-label={t("Số tiền VND")}
            type="number"
            min="1"
            value={r.amount || ""}
            onChange={(e) =>
              onChange(
                rows.map((v, j) =>
                  j === i ? { ...v, amount: Number(e.target.value) } : v,
                ),
              )
            }
          />
          <Button
            type="button"
            variant="ghost"
            tone="danger"
            aria-label={t("Xóa khoản điều chỉnh")}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ))}
      {rows.length < 12 && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => onChange([...rows, { label: "", amount: 0 }])}
        >
          <Plus size={16} />
          {t("Thêm khoản")}
        </Button>
      )}
    </div>
  );
}
export function PayrollEditor({
  workspace: w,
  item,
  onClose,
}: {
  workspace: Workspace<unknown>;
  item?: PayrollView;
  onClose: () => void;
}) {
  const action = useAction();
  const current = new Date();
  current.setMonth(current.getMonth() - 1);
  const months = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(current.getFullYear(), current.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { value, label: value };
  });
  return (
    <Modal
      title={t(item ? "Điều chỉnh phiếu lương" : "Lập phiếu lương tháng")}
      size="wide"
      onClose={onClose}
    >
      <p className="wf-hint">
        {t(
          "Tính theo mức lương có hiệu lực và ngày công chuẩn. Thuế, bảo hiểm và khoản giảm trừ được đối soát thủ công theo chính sách áp dụng.",
        )}
      </p>
      <Form
        schema={payrollSetupSchema}
        columns={2}
        defaults={
          item
            ? {
                employeeId: item.employeeId,
                period: item.period,
                version: item.version,
                earnings: item.earnings,
                deductions: item.deductions,
                overtimeRate: item.overtimeRate,
                reason: "",
              }
            : {
                employeeId: "",
                period: months[0].value,
                version: 0,
                earnings: [],
                deductions: [],
                overtimeRate: 0,
                reason: "",
              }
        }
        fields={[
          {
            name: "employeeId",
            label: "Nhân viên",
            type: "select",
            options: personOptions(w),
            required: true,
            disabled: !!item,
          },
          {
            name: "period",
            label: "Tháng lương",
            type: "select",
            options:
              item && !months.some((m) => m.value === item.period)
                ? [{ value: item.period, label: item.period }, ...months]
                : months,
            required: true,
            disabled: !!item,
          },
          {
            name: "overtimeRate",
            label: "Đơn giá tăng ca / giờ (VND)",
            type: "number",
            min: "0",
            hint: "Chỉ tính thời gian tăng ca đã duyệt, có chấm công đối chiếu.",
            span: "full",
          },
          {
            name: "earnings",
            label: "Thu nhập bổ sung",
            span: "full",
            render: (p) => <AmountRows value={p.value} onChange={p.onChange} />,
          },
          {
            name: "deductions",
            label: "Các khoản khấu trừ",
            span: "full",
            render: (p) => <AmountRows value={p.value} onChange={p.onChange} />,
          },
          {
            name: "reason",
            label: "Căn cứ tính lương",
            type: "textarea",
            required: true,
            span: "full",
          },
        ]}
        submitLabel={t("Tính và lưu bản nháp")}
        onCancel={onClose}
        onSubmit={async (body) => {
          await action.mutateAsync({ path: "/workforce/payroll", body });
          onClose();
        }}
      />
    </Modal>
  );
}
export function ChangeEditor({
  workspace: w,
  item,
  onClose,
}: {
  workspace: Workspace<unknown>;
  item?: PersonnelChangeView;
  onClose: () => void;
}) {
  const run = useAction(),
    [employeeId, setEmployeeId] = useState(item?.employeeId ?? "");
  const refs = useApi<{
    salaries: { id: string; label: string }[];
    contracts: { id: string; label: string }[];
  }>(`/workforce/changes/employee/${employeeId}/options`, !!employeeId);
  return (
    <Modal
      title={t("Đề nghị điều chuyển / bổ nhiệm")}
      size="wide"
      onClose={onClose}
    >
      <Form
        schema={personnelChangeSchema}
        columns={2}
        defaults={
          item
            ? {
                employeeId: item.employeeId,
                kind: item.kind,
                departmentId: item.departmentId,
                positionId: item.positionId,
                managerId: item.managerId,
                effectiveDate: item.effectiveDate,
                salaryRecordId: item.salaryRecordId,
                contractId: item.contractId,
                version: item.version,
                reason: item.reason,
              }
            : {
                employeeId: "",
                kind: "transfer",
                departmentId: "",
                positionId: "",
                managerId: "",
                effectiveDate: today(),
                salaryRecordId: "",
                contractId: "",
                version: 0,
                reason: "",
              }
        }
        fields={[
          {
            name: "employeeId",
            label: "Nhân viên",
            type: "select",
            required: true,
            render: (p) => (
              <Select
                id={p.id}
                aria-labelledby={p.labelId}
                aria-describedby={p.describedBy}
                value={String(p.value ?? "")}
                disabled={!!item}
                onValueChange={(v) => {
                  p.onChange(v);
                  setEmployeeId(v);
                }}
                options={personOptions(w)}
              />
            ),
          },
          {
            name: "kind",
            label: "Loại thay đổi",
            type: "select",
            options: [
              { value: "transfer", label: t("Điều chuyển") },
              { value: "promotion", label: t("Bổ nhiệm") },
            ],
          },
          {
            name: "departmentId",
            label: "Phòng ban mới",
            type: "select",
            options: w.departments
              .filter((v) => v.active)
              .map((v) => ({ value: v.id, label: v.name })),
            required: true,
          },
          {
            name: "positionId",
            label: "Chức danh mới",
            type: "select",
            options: w.positions
              .filter((v) => v.active)
              .map((v) => ({ value: v.id, label: v.name })),
            required: true,
          },
          {
            name: "managerId",
            label: "Quản lý mới",
            type: "select",
            options: [
              { value: "", label: t("Chưa phân công") },
              ...(w.managers ?? [])
                .filter((e) => e.id !== employeeId)
                .map((e) => ({
                  value: e.id,
                  label: `${e.name} · ${e.employeeCode}`,
                })),
            ],
            hint: "Quản lý phải cùng phòng ban và có cấp bậc cao hơn.",
          },
          {
            name: "effectiveDate",
            label: "Ngày hiệu lực",
            type: "date",
            required: true,
          },
          {
            name: "salaryRecordId",
            label: "Hồ sơ lương liên kết",
            type: "select",
            options: [
              { value: "", label: t("Không liên kết") },
              ...(refs.data?.salaries ?? []).map((r) => ({
                value: r.id,
                label: r.label,
              })),
            ],
            hint: "Chọn mức lương có cùng ngày hiệu lực, nếu có điều chỉnh lương.",
          },
          {
            name: "contractId",
            label: "Hợp đồng liên kết",
            type: "select",
            options: [
              { value: "", label: t("Không liên kết") },
              ...(refs.data?.contracts ?? []).map((r) => ({
                value: r.id,
                label: r.label,
              })),
            ],
          },
          {
            name: "reason",
            label: "Lý do / căn cứ xử lý",
            type: "textarea",
            required: true,
            span: "full",
          },
        ]}
        onCancel={onClose}
        submitLabel={t("Lưu bản nháp")}
        onSubmit={async (body) => {
          await run.mutateAsync({
            path: `/workforce/changes${item ? "/" + item.id : ""}`,
            method: item ? "PATCH" : "POST",
            body,
          });
          onClose();
        }}
      />
    </Modal>
  );
}
export function DocumentEditor({
  workspace: w,
  item,
  onClose,
}: {
  workspace: Workspace<unknown>;
  item?: PersonnelDocumentView;
  onClose: () => void;
}) {
  const run = useAction(),
    { me } = useAuth();
  const schema = personnelDocumentSchema
    .omit({ data: true, fileName: true, mime: true })
    .extend({
      file: z
        .instanceof(File)
        .refine(
          (f) => f.size > 0 && f.size <= 512 * 1024,
          t("Tệp tối đa 512 KB"),
        ),
    });
  return (
    <Modal
      title={t(item ? "Tải phiên bản mới" : "Thêm tài liệu nhân sự")}
      onClose={onClose}
    >
      <p className="wf-hint">
        {t(
          "PDF, PNG hoặc JPEG · tối đa 512 KB. Các phiên bản trước vẫn được giữ lại.",
        )}
      </p>
      <Form
        schema={schema}
        defaults={{
          employeeId:
            item?.employeeId ?? (w.people.length === 1 ? w.people[0].id : ""),
          title: item?.title ?? "",
          category: item?.category ?? "qualification",
          expiresOn: item?.expiresOn ?? "",
          version: item?.version ?? 0,
          reason: "",
        }}
        fields={[
          {
            name: "employeeId",
            label: "Nhân viên",
            type: "select",
            options: personOptions(w),
            required: true,
            disabled: !!item,
          },
          { name: "title", label: "Tên tài liệu", required: true },
          {
            name: "category",
            label: "Loại tài liệu",
            type: "select",
            options: Object.entries(documentCategories)
              .filter(
                ([key]) =>
                  ["Admin", "HR"].includes(me?.actor.role ?? "") ||
                  !["contract", "employment_letter"].includes(key),
              )
              .map(([value, label]) => ({ value, label: t(label) })),
            disabled: !!item,
          },
          {
            name: "file",
            label: "Tệp đính kèm",
            required: true,
            render: (p) => (
              <Input
                id={p.id}
                aria-labelledby={p.labelId}
                aria-describedby={p.describedBy}
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                aria-invalid={p.invalid}
                onChange={(e) => p.onChange(e.target.files?.[0])}
              />
            ),
          },
          { name: "expiresOn", label: "Ngày hết hạn (nếu có)", type: "date" },
          {
            name: "reason",
            label: "Nội dung cập nhật",
            type: "textarea",
            required: true,
          },
        ]}
        onCancel={onClose}
        onSubmit={async (value) => {
          const { file, ...body } = value;
          const bytes = new Uint8Array(await (file as File).arrayBuffer());
          let binary = "";
          for (const b of bytes) binary += String.fromCharCode(b);
          await run.mutateAsync({
            path: `/workforce/documents${item ? "/" + item.id : ""}`,
            method: item ? "PATCH" : "POST",
            body: {
              ...body,
              data: btoa(binary),
              fileName: (file as File).name,
              mime: (file as File).type,
            },
          });
          onClose();
        }}
      />
    </Modal>
  );
}
export function AnnouncementEditor({
  workspace: w,
  item,
  onClose,
}: {
  workspace: Workspace<unknown>;
  item?: AnnouncementView;
  onClose: () => void;
}) {
  const run = useAction();
  return (
    <Modal title={t("Soạn bản tin / chính sách")} size="wide" onClose={onClose}>
      <Form
        schema={announcementSchema}
        columns={2}
        defaults={
          item
            ? {
                title: item.title,
                body: item.body,
                kind: item.kind,
                departmentIds: item.departmentIds,
                requiresAcknowledgement: item.requiresAcknowledgement,
                pinned: item.pinned,
                publishOn: item.publishOn,
                expiresOn: item.expiresOn,
                version: item.version,
              }
            : {
                title: "",
                body: "",
                kind: "announcement",
                departmentIds: [],
                requiresAcknowledgement: false,
                pinned: false,
                publishOn: today(),
                expiresOn: "",
                version: 0,
              }
        }
        fields={[
          { name: "title", label: "Tiêu đề", required: true, span: "full" },
          {
            name: "kind",
            label: "Loại nội dung",
            type: "select",
            options: [
              { value: "announcement", label: t("Thông báo nội bộ") },
              { value: "policy", label: t("Chính sách") },
            ],
          },
          {
            name: "publishOn",
            label: "Ngày hiển thị",
            type: "date",
            required: true,
          },
          { name: "expiresOn", label: "Ngày hết hạn (nếu có)", type: "date" },
          {
            name: "departmentIds",
            label: "Phòng ban nhận tin",
            type: "choices",
            options: w.departments
              .filter((v) => v.active)
              .map((v) => ({ value: v.id, label: v.name })),
            hint: "Để trống để gửi toàn công ty.",
            span: "full",
          },
          {
            name: "body",
            label: "Nội dung",
            type: "textarea",
            required: true,
            span: "full",
          },
          {
            name: "requiresAcknowledgement",
            label: "Yêu cầu xác nhận đã đọc",
            type: "switch",
          },
          { name: "pinned", label: "Ghim bản tin", type: "switch" },
        ]}
        onCancel={onClose}
        submitLabel={t("Lưu bản nháp")}
        onSubmit={async (body) => {
          await run.mutateAsync({
            path: `/workforce/announcements${item ? "/" + item.id : ""}`,
            method: item ? "PATCH" : "POST",
            body,
          });
          onClose();
        }}
      />
    </Modal>
  );
}
