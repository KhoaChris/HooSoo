import { Target, CalendarDays } from "lucide-react";
import {
  performanceQuarter,
  type PerformanceView,
  type PerformanceWorkspace,
  type PerformanceGoal,
} from "@hoosoo/shared";
import { Form, Modal, Select } from "../../components/ui";
import { DateTimePicker } from "../../components/ui/date-time-picker";
import { useAction } from "../../hooks/data";
import { t, useLocale } from "../../i18n";
import { today, dayLabel } from "../workflows/workflow-ui";
import { GoalEditor } from "./performance-goal-editor";
import {
  newQualitativeGoal,
  performancePlanningSchema,
  quarterDeadline,
  quarterLabel,
  scheduleDefaults,
  type ReviewSchedule,
} from "./performance-planning";

export function PerformanceEditor({
  item,
  workspace,
  onClose,
}: {
  item?: PerformanceView;
  workspace: PerformanceWorkspace;
  onClose: () => void;
}) {
  useLocale();
  const save = useAction();
  return (
    <Modal
      title={t(item ? "Chỉnh sửa mục tiêu" : "Tạo kỳ đánh giá")}
      icon={<Target size={22} />}
      size="wide"
      className="performance-review-dialog"
      onClose={onClose}
    >
      <Form
        schema={performancePlanningSchema}
        columns={2}
        onCancel={onClose}
        defaults={{
          employeeId: item?.employeeId ?? "",
          version: item?.version ?? 0,
          schedule: scheduleDefaults(today(), item),
          goals: item?.goals ?? [newQualitativeGoal()],
        }}
        fields={[
          {
            name: "employeeId",
            label: "Nhân viên",
            type: "select",
            required: true,
            disabled: !!item,
            span: "full",
            options: [
              { value: "", label: t("Chọn nhân viên"), disabled: true },
              ...workspace.people.map((p) => ({
                value: p.id,
                label: `${p.name} · ${p.employeeCode}`,
              })),
            ],
          },
          {
            name: "schedule",
            label: "Kỳ đánh giá",
            span: "full",
            required: true,
            render: ({ value, onChange, disabled, invalid }) => (
              <ScheduleEditor
                value={value as ReviewSchedule}
                onChange={onChange}
                disabled={disabled}
                invalid={invalid}
              />
            ),
          },
          {
            name: "goals",
            label: "Mục tiêu đánh giá",
            span: "full",
            required: true,
            render: ({ value, onChange, disabled, invalid }) => (
              <GoalEditor
                goals={value as PerformanceGoal[]}
                onChange={onChange}
                disabled={disabled}
                invalid={invalid}
              />
            ),
          },
        ]}
        submitLabel={t("Lưu mục tiêu")}
        onSubmit={async (body) => {
          await save.mutateAsync({
            path: `/performance/reviews${item ? `/${item.id}` : ""}`,
            method: item ? "PATCH" : "POST",
            body,
          });
          onClose();
        }}
      />
    </Modal>
  );
}
function ScheduleEditor({
  value,
  onChange,
  disabled,
  invalid,
}: {
  value: ReviewSchedule;
  onChange: (v: ReviewSchedule) => void;
  disabled: boolean;
  invalid: boolean;
}) {
  const currentYear = Number(today().slice(0, 4));
  const years = [
    ...new Set([
      ...Array.from({ length: 11 }, (_, i) => currentYear - 5 + i),
      value.year,
    ]),
  ]
    .filter((y) => y >= 2000 && y <= 2100)
    .sort((a, b) => b - a);
  const range = value.quarter
    ? performanceQuarter({ quarter: value.quarter, year: value.year })
    : null;
  const change = (next: ReviewSchedule) => {
    const nextRange = next.quarter
      ? performanceQuarter({ quarter: next.quarter, year: next.year })
      : null;
    onChange({
      ...next,
      managerDue:
        nextRange &&
        (value.managerDue === (range ? quarterDeadline(range.endDate) : "") ||
          value.managerDue < nextRange.endDate)
          ? quarterDeadline(nextRange.endDate)
          : value.managerDue,
    });
  };
  return (
    <div className="performance-schedule">
      <label>
        <span>{t("Quý")}</span>
        <Select
          aria-invalid={invalid}
          disabled={disabled}
          value={value.quarter ? String(value.quarter) : ""}
          options={[
            { value: "", label: t("Chọn quý"), disabled: true },
            ...[1, 2, 3, 4].map((q) => ({
              value: String(q),
              label: quarterLabel(q),
            })),
          ]}
          onValueChange={(quarter) =>
            change({ ...value, quarter: Number(quarter) })
          }
        />
      </label>
      <label>
        <span>{t("Năm")}</span>
        <Select
          disabled={disabled}
          value={String(value.year)}
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
          onValueChange={(year) => change({ ...value, year: Number(year) })}
        />
      </label>
      {range && (
        <div className="performance-quarter-range">
          <CalendarDays size={17} />
          <span>
            {dayLabel(range.startDate)} — {dayLabel(range.endDate)}
          </span>
        </div>
      )}
      <label className="performance-full">
        <span>{t("Hạn quản lý đánh giá")}</span>
        <DateTimePicker
          type="date"
          aria-label={t("Hạn quản lý đánh giá")}
          value={value.managerDue}
          min={range?.endDate}
          disabled={disabled}
          aria-invalid={invalid}
          onValueChange={(managerDue) => onChange({ ...value, managerDue })}
        />
      </label>
    </div>
  );
}
