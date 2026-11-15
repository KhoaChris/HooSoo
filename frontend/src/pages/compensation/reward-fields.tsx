import { useId, useState } from "react";
import { Plus, Trash2, WalletCards } from "lucide-react";
import {
  allowancePresets,
  benefitPresets,
  monthlyPackageTotal,
  salaryPackageSchema,
  type SalaryPackage,
  type RecruitmentReward,
} from "@hoosoo/shared";
import { Button, Input, Select, Textarea } from "../../components/ui";
import { Checkbox } from "../../components/ui/checkbox";
import { t, useLocale, intlLocale } from "../../i18n";
import {
  emptySalaryPackage,
  moneyLabel,
  parseMoneyInput,
} from "./compensation-model";

export function MoneyInput({
  value,
  onChange,
  label,
  disabled = false,
  invalid = false,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  useLocale();
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      aria-label={label}
      aria-invalid={invalid || !Number.isFinite(value)}
      inputMode="numeric"
      autoComplete="off"
      disabled={disabled}
      value={
        draft ??
        (Number.isFinite(value) && value !== 0
          ? new Intl.NumberFormat(intlLocale()).format(value)
          : "")
      }
      placeholder="0"
      onBlur={() => {
        if (Number.isFinite(value)) setDraft(null);
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(parseMoneyInput(e.target.value));
      }}
    />
  );
}
export function BenefitsEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: SalaryPackage["benefits"];
  onChange: (v: SalaryPackage["benefits"]) => void;
  disabled?: boolean;
}) {
  const [kind, setKind] = useState<keyof typeof benefitPresets>("health");
  const update = (
    id: string,
    patch: Partial<SalaryPackage["benefits"][number]>,
  ) => onChange(value.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  return (
    <div className="reward-benefits">
      <div className="reward-add-row">
        <Select
          aria-label={t("Loại phúc lợi")}
          value={kind}
          onValueChange={(v) => setKind(v as typeof kind)}
          disabled={disabled}
          options={Object.entries(benefitPresets).map(([value, label]) => ({
            value,
            label: t(label),
          }))}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={
            disabled ||
            value.length >= 12 ||
            (kind !== "custom" && value.some((v) => v.kind === kind))
          }
          onClick={() =>
            onChange([
              ...value,
              {
                id: crypto.randomUUID(),
                kind,
                name: benefitPresets[kind],
                detail: "",
              },
            ])
          }
        >
          <Plus size={16} />
          {t("Thêm phúc lợi")}
        </Button>
      </div>
      {value.map((benefit, index) => (
        <div className="reward-benefit-row" key={benefit.id}>
          <div className="reward-row-heading">
            <strong>
              {benefit.kind === "custom"
                ? t("Phúc lợi khác")
                : t(benefitPresets[benefit.kind])}
            </strong>
            <Button
              variant="ghost"
              tone="danger"
              type="button"
              disabled={disabled}
              aria-label={t("Xóa phúc lợi {0}", [index + 1])}
              onClick={() => onChange(value.filter((v) => v.id !== benefit.id))}
            >
              <Trash2 size={16} />
            </Button>
          </div>
          {benefit.kind === "custom" && (
            <Input
              aria-label={t("Tên phúc lợi {0}", [index + 1])}
              value={benefit.name}
              disabled={disabled}
              maxLength={100}
              onChange={(e) => update(benefit.id, { name: e.target.value })}
            />
          )}
          <Textarea
            aria-label={t("Chi tiết phúc lợi {0}", [index + 1])}
            placeholder={t("Quyền lợi, mức hỗ trợ hoặc điều kiện áp dụng")}
            rows={2}
            maxLength={600}
            value={benefit.detail}
            disabled={disabled}
            onChange={(e) => update(benefit.id, { detail: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}
export function SalaryPackageEditor({
  value,
  onChange,
  optional = false,
  defaultPackage,
  disabled = false,
  invalid = false,
  id,
  labelledBy,
  describedBy,
}: {
  value: SalaryPackage | null;
  onChange: (v: SalaryPackage | null) => void;
  optional?: boolean;
  defaultPackage?: SalaryPackage;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  labelledBy?: string;
  describedBy?: string;
}) {
  useLocale();
  const unique = useId();
  const [kind, setKind] = useState<keyof typeof allowancePresets>("meal");
  const set = (patch: Partial<SalaryPackage>) =>
    onChange({ ...(value ?? emptySalaryPackage()), ...patch });
  const issues = invalid && value ? salaryPackageSchema.safeParse(value) : null;
  return (
    <div
      id={id}
      role="group"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="salary-package-editor"
    >
      {optional && (
        <label className="reward-check">
          <Checkbox
            checked={value !== null}
            disabled={disabled}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? structuredClone(defaultPackage ?? emptySalaryPackage())
                  : null,
              )
            }
          />
          {t("Ghi nhận lương khi nhận việc")}
        </label>
      )}
      {value && (
        <>
          <div className="reward-section">
            <div className="reward-section-title">
              <h3>{t("Lương hàng tháng")}</h3>
              <span>{t("VND / tháng · trước thuế")}</span>
            </div>
            <div className="reward-grid">
              <label>
                <span>{t("Lương cơ bản")} *</span>
                <MoneyInput
                  label={t("Lương cơ bản")}
                  value={value.baseSalary}
                  onChange={(baseSalary) => set({ baseSalary })}
                  disabled={disabled}
                  invalid={invalid && value.baseSalary <= 0}
                />
              </label>
              <div>
                <label className="reward-check" htmlFor={`${unique}-probation`}>
                  <Checkbox
                    id={`${unique}-probation`}
                    checked={value.probationSalary !== null}
                    disabled={disabled}
                    onChange={(e) =>
                      set({ probationSalary: e.target.checked ? 0 : null })
                    }
                  />
                  {t("Lương thử việc riêng")}
                </label>
                {value.probationSalary !== null && (
                  <MoneyInput
                    label={t("Lương thử việc")}
                    value={value.probationSalary}
                    onChange={(probationSalary) => set({ probationSalary })}
                    disabled={disabled}
                    invalid={
                      invalid &&
                      (value.probationSalary <= 0 ||
                        value.probationSalary > value.baseSalary)
                    }
                  />
                )}
              </div>
            </div>
          </div>
          <section className="reward-section">
            <div className="reward-section-title">
              <h3>{t("Phụ cấp cố định")}</h3>
              <small>{t("Hàng tháng")}</small>
            </div>
            {value.allowances.map((item, index) => (
              <div className="reward-allowance-row" key={item.id}>
                <label>
                  <span>{t("Tên phụ cấp")}</span>
                  <Input
                    aria-label={t("Tên phụ cấp {0}", [index + 1])}
                    value={
                      item.kind === "custom"
                        ? item.name
                        : t(allowancePresets[item.kind])
                    }
                    disabled={disabled || item.kind !== "custom"}
                    onChange={(e) =>
                      set({
                        allowances: value.allowances.map((v) =>
                          v.id === item.id ? { ...v, name: e.target.value } : v,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  <span>{t("Số tiền")}</span>
                  <MoneyInput
                    label={t("Số tiền phụ cấp {0}", [index + 1])}
                    value={item.amount}
                    onChange={(amount) =>
                      set({
                        allowances: value.allowances.map((v) =>
                          v.id === item.id ? { ...v, amount } : v,
                        ),
                      })
                    }
                    disabled={disabled}
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  tone="danger"
                  disabled={disabled}
                  aria-label={t("Xóa phụ cấp {0}", [index + 1])}
                  onClick={() =>
                    set({
                      allowances: value.allowances.filter(
                        (v) => v.id !== item.id,
                      ),
                    })
                  }
                >
                  <Trash2 size={17} />
                </Button>
              </div>
            ))}
            <div className="reward-add-row">
              <Select
                aria-label={t("Loại phụ cấp")}
                value={kind}
                onValueChange={(v) => setKind(v as typeof kind)}
                disabled={disabled}
                options={Object.entries(allowancePresets).map(
                  ([value, label]) => ({ value, label: t(label) }),
                )}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={
                  disabled ||
                  value.allowances.length >= 10 ||
                  (kind !== "custom" &&
                    value.allowances.some((v) => v.kind === kind))
                }
                onClick={() =>
                  set({
                    allowances: [
                      ...value.allowances,
                      {
                        id: crypto.randomUUID(),
                        kind,
                        name: allowancePresets[kind],
                        amount: 0,
                      },
                    ],
                  })
                }
              >
                <Plus size={16} />
                {t("Thêm phụ cấp")}
              </Button>
            </div>
          </section>
          <section className="reward-section">
            <h3>{t("Phúc lợi")}</h3>
            <BenefitsEditor
              value={value.benefits}
              onChange={(benefits) => set({ benefits })}
              disabled={disabled}
            />
          </section>
          <label className="reward-section">
            <span>{t("Chính sách thưởng")}</span>
            <Textarea
              aria-label={t("Chính sách thưởng")}
              rows={2}
              maxLength={2000}
              value={value.bonusPolicy}
              onChange={(e) => set({ bonusPolicy: e.target.value })}
              disabled={disabled}
              placeholder={t("Điều kiện và thời điểm xét thưởng")}
            />
          </label>
          <div className="reward-total">
            <WalletCards size={21} />
            <div>
              <span>{t("Tổng cố định hàng tháng")}</span>
              <strong>{moneyLabel(monthlyPackageTotal(value))}</strong>
            </div>
            {value.probationSalary !== null && (
              <div>
                <span>{t("Trong thời gian thử việc")}</span>
                <strong>{moneyLabel(monthlyPackageTotal(value, true))}</strong>
              </div>
            )}
          </div>
          {issues && !issues.success && (
            <p className="field-error" role="alert">
              {t(issues.error.issues[0].message)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
export function RecruitmentRewardEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: RecruitmentReward;
  onChange: (v: RecruitmentReward) => void;
  disabled?: boolean;
}) {
  useLocale();
  const set = (patch: Partial<RecruitmentReward>) =>
    onChange({ ...value, ...patch });
  return (
    <section className="reward-section recruitment-rewards-editor">
      <div className="reward-section-title">
        <h3>{t("Khung lương & phúc lợi")}</h3>
        <span>{t("VND / tháng · trước thuế")}</span>
      </div>
      <Select
        aria-label={t("Hình thức lương")}
        value={value.mode}
        disabled={disabled}
        onValueChange={(mode) =>
          set({
            mode: mode as RecruitmentReward["mode"],
            min: mode === "range" ? 0 : null,
            max: mode === "range" ? 0 : null,
          })
        }
        options={[
          { value: "negotiable", label: t("Thỏa thuận") },
          { value: "range", label: t("Theo khoảng lương") },
        ]}
      />
      {value.mode === "range" && (
        <div className="reward-grid">
          <label>
            <span>{t("Từ mức lương")}</span>
            <MoneyInput
              label={t("Từ mức lương")}
              value={value.min ?? 0}
              onChange={(min) => set({ min })}
              disabled={disabled}
            />
          </label>
          <label>
            <span>{t("Đến mức lương")}</span>
            <MoneyInput
              label={t("Đến mức lương")}
              value={value.max ?? 0}
              onChange={(max) => set({ max })}
              disabled={disabled}
            />
          </label>
        </div>
      )}
      <BenefitsEditor
        value={value.benefits}
        onChange={(benefits) => set({ benefits })}
        disabled={disabled}
      />
    </section>
  );
}
