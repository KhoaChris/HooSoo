import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  balancePerformanceGoals,
  performancePriorities,
  type PerformanceGoal,
} from "@hoosoo/shared";
import { Button, Input, Select, Textarea } from "../../components/ui";
import { t } from "../../i18n";
import { convertLegacyGoals, newQualitativeGoal } from "./performance-planning";

const templates = [
  {
    title: "Chất lượng công việc",
    expectation:
      "Hoàn thành công việc đúng yêu cầu, hạn chế sai sót và được nghiệm thu.",
  },
  {
    title: "Tiến độ & cam kết",
    expectation:
      "Đáp ứng thời hạn đã thống nhất và chủ động báo cáo khi có thay đổi.",
  },
  {
    title: "Phối hợp đội ngũ",
    expectation:
      "Chia sẻ thông tin đầy đủ, phối hợp và hỗ trợ đồng nghiệp hiệu quả.",
  },
  {
    title: "Cải tiến công việc",
    expectation:
      "Đề xuất và thực hiện cải tiến có tác động rõ ràng đến công việc.",
  },
];
export function GoalEditor({
  goals,
  onChange,
  disabled,
  invalid,
}: {
  goals: PerformanceGoal[];
  onChange: (value: unknown) => void;
  disabled: boolean;
  invalid: boolean;
}) {
  const legacy = goals.some((g) => g.kind !== "qualitative");
  const update = (index: number, goal: PerformanceGoal) =>
    onChange(
      balancePerformanceGoals(goals.map((g, i) => (i === index ? goal : g))),
    );
  if (legacy)
    return (
      <div className="performance-legacy-goals">
        <ol>
          {goals.map((g) => (
            <li key={g.id}>
              <strong>{g.title}</strong>
              {g.kind !== "qualitative" && (
                <span>
                  {g.target} {g.unit} · {g.weight}%
                </span>
              )}
            </li>
          ))}
        </ol>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => onChange(convertLegacyGoals(goals))}
        >
          {t("Chuyển sang mục tiêu nhận xét")}
        </Button>
      </div>
    );
  return (
    <div className="performance-goal-editor" aria-invalid={invalid}>
      {goals.map(
        (goal, index) =>
          goal.kind === "qualitative" && (
            <QualitativeGoal
              key={goal.id}
              goal={goal}
              index={index}
              disabled={disabled}
              invalid={invalid}
              canRemove={goals.length > 1}
              onChange={(g) => update(index, g)}
              onRemove={() =>
                onChange(
                  balancePerformanceGoals(goals.filter((_, i) => i !== index)),
                )
              }
            />
          ),
      )}
      <div className="performance-goal-footer">
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || goals.length >= 6}
          onClick={() =>
            onChange(balancePerformanceGoals([...goals, newQualitativeGoal()]))
          }
        >
          <Plus size={16} />
          {t("Thêm mục tiêu")}
        </Button>
        <span>{t("{0}/6 mục tiêu", [goals.length])}</span>
      </div>
    </div>
  );
}
function QualitativeGoal({
  goal,
  index,
  disabled,
  invalid,
  canRemove,
  onChange,
  onRemove,
}: {
  goal: Extract<PerformanceGoal, { kind: "qualitative" }>;
  index: number;
  disabled: boolean;
  invalid: boolean;
  canRemove: boolean;
  onChange: (value: PerformanceGoal) => void;
  onRemove: () => void;
}) {
  const [template, setTemplate] = useState(() => {
    const index = templates.findIndex((template) =>
      [template.title, t(template.title)].includes(goal.title),
    );
    return index >= 0 ? String(index) : goal.title ? "custom" : "";
  });
  const custom = template === "custom";
  return (
    <fieldset
      disabled={disabled}
      className="performance-goal-row performance-qualitative-goal"
    >
      <legend>{t("Mục tiêu {0}", [index + 1])}</legend>
      <div className="performance-goal-controls performance-full">
        <span>{t("Tỷ trọng {0}%", [goal.weight])}</span>
        <Button
          type="button"
          variant="ghost"
          tone="danger"
          disabled={!canRemove}
          aria-label={t("Xóa mục tiêu {0}", [index + 1])}
          onClick={onRemove}
        >
          <Trash2 size={16} />
          {t("Xóa")}
        </Button>
      </div>
      <label>
        <span>{t("Tiêu chí mục tiêu")}</span>
        <Select
          disabled={disabled}
          aria-invalid={invalid && goal.title.trim().length < 3}
          value={template}
          options={[
            { value: "", label: t("Chọn tiêu chí"), disabled: true },
            ...templates.map((template, i) => ({
              value: String(i),
              label: t(template.title),
            })),
            { value: "custom", label: t("Tự viết mục tiêu") },
          ]}
          onValueChange={(value) => {
            setTemplate(value);
            if (value === "custom") return;
            const template = templates[Number(value)];
            onChange({
              ...goal,
              title: t(template.title),
              expectation: t(template.expectation),
            });
          }}
        />
      </label>
      <label>
        <span>{t("Mức ưu tiên")}</span>
        <Select
          disabled={disabled}
          value={goal.priority}
          options={Object.entries(performancePriorities).map(
            ([value, label]) => ({ value, label: t(label) }),
          )}
          onValueChange={(priority) =>
            onChange({ ...goal, priority: priority as typeof goal.priority })
          }
        />
      </label>
      {custom && (
        <label className="performance-full">
          <span>{t("Tên mục tiêu")}</span>
          <Input
            required
            maxLength={180}
            value={goal.title}
            aria-invalid={invalid && goal.title.trim().length < 3}
            onChange={(e) => onChange({ ...goal, title: e.target.value })}
          />
        </label>
      )}
      <label className="performance-full">
        <span>{t("Kết quả mong đợi")}</span>
        <Textarea
          required
          rows={3}
          maxLength={1000}
          value={goal.expectation}
          aria-invalid={invalid && goal.expectation.trim().length < 5}
          placeholder={t(
            "Mô tả công việc cần hoàn thành và tiêu chuẩn đạt yêu cầu…",
          )}
          onChange={(e) => onChange({ ...goal, expectation: e.target.value })}
        />
      </label>
    </fieldset>
  );
}
